/**
 * 営業「基準風速積雪検索」メニュー権限付与。
 *
 * メニュー表示には L1(M003)・L2(M003-05)・プログラム(PGM045) の3レベル許可が必要。
 * M003(L1) は既に 営業部/DX推進室 に許可済みのため、新規の M003-05 と PGM045 を付与する。
 * 付与先は既存の営業ツール(M003-01 売上BI)と同じ 営業部 + DX推進室。
 *
 * 冪等: 既存(グループ名×対象種別×対象ID)があればスキップ。
 * 実行: npx tsx scripts/grant-eigyo-kijun-fusoku-permissions.ts [--dry-run]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

interface Grant { group: string; menus: string[]; programs: string[] }

const GRANTS: Grant[] = [
  { group: "営業部", menus: ["M003", "M003-05"], programs: ["PGM045"] },
  { group: "DX推進室", menus: ["M003", "M003-05"], programs: ["PGM045"] },
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
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  for (const g of GRANTS) {
    console.log(`\n=== ${g.group}${dryRun ? " (DRY-RUN)" : ""} ===`);
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
      if (has(t.type, t.id)) { console.log(`  ✓ ${t.type} ${t.id} 既存 → スキップ`); skipped++; continue; }
      console.log(`  + ${t.type} ${t.id} を許可`);
      if (!dryRun) {
        const cr: any = await client.bitable.appTableRecord.create({
          path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
          data: { fields: { "グループ名": g.group, "対象種別": t.type, "対象ID": t.id, "許可フラグ": true } },
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
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
