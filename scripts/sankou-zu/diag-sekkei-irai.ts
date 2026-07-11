/**
 * 設計依頼集計テーブル(別base)の中身を確認する診断スクリプト。
 * 参考図台帳ダッシュボードで「全体設計依頼数」が表示されない切り分け用。
 * 実行: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sankou-zu/diag-sekkei-irai.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getBaseRecords, getTableFields } from "../../lib/lark-client";
import {
  SEKKEI_IRAI_BASE,
  SEKKEI_IRAI_TABLE,
  SEKKEI_IRAI_YM_FIELD,
  SEKKEI_IRAI_COUNT_FIELD,
} from "../../lib/lark-tables";

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}

async function main() {
  console.log(`base=${SEKKEI_IRAI_BASE} table=${SEKKEI_IRAI_TABLE}`);
  console.log(`YM_FIELD="${SEKKEI_IRAI_YM_FIELD}" COUNT_FIELD="${SEKKEI_IRAI_COUNT_FIELD}"`);

  try {
    const fres: any = await getTableFields(SEKKEI_IRAI_TABLE, SEKKEI_IRAI_BASE);
    const fields = (fres.data?.items || []).map((f: any) => `${f.field_name}(type=${f.type})`);
    console.log(`\nフィールド一覧(${fields.length}):`);
    for (const f of fields) console.log(`  - ${f}`);
  } catch (e: any) {
    console.error("getTableFields 失敗:", e?.message || e);
  }

  const rows: any[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const res: any = await getBaseRecords(SEKKEI_IRAI_TABLE, { baseToken: SEKKEI_IRAI_BASE, pageSize: 500, pageToken });
      for (const it of res.data?.items || []) rows.push(it);
      pageToken = res.data?.has_more ? res.data?.page_token : undefined;
    } while (pageToken);
  } catch (e: any) {
    console.error("getBaseRecords 失敗:", e?.message || e);
    return;
  }

  console.log(`\n総行数: ${rows.length}`);
  let ok = 0, bad = 0;
  for (const r of rows.slice(0, 30)) {
    const f = r.fields || {};
    const ymRaw = f[SEKKEI_IRAI_YM_FIELD];
    const ym = textOf(ymRaw).trim().replace(/\//g, "-");
    const valid = /^\d{4}-\d{2}$/.test(ym);
    if (valid) ok++; else bad++;
    console.log(`  ym_raw=${JSON.stringify(ymRaw)} -> "${ym}" valid=${valid}  count=${JSON.stringify(f[SEKKEI_IRAI_COUNT_FIELD])}`);
  }
  console.log(`\n先頭30行: valid_ym=${ok} invalid_ym=${bad}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
