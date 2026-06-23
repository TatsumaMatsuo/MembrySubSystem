/**
 * 標高依存地域(標高計算有無=true)の算出パターンを解析する診断スクリプト。
 *   npx tsx scripts/kijun-fusoku/analyze-elev-patterns.ts
 *
 * 標高符号(T)・基準標高(U)・積雪算出方法(W)・備考 の分布を集計し、
 * v2(標高→積雪算出)の算出ロジック設計に必要なパターンを洗い出す。
 */
import { getBaseRecords, getLarkBaseToken } from "../../lib/lark-client";
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F } from "../../lib/lark-tables";

function txt(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}
function num(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(txt(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const tableId = getLarkTables().KIJUN_FUSOKU;
  const baseToken = getLarkBaseToken();
  if (!tableId) throw new Error("KIJUN_FUSOKU テーブルID未設定");

  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) rows.push(it.fields || {});
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);

  console.log(`総レコード: ${rows.length}`);
  const elev = rows.filter((f) => f[F.elev_flag] === true);
  const fixed = rows.filter((f) => f[F.elev_flag] !== true);
  console.log(`標高依存(elev=true): ${elev.length}`);
  console.log(`固定値(elev=false): ${fixed.length}`);
  console.log(`固定値で積雪空: ${fixed.filter((f) => num(f[F.snow]) == null).length}`);
  console.log(`標高依存で積雪に値あり: ${elev.filter((f) => num(f[F.snow]) != null).length}\n`);

  // フィールド充足
  const has = (f: any, k: string) => txt(f[k]).trim() !== "";
  console.log(`=== 標高依存 ${elev.length}行 のフィールド充足 ===`);
  console.log(`  標高符号(T)あり : ${elev.filter((f) => has(f, F.elev_sign)).length}`);
  console.log(`  基準標高(U)あり : ${elev.filter((f) => num(f[F.elev_base]) != null).length}`);
  console.log(`  積雪算出方法(W)あり: ${elev.filter((f) => has(f, F.elev_method)).length}`);
  console.log(`  備考あり        : ${elev.filter((f) => has(f, F.note)).length}\n`);

  const tally = (vals: string[]) => {
    const m = new Map<string, number>();
    for (const v of vals) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log(`=== 標高符号(T) 値分布 ===`);
  for (const [v, c] of tally(elev.map((f) => txt(f[F.elev_sign]).trim() || "(空)"))) console.log(`  ${c.toString().padStart(5)}  「${v}」`);

  console.log(`\n=== 基準標高(U) 値分布(上位20) ===`);
  for (const [v, c] of tally(elev.map((f) => (num(f[F.elev_base]) != null ? String(num(f[F.elev_base])) : "(空)"))).slice(0, 20))
    console.log(`  ${c.toString().padStart(5)}  ${v}`);

  console.log(`\n=== 積雪算出方法(W) 値分布(上位40・全文) ===`);
  const wTally = tally(elev.map((f) => txt(f[F.elev_method]).trim() || "(空)"));
  console.log(`  異なるW値の種類: ${wTally.length}`);
  for (const [v, c] of wTally.slice(0, 40)) console.log(`  ${c.toString().padStart(5)}  「${v}」`);

  console.log(`\n=== 備考 値分布(上位30) ===`);
  for (const [v, c] of tally(elev.map((f) => txt(f[F.note]).trim() || "(空)")).slice(0, 30))
    console.log(`  ${c.toString().padStart(5)}  「${v.slice(0, 80)}」`);

  // T/U/W の組合せパターン(符号+基準有無+方法有無)
  console.log(`\n=== T/U/W 充足パターン ===`);
  const pat = tally(
    elev.map((f) => {
      const t = txt(f[F.elev_sign]).trim() ? "T" : "-";
      const u = num(f[F.elev_base]) != null ? "U" : "-";
      const w = txt(f[F.elev_method]).trim() ? "W" : "-";
      return `${t}${u}${w}`;
    })
  );
  for (const [v, c] of pat) console.log(`  ${c.toString().padStart(5)}  [${v}]`);

  // 代表サンプル: 各Wパターンの1行
  console.log(`\n=== 代表サンプル(符号+基準標高+方法 が揃う先頭10行) ===`);
  const samples = elev
    .filter((f) => txt(f[F.elev_sign]).trim() && num(f[F.elev_base]) != null)
    .slice(0, 10);
  for (const f of samples) {
    console.log(
      `  ${txt(f[F.ken])} ${txt(f[F.shi])} ${txt(f[F.k1])} | 符号「${txt(f[F.elev_sign])}」基準${num(f[F.elev_base])}m | 方法「${txt(f[F.elev_method])}」| 備考「${txt(f[F.note]).slice(0, 40)}」`
    );
  }
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e?.message || e);
  process.exit(1);
});
