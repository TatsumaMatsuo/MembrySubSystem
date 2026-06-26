/**
 * 標高依存積雪 算出エンジン(lib/kijun-fusoku-snow.ts)の検証ツール。
 *
 *   npx tsx scripts/kijun-fusoku/validate-snow.ts [--verbose]
 *
 * Lark「基準風速・積雪量マスタ」の標高依存行(標高計算有無=true)を読み、各行の
 * 計算パターンID＋定数1〜6＋基準値(基準標高)＋積雪量(垂直積雪量) で computeSnow を
 * 標高スイープ評価し、
 *   - 算出可否（auto/manual）件数とパターン別内訳
 *   - 標高に対する単調非減少性（積雪は標高とともに増えるはず）
 *   - 妥当域
 * を検査する。投入後の整合性確認・式テンプレートの評価バグ検出が目的。
 */
import { getBaseRecords, getLarkBaseToken } from "../../lib/lark-client";
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F } from "../../lib/lark-tables";
import { computeSnow } from "../../lib/kijun-fusoku-snow";
import { PATTERN_FORMULAS, PATTERN_COUNT } from "../../lib/kijun-fusoku-patterns";

const verbose = process.argv.includes("--verbose");

const txt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
};
const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = Number(txt(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

interface Row { label: string; pid: string; consts: (number | null)[]; base: number | null; snow: number | null; }

async function loadElevRows(): Promise<Row[]> {
  const tableId = getLarkTables().KIJUN_FUSOKU;
  const baseToken = getLarkBaseToken();
  if (!tableId) throw new Error("KIJUN_FUSOKU テーブルID未設定");
  const out: Row[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const f = it.fields || {};
      if (f[F.elev_flag] !== true) continue;
      out.push({
        label: [f[F.ken], f[F.shi], f[F.k1], f[F.k2], f[F.k3]].map(txt).filter(Boolean).join(" "),
        pid: txt(f[F.pattern_id]).trim(),
        consts: [F.const1, F.const2, F.const3, F.const4, F.const5, F.const6].map((k) => num(f[k])),
        base: num(f[F.elev_base]),
        snow: num(f[F.snow]),
      });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

async function main() {
  console.log(`=== 標高依存積雪 算出エンジン検証（Lark実データ） ===`);
  console.log(`  式テンプレート: ${PATTERN_COUNT} 種\n`);
  const rows = await loadElevRows();
  const elevs = [0, 5, 10, 30, 50, 80, 120, 200, 300, 400, 500, 700, 900, 1100, 1300, 1500];

  let withPid = 0, noPid = 0, autoOK = 0, manualWithPid = 0;
  const failByPid = new Map<string, number>();
  const nonMono: string[] = [];
  const manualSamples: string[] = [];
  const noPidSamples: string[] = [];
  const unused = new Set(Object.keys(PATTERN_FORMULAS));

  for (const row of rows) {
    if (!row.pid) { noPid++; if (noPidSamples.length < 10) noPidSamples.push(row.label); continue; }
    withPid++;
    unused.delete(row.pid);
    const probe = row.base ?? 300;
    const rep = computeSnow({ patternId: row.pid, consts: row.consts, base: row.base, snow: row.snow }, probe);
    if (rep.kind === "auto") autoOK++;
    else {
      manualWithPid++;
      failByPid.set(row.pid, (failByPid.get(row.pid) || 0) + 1);
      if (manualSamples.length < 25) manualSamples.push(`${row.pid} | ${row.label} | 定数=[${row.consts.join(",")}] 基準=${row.base} 積雪=${row.snow}`);
    }
    let prev = -Infinity, mono = true;
    for (const e of elevs) {
      const res = computeSnow({ patternId: row.pid, consts: row.consts, base: row.base, snow: row.snow }, e);
      if (res.cm == null) continue;
      if (res.cm < prev - 0.5) { mono = false; break; }
      prev = res.cm;
    }
    if (!mono && nonMono.length < 25) nonMono.push(`${row.pid} | ${row.label}`);
  }

  console.log(`標高依存行: ${rows.length}`);
  console.log(`  パターンIDあり: ${withPid}`);
  console.log(`  パターンIDなし: ${noPid}`);
  console.log(`  → auto算出OK : ${autoOK}  (${withPid ? ((autoOK / withPid) * 100).toFixed(2) : 0}%)`);
  console.log(`  → manual(算出不可): ${manualWithPid}`);
  console.log(`  非単調(標高↑で積雪↓)疑い: ${nonMono.length}`);
  console.log(`  未使用パターン: ${unused.size} (${[...unused].join(",") || "なし"})`);

  if (failByPid.size) {
    console.log(`\n=== manual になったパターン別件数 ===`);
    for (const [k, v] of [...failByPid.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}  式: ${PATTERN_FORMULAS[k]}`);
  }
  if (manualSamples.length) { console.log(`\n=== manual サンプル ===`); manualSamples.forEach((m) => console.log("  " + m)); }
  if (noPidSamples.length) { console.log(`\n=== パターンIDなし サンプル ===`); noPidSamples.forEach((m) => console.log("  " + m)); }
  if (nonMono.length) { console.log(`\n=== 非単調 サンプル ===`); nonMono.forEach((m) => console.log("  " + m)); }

  if (verbose) {
    console.log(`\n=== パターン別 標高→積雪(cm)（各パターン先頭行: 0/100/300/500/800/1200m） ===`);
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.pid || seen.has(row.pid)) continue;
      seen.add(row.pid);
      const vals = [0, 100, 300, 500, 800, 1200].map((e) => {
        const r = computeSnow({ patternId: row.pid, consts: row.consts, base: row.base, snow: row.snow }, e);
        return r.cm == null ? "—" : String(r.cm);
      });
      console.log(`  ${row.pid} [${row.label.slice(0, 18)}] => ${vals.join(" / ")}`);
    }
  }

  console.log(`\n${manualWithPid === 0 && nonMono.length === 0 ? "✅ 全パターンID行が確定算出・単調性OK" : "⚠️ 上記の要確認あり"}`);
}

main().catch((e) => { console.error("[fatal]", e?.response?.data || e?.message || e); process.exit(1); });
