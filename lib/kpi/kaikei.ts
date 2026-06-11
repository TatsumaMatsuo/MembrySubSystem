/**
 * 会計データの粒度正規化(docs/kpi-system/04_api-design.md §2.10 / 02_data-model.md §2.0.3)
 *
 * 月/四半期/半期 の混在を「年度累計」に正規化する。
 * 会計年度は8月開始(8月=会計月1 … 翌7月=会計月12)。
 *  - 四半期: Q1=8-10月(1..3) / Q2=11-1月(4..6) / Q3=2-4月(7..9) / Q4=5-7月(10..12)
 *  - 半期:   上期=8-1月(1..6) / 下期=2-7月(7..12)
 *
 * 月別があれば四半期/半期は自動集計(累計)。粗粒度しか無い科目はその粒度で年度累計に算入。
 */
import { Granularity } from "./types";

export interface KaikeiRow {
  granularity: Granularity;
  /** 期間ラベル(月="2025-08" / 四半期="Q1" / 半期="上期") */
  period: string;
  /** その期間の実績値 */
  value: number;
}

/** 四半期ラベル → 会計月レンジ */
const QUARTER_RANGE: Record<string, [number, number]> = {
  Q1: [1, 3],
  Q2: [4, 6],
  Q3: [7, 9],
  Q4: [10, 12],
};
/** 半期ラベル → 会計月レンジ */
const HALF_RANGE: Record<string, [number, number]> = {
  上期: [1, 6],
  下期: [7, 12],
};

/** 月ラベル(YYYY-MM) → 会計月序(8月=1..翌7月=12) */
export function fiscalMonthOf(ym: string): number {
  const m = Number(ym.split("-")[1]);
  // 8月=1, 9=2, ... 12=5, 1=6, ... 7=12
  return ((m - 8 + 12) % 12) + 1;
}

/**
 * 同一科目の混在粒度を年度累計に正規化する。
 * 月別が存在するレンジは月別を優先し、粗粒度は重複算入しない。
 */
export function normalizeKaikei(rows: KaikeiRow[]): number {
  const monthly = rows.filter((r) => r.granularity === "月");
  const monthlyFm = new Set(monthly.map((r) => fiscalMonthOf(r.period)));

  let total = monthly.reduce((s, r) => s + r.value, 0);

  // 四半期: その四半期レンジに月別が1つも無ければ算入
  for (const r of rows.filter((r) => r.granularity === "四半期")) {
    const range = QUARTER_RANGE[r.period];
    if (!range) continue;
    const covered = anyInRange(monthlyFm, range);
    if (!covered) total += r.value;
  }
  // 半期: そのレンジに月別・四半期が無ければ算入
  const quarterCoveredFm = coveredFiscalMonths(rows);
  for (const r of rows.filter((r) => r.granularity === "半期")) {
    const range = HALF_RANGE[r.period];
    if (!range) continue;
    const covered = anyInRange(quarterCoveredFm, range);
    if (!covered) total += r.value;
  }
  return total;
}

function anyInRange(fmSet: Set<number>, [lo, hi]: [number, number]): boolean {
  for (let fm = lo; fm <= hi; fm++) if (fmSet.has(fm)) return true;
  return false;
}

/** 月別+四半期がカバーする会計月の集合 */
function coveredFiscalMonths(rows: KaikeiRow[]): Set<number> {
  const set = new Set<number>();
  for (const r of rows) {
    if (r.granularity === "月") set.add(fiscalMonthOf(r.period));
    if (r.granularity === "四半期") {
      const range = QUARTER_RANGE[r.period];
      if (range) for (let fm = range[0]; fm <= range[1]; fm++) set.add(fm);
    }
  }
  return set;
}
