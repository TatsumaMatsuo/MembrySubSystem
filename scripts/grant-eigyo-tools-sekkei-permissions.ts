/**
 * 営業「支援ツール」(基準風速積雪検索 PGM045 / 参考図台帳検索 PGM046) を設計部でも使えるように権限付与。
 *
 * メニュー表示には L1(M003)・L2(M003-05)・プログラム の3レベル許可が必要。
 * 設計部には既に M003-05 / PGM045 / PGM046 が付与済みだが、親の L1(M003) が無いため非表示だった。
 * 本スクリプトで不足分(主にM003)を補う(冪等)。設計部のメニューに「営業部 > 支援ツール」として表示される
 * (営業部配下の他メニューは設計部に権限が無いため表示されない)。
 *
 * 実行: npx tsx scripts/grant-eigyo-tools-sekkei-permissions.ts [--dry-run]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const GROUP = "設計部";
const MENUS = ["M003", "M003-05"];
const PROGRAMS = ["PGM045", "PGM046"];

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
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  console.log(`=== ${GROUP} へ営業支援ツール権限付与${dryRun ? " (DRY-RUN)" : ""} ===`);
  const res: any = await client.bitable.appTableRecord.list({
    path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
    params: { page_size: 500, filter: `CurrentValue.[グループ名] = "${GROUP}"` },
  });
  const existing = res.data?.items || [];
  const has = (type: string, id: string) =>
    existing.some((r: any) => val(r.fields?.["対象種別"]) === type && val(r.fields?.["対象ID"]) === id);

  const targets: { type: "menu" | "program"; id: string }[] = [
    ...MENUS.map((id) => ({ type: "menu" as const, id })),
    ...PROGRAMS.map((id) => ({ type: "program" as const, id })),
  ];

  let created = 0, skipped = 0;
  for (const t of targets) {
    if (has(t.type, t.id)) { console.log(`  ✓ ${t.type} ${t.id} 既存 → スキップ`); skipped++; continue; }
    console.log(`  + ${t.type} ${t.id} を許可`);
    if (!dryRun) {
      const cr: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
        data: { fields: { "グループ名": GROUP, "対象種別": t.type, "対象ID": t.id, "許可フラグ": true } },
      });
      if (cr.code !== 0) throw new Error(`Create failed (${GROUP} ${t.id}): ${cr.msg}`);
      created++;
    } else {
      created++;
    }
  }
  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} === 新規 ${created} / スキップ(既存) ${skipped}`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
