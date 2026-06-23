/**
 * KPIメニュー名(機能配置マスタ プログラム名称)を更新。全環境共有のマスタbase。
 * 実行: npx tsx scripts/rename-kpi-menu.ts        (確認のみ・dry-run)
 *       npx tsx scripts/rename-kpi-menu.ts --apply (実更新)
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_PGM = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const NAME = "プログラム名称";

// recordId → 新名称(list-kpi-menu.ts で取得)
const UPDATES: { recordId: string; pgm: string; from: string; to: string }[] = [
  { recordId: "recvmeWZQtt4um", pgm: "PGM036", from: "ダッシュボード", to: "KPIダッシュボード" },
  { recordId: "recvmeX0ptx1qU", pgm: "PGM038", from: "施策管理(PDCA)", to: "KPI施策管理 (重点施策PDCA)" },
  { recordId: "recvmeX0Z469jO", pgm: "PGM041", from: "過去実績参照", to: "KPI過去実績参照" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const c = new lark.Client({ appId: process.env.LARK_APP_ID!, appSecret: process.env.LARK_APP_SECRET!, appType: lark.AppType.SelfBuild, domain: process.env.LARK_DOMAIN || "https://open.larksuite.com" });
  console.log(apply ? "=== 更新を実行します ===" : "=== dry-run(--apply で実更新) ===");
  for (const u of UPDATES) {
    // 現在値を確認
    const got: any = await c.bitable.appTableRecord.get({ path: { app_token: BASE, table_id: T_PGM, record_id: u.recordId } });
    const cur = got?.data?.record?.fields?.[NAME];
    const curText = typeof cur === "string" ? cur : Array.isArray(cur) ? cur.map((x: any) => x?.text ?? x).join("") : cur?.text ?? "";
    console.log(`  ${u.pgm}: 現在="${curText}" → "${u.to}"`);
    if (curText !== u.from) { console.log(`    ⚠ 想定の現在値("${u.from}")と異なります。スキップ。`); continue; }
    if (apply) {
      const r: any = await c.bitable.appTableRecord.update({ path: { app_token: BASE, table_id: T_PGM, record_id: u.recordId }, data: { fields: { [NAME]: u.to } } });
      console.log(`    ${r.code === 0 ? "✓ 更新OK" : "✗ 失敗: " + r.msg}`);
    }
  }
  if (!apply) console.log("\n(確認のみ。--apply を付けて実行すると更新します)");
}
main().catch((e) => { console.error("[fatal]", e); process.exit(1); });
