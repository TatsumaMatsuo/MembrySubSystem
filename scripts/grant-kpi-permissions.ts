/**
 * 生産本部KPIシステム メニュー権限付与(#59 権限マッピング)
 *
 * グループ権限マスタ(部署名単位)に メニュー(M014/M015系)+ プログラム(PGM032-043)を付与する。
 * メニュー表示には L1メニュー・L2メニュー・プログラムの3レベルすべての許可が必要
 * (lib/menu-permission.ts buildPermittedMenuStructure)。
 *
 * 照合キーは「グループ名」=部署名(社員の部署を expandDepartmentChain で展開して一致)。
 * 冪等: 既存(グループ名×対象種別×対象ID)があればスキップ。
 *
 * 実行: npx tsx scripts/grant-kpi-permissions.ts [--dry-run]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

// ===== メニュー/プログラム ID(register-kpi-menu.ts と対応)=====
const KEIEI_MENUS = ["M014", "M014-01"];
const SEISAN_MENUS = ["M015", "M015-01", "M015-02", "M015-03"];
const ALL_MENUS = [...KEIEI_MENUS, ...SEISAN_MENUS];

const KEIEI_PROGRAMS = ["PGM032", "PGM033", "PGM034", "PGM035"];
const SEISAN_REVIEW = ["PGM036", "PGM037", "PGM038", "PGM039", "PGM041"]; // DB/入力/施策/★/過去
const SEISAN_ADMIN = ["PGM040", "PGM042"]; // マスタ/エクスポート
const HELP = ["PGM043"];
const ALL_PROGRAMS = [...KEIEI_PROGRAMS, ...SEISAN_REVIEW, ...SEISAN_ADMIN, ...HELP];

interface Grant { group: string; role: string; menus: string[]; programs: string[] }

/**
 * 付与対象。まずは管理者(DX推進室)に全許可 → サイドバー表示確認。
 * 役職連携の本格ロール付与(本部長/部長/課長/閲覧)は §3.2 の API ガードと併せて段階導入。
 */
const GRANTS: Grant[] = [
  { group: "DX推進室", role: "管理者", menus: ALL_MENUS, programs: ALL_PROGRAMS },
];

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  for (const g of GRANTS) {
    console.log(`\n=== ${g.group}(${g.role})${dryRun ? " (DRY-RUN)" : ""} ===`);
    // 既存権限を取得
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
      params: { page_size: 500, filter: `CurrentValue.[グループ名] = "${g.group}"` },
    });
    const existing = res.data?.items || [];
    const has = (type: string, id: string) =>
      existing.some((r: any) => val(r.fields?.["対象種別"]) === type && val(r.fields?.["対象ID"]) === id);

    const targets: { type: "menu" | "program"; id: string }[] = [
      ...g.menus.map((id) => ({ type: "menu" as const, id })),
      ...g.programs.map((id) => ({ type: "program" as const, id })),
    ];

    let created = 0, skipped = 0;
    for (const t of targets) {
      if (has(t.type, t.id)) { skipped++; continue; }
      console.log(`  + ${t.type} ${t.id} を許可`);
      if (!dryRun) {
        const cr: any = await client.bitable.appTableRecord.create({
          path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
          data: {
            fields: {
              "グループ名": g.group,
              "対象種別": t.type,
              "対象ID": t.id,
              "許可フラグ": true,
            },
          },
        });
        if (cr.code !== 0) throw new Error(`Create failed (${g.group} ${t.id}): ${cr.msg}`);
        created++;
      } else {
        created++;
      }
    }
    console.log(`  → 新規 ${created} 件 / スキップ(既存) ${skipped} 件`);
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
