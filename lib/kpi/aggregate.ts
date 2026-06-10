/**
 * 集計・進捗率(docs/kpi-system/04_api-design.md §2.2/2.3)
 *
 * Excel実値で検証済みのケース:
 *  - 累計:       M-30 クレーム(年累計1, elapsed9, 月割0) → 進捗率 1.333
 *               M-33 生産量(年間目標687.6, 累計451.1, elapsed9) → 進捗率 0.8747
 *  - 平均(高い): M-35 生産効率(目標25, 平均22.367) → 進捗率 0.8947
 *  - 平均(少ない): M-32 LT(目標9.2, 平均4.856) → 進捗率 1.8947
 *  - 直近月値(少ない): M-93 在庫(目標447,000,000, 直近668,832,492) → 進捗率 0.6683
 */
import { AggType, Direction, KpiMaster, MonthlyActual } from "./types";

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

/** 経過月内の非nullの実績値を取得 */
function valuesUpTo(months: MonthlyActual[], elapsed: number): number[] {
  return months
    .filter((m) => m.fiscalMonth <= elapsed && m.value != null)
    .map((m) => m.value as number);
}

/** 直近(経過月以内で値のある最後の月)の値 */
function lastValue(months: MonthlyActual[], elapsed: number): number {
  const within = months
    .filter((m) => m.fiscalMonth <= elapsed && m.value != null)
    .sort((a, b) => a.fiscalMonth - b.fiscalMonth);
  return within.length ? (within[within.length - 1].value as number) : 0;
}

/**
 * 集計タイプに応じた「現在値」を返す。
 * 基礎データ算出は別途 basis.ts で算出する。
 */
export function aggregate(
  aggType: AggType,
  months: MonthlyActual[],
  elapsed: number
): number {
  switch (aggType) {
    case "累計":
      return sum(valuesUpTo(months, elapsed));
    case "平均":
      return avg(valuesUpTo(months, elapsed));
    case "直近月値":
      return lastValue(months, elapsed);
    case "基礎データ算出":
      throw new Error("基礎データ算出KPIは basis.ts で算出してください");
  }
}

/** 期待ペース(累計の月割合算) = 年間目標 × elapsed/12 */
export function proratedTarget(annualTarget: number, elapsed: number): number {
  return (annualTarget * elapsed) / 12;
}

/**
 * 達成率(高いほど良い、判定の基準)。
 *
 * Excel全型を「達成率(higher=better)」に正規化したもの。判定 §judge は本値に対し
 * 緑≥0.95 / 黄≥0.80 / 赤<0.80 を適用する(Excel約20指標で一致を確認済み)。
 *
 * - 累計(高い方が良い): 現在累計 ÷ 月割合算
 * - 累計/外注(少ない方が良い): 月割合算 ÷ 現在累計  (現在0 → 達成=Infinity)
 * - 平均/直近/基礎算出(高い方が良い): 現在値 ÷ 目標
 * - 平均/直近/基礎算出(少ない方が良い): 目標 ÷ 現在値  (現在0 → Infinity)
 *
 * ⚠️ Excel「進捗率」表示列は型ごとに数式が異なり一貫しない(M-30は現在/ペース=1.333等)。
 *    本関数は判定の基準となる一貫した達成率を返す。表示用の生「進捗率」を厳密再現する
 *    必要があれば別途Excel数式を確認(docs/kpi-system/04_api-design.md ❓1)。
 */
export function attainmentRate(
  master: Pick<KpiMaster, "aggType" | "direction" | "annualTarget">,
  current: number,
  elapsed: number
): number {
  const { aggType, direction, annualTarget } = master;
  const ratio = (n: number, d: number) =>
    d === 0 ? (n === 0 ? 1 : Infinity) : n / d;

  if (direction === "少ない方が良い") {
    if (current === 0) return Infinity; // 件数0等は達成
    const target = aggType === "累計" ? proratedTarget(annualTarget, elapsed) : annualTarget;
    return ratio(target, current);
  }
  // 高い方が良い
  const target = aggType === "累計" ? proratedTarget(annualTarget, elapsed) : annualTarget;
  return ratio(current, target);
}

/** @deprecated 達成率に統一。後方互換のため attainmentRate を返す */
export const progress = attainmentRate;
