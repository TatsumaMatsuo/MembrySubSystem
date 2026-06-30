/**
 * 参考図台帳 利用状況(イベント情報) テーブル tblCPZFOU4bBStJw の「年月」を全て YYYY-MM に正規化する。
 *
 * 対応する入力ゆれ:
 *   2026/6, 2026/06, 2026-6, 2026.6, 2026年6月, 20266(=2026-06推定不可は除外), Date(タイムスタンプ) 等 → 2026-06
 *
 * 実行:
 *   既定 dry-run(変更予定のみ表示): npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sankou-zu/fix-usage-ym.ts
 *   実書込:                          npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sankou-zu/fix-usage-ym.ts --execute
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getLarkBaseToken, getBaseRecords, updateBaseRecord, getTableFields } from "../../lib/lark-client";

const TABLE_ID = "tblCPZFOU4bBStJw";
const YM_FIELD = "年月";
const EXECUTE = process.argv.includes("--execute");

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}

/** 任意の年月表現を YYYY-MM へ。判定不能は null。 */
function normalizeYM(v: any): string | null {
  // Lark 日付フィールド(数値ミリ秒)対応
  if (typeof v === "number" && v > 1e11) {
    const d = new Date(v + 9 * 60 * 60 * 1000); // JST
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const s = textOf(v).trim();
  if (!s) return null;
  // 既に YYYY-MM
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  // YYYY/MM, YYYY.MM, YYYY MM 区切り
  m = s.match(/^(\d{4})[\/.\s年](\d{1,2})月?日?$/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${m[1]}-${String(mo).padStart(2, "0")}`;
  }
  // YYYY-MM-DD / YYYY/MM/DD など先頭の年月だけ採用
  m = s.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月]/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${m[1]}-${String(mo).padStart(2, "0")}`;
  }
  // YYYYMM(6桁)
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${m[1]}-${m[2]}`;
  }
  return null;
}

async function main() {
  const baseToken = getLarkBaseToken();
  console.log(`base=${baseToken} table=${TABLE_ID} mode=${EXECUTE ? "EXECUTE" : "dry-run"}`);

  // フィールド型確認
  const fres: any = await getTableFields(TABLE_ID, baseToken);
  const fld = (fres.data?.items || []).find((f: any) => f.field_name === YM_FIELD);
  if (!fld) throw new Error(`フィールド「${YM_FIELD}」が見つかりません`);
  console.log(`フィールド「${YM_FIELD}」 type=${fld.type}`); // 1=テキスト, 5=日付 等

  // 全行取得
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(TABLE_ID, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) rows.push(it);
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  console.log(`総行数: ${rows.length}`);

  let changed = 0, already = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const raw = r.fields?.[YM_FIELD];
    const cur = textOf(raw);
    const norm = normalizeYM(raw);
    if (norm == null) {
      console.warn(`  [SKIP] 判定不能 record=${r.record_id} value=${JSON.stringify(raw)}`);
      skipped++;
      continue;
    }
    if (cur === norm) { already++; continue; }
    console.log(`  [FIX ] ${JSON.stringify(cur)} -> ${norm}  (record=${r.record_id})`);
    changed++;
    if (EXECUTE) {
      const up: any = await updateBaseRecord(TABLE_ID, r.record_id, { [YM_FIELD]: norm }, { baseToken });
      if (up.code !== 0) { console.error(`    更新失敗 code=${up.code} msg=${up.msg}`); failed++; changed--; }
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`  既に YYYY-MM : ${already}`);
  console.log(`  ${EXECUTE ? "更新" : "更新予定"} : ${changed}`);
  console.log(`  判定不能(skip): ${skipped}`);
  if (failed) console.log(`  失敗         : ${failed}`);
  if (!EXECUTE && changed) console.log(`\n--execute を付けて実書込してください。`);
}

main().catch((e) => { console.error(e); process.exit(1); });
