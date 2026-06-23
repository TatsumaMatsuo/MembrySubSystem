/**
 * 基準風速・積雪量マスタ テーブルを master base に新設する（冪等）。
 *
 *   npx tsx scripts/kijun-fusoku/setup-table.ts
 *
 * 既に同名テーブルがあれば作成せず、その table_id を表示する。
 * 出力された table_id を lib/lark-tables.ts の KIJUN_FUSOKU フォールバックに設定すること。
 *
 * ⚠️ 書込先 master base は本番main・全featブランチ共有。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// ⚠️ アプリにテーブル作成権限が無いため、テーブルは Lark UI で手動作成する。
//    本スクリプトは「既存テーブルの table_id を探して表示する」用途で使う。
//    作成先は project base（社員マスタ等の master base ではない）。
const BASE = process.env.LARK_BASE_TOKEN || "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const TABLE_NAME = "基準風速・積雪量マスタ";

// Lark Bitable フィールド型: 1=テキスト 2=数値 7=チェックボックス
const FIELDS: { name: string; type: number }[] = [
  { name: "県名", type: 1 }, // ← プライマリ（先頭）
  { name: "市・郡・区", type: 1 },
  { name: "区分1", type: 1 },
  { name: "区分2", type: 1 },
  { name: "区分3", type: 1 },
  { name: "基準風速", type: 2 },
  { name: "垂直積雪量", type: 2 },
  { name: "標高計算有無", type: 7 },
  { name: "標高符号", type: 1 },
  { name: "基準標高", type: 2 },
  { name: "積雪算出方法", type: 1 },
  { name: "備考", type: 1 },
];

function client() {
  return new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });
}

async function findTable(c: lark.Client): Promise<string | null> {
  let pageToken: string | undefined;
  do {
    const r: any = await c.bitable.appTable.list({
      path: { app_token: BASE },
      params: { page_size: 100, page_token: pageToken },
    });
    if (r.code !== 0) throw new Error(`appTable.list 失敗: ${r.msg}`);
    for (const t of r.data?.items || []) if (t.name === TABLE_NAME) return t.table_id;
    pageToken = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pageToken);
  return null;
}

async function main() {
  const c = client();

  const existing = await findTable(c);
  if (existing) {
    console.log(`✓ 既存テーブル「${TABLE_NAME}」が見つかりました。`);
    console.log(`  table_id = ${existing}`);
    console.log(`  → lib/lark-tables.ts の KIJUN_FUSOKU フォールバックに設定してください。`);
    return;
  }

  // 先頭フィールドのみでテーブル作成（プライマリ=県名 text）
  console.log(`テーブル「${TABLE_NAME}」を作成します...`);
  const created: any = await c.bitable.appTable.create({
    path: { app_token: BASE },
    data: { table: { name: TABLE_NAME, default_view_name: "一覧", fields: [{ field_name: FIELDS[0].name, type: FIELDS[0].type }] } },
  });
  if (created.code !== 0) throw new Error(`appTable.create 失敗: ${created.msg}`);
  const tableId = created.data?.table_id as string;
  console.log(`  作成しました table_id = ${tableId}`);

  // 残りのフィールドを追加
  for (const f of FIELDS.slice(1)) {
    const r: any = await c.bitable.appTableField.create({
      path: { app_token: BASE, table_id: tableId },
      data: { field_name: f.name, type: f.type as any },
    });
    if (r.code !== 0) throw new Error(`フィールド作成失敗 (${f.name}): ${r.msg}`);
    console.log(`  + フィールド「${f.name}」(type=${f.type})`);
  }

  console.log(`\n✅ 完了。table_id = ${tableId}`);
  console.log(`   → lib/lark-tables.ts の KIJUN_FUSOKU フォールバックに設定してください。`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
