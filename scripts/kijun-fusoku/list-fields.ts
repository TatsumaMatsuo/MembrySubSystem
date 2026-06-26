/** 基準風速・積雪量マスタ の現在のフィールド一覧を出力（名称・型の確認用）。
 *   npx tsx scripts/kijun-fusoku/list-fields.ts
 */
import { getTableFields, getLarkBaseToken } from "../../lib/lark-client";
import { getLarkTables } from "../../lib/lark-tables";

async function main() {
  const tableId = getLarkTables().KIJUN_FUSOKU;
  if (!tableId) throw new Error("KIJUN_FUSOKU テーブルID未設定");
  const baseToken = getLarkBaseToken();
  const res: any = await getTableFields(tableId, baseToken);
  const fields = res?.data?.items || res?.items || [];
  console.log(`table_id=${tableId}  フィールド数=${fields.length}\n`);
  for (const f of fields) {
    console.log(`  ${String(f.type).padStart(4)}  「${f.field_name}」`);
  }
}
main().catch((e) => { console.error("[fatal]", e?.response?.data || e?.message || e); process.exit(1); });
