/**
 * computeSnow() を全標高依存行に対して検証する。
 *   npx tsx scripts/kijun-fusoku/test-snow-calc.ts
 *
 * 各行を複数の標高(50/150/300/500/800m)で算出し、
 *  - 自動算出できた行数(coverage)
 *  - 値が単調非減少か（標高が上がって積雪が減る式=要警戒）
 *  - 妥当域外/異常値の検出
 * を報告し、未対応の算出方法フォーマット上位を出力する。
 */
import { getBaseRecords, getLarkBaseToken } from "../../lib/lark-client";
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F } from "../../lib/lark-tables";
import { computeSnow, normalizeMethod } from "../../lib/kijun-fusoku-snow";

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
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId!, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) rows.push(it.fields || {});
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);

  const elev = rows.filter((f) => f[F.elev_flag] === true);
  const ELEVS = [50, 150, 300, 500, 800];

  let autoRows = 0;
  let nonMonotonic = 0;
  const unsupported = new Map<string, number>();
  const samplesAuto: string[] = [];
  const weird: string[] = [];
  const nonMono: string[] = [];

  for (const f of elev) {
    const input = {
      sign: txt(f[F.elev_sign]),
      base: num(f[F.elev_base]),
      method: txt(f[F.elev_method]),
      note: txt(f[F.note]),
    };
    const results = ELEVS.map((h) => computeSnow(input, h));
    const anyAuto = results.some((r) => r.kind === "auto");
    if (anyAuto) {
      autoRows++;
      // 単調性チェック（標高↑で積雪↓は通常おかしい。階段/式の境界は除く緩め判定）
      const vals = results.map((r) => r.cm);
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] != null && vals[i - 1] != null && (vals[i] as number) < (vals[i - 1] as number) - 1) {
          nonMonotonic++;
          if (nonMono.length < 15)
            nonMono.push(
              `${txt(f[F.ken])}${txt(f[F.shi])} | ${results.find((r) => r.kind === "auto")?.basis} | ` +
                ELEVS.map((h, k) => `${h}m→${vals[k] ?? "—"}`).join(" ") +
                ` | 「${input.method.slice(0, 55)}」`
            );
          break;
        }
      }
      if (samplesAuto.length < 14) {
        samplesAuto.push(
          `${txt(f[F.ken])}${txt(f[F.shi])}${txt(f[F.k1])} | ${results[0].basis} | ` +
            ELEVS.map((h, i) => `${h}m→${results[i].cm ?? "—"}`).join(" ")
        );
      }
      // 異常値: 算出済みなのに極端
      for (let i = 0; i < ELEVS.length; i++) {
        const c = results[i].cm;
        if (results[i].kind === "auto" && c != null && (c < 10 || c > 1000)) {
          if (weird.length < 12) weird.push(`${txt(f[F.ken])}${txt(f[F.shi])} ${ELEVS[i]}m→${c}cm 「${input.method.slice(0, 50)}」`);
        }
      }
    } else {
      const key = normalizeMethod(input.method).slice(0, 70) || "(算出方法 空)";
      unsupported.set(key, (unsupported.get(key) || 0) + 1);
    }
  }

  console.log(`標高依存 ${elev.length} 行`);
  console.log(`自動算出できた行: ${autoRows} (${((autoRows / elev.length) * 100).toFixed(1)}%)`);
  console.log(`手動フォールバック: ${elev.length - autoRows}`);
  console.log(`単調非減少でない(標高↑で積雪↓)行: ${nonMonotonic}\n`);

  console.log(`=== 自動算出サンプル ===`);
  samplesAuto.forEach((s) => console.log("  " + s));

  console.log(`\n=== 非単調(標高↑で積雪↓)の行 ===`);
  if (nonMono.length === 0) console.log("  なし");
  nonMono.forEach((s) => console.log("  " + s));

  console.log(`\n=== 異常値(10cm未満 or 1000cm超) ===`);
  if (weird.length === 0) console.log("  なし");
  weird.forEach((s) => console.log("  " + s));

  console.log(`\n=== 未対応フォーマット 上位20 ===`);
  [...unsupported.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, c]) => console.log(`  ${c.toString().padStart(4)}  「${k}」`));
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e?.message || e);
  process.exit(1);
});
