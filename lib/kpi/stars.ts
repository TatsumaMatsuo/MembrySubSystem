/**
 * ★達成評価(docs/kpi-system/04_api-design.md §2.6)
 *
 * - 月間目標達成で★1個(部署ごと・項目ごと)
 * - 年間目標を期末累計で達成すると★+3(期末のみ)
 * - 5S大賞・労災は手入力(STAR_ADJ)
 * - 総合計★ = 自動★ + 期末ボーナス + 手入力調整
 *
 * Excel 04_製造部★達成表 実値で検証:
 *  本社鉄工=24 / 第二鉄工=25 / 北関東鉄工=23 / 本社縫製=25 / 北多久縫製=28 / 北関東縫製=22
 */
import { Direction, MonthlyActual } from "./types";

/** ★対象項目(部署×項目)の月間目標と方向 */
export interface StarItem {
  /** 月間目標(この値を達成で★) */
  monthlyTarget: number;
  direction: Direction;
  /** 12ヶ月の実績(8月=1..翌7月=12)。空欄は value:null */
  months: MonthlyActual[];
  /** 年間目標(期末ボーナス判定用・任意) */
  annualTarget?: number;
}

/** ★手入力調整(5S大賞/労災) */
export interface StarAdjustment {
  delta: number; // 例: +3 / -5
}

/**
 * その月の実績が月間目標を満たすか。
 * @param indirectBlankAsAchieved 間接部門特例(経過月内の空欄も達成扱い)
 */
export function monthlyStar(
  item: Pick<StarItem, "monthlyTarget" | "direction">,
  value: number | null,
  indirectBlankAsAchieved = false
): boolean {
  if (value == null) return indirectBlankAsAchieved;
  return item.direction === "高い方が良い"
    ? value >= item.monthlyTarget
    : value <= item.monthlyTarget;
}

/** 1項目の自動★(経過月内の月間達成数) */
export function itemStars(
  item: StarItem,
  elapsed: number,
  indirectBlankAsAchieved = false
): number {
  let stars = 0;
  for (let fm = 1; fm <= elapsed; fm++) {
    const mv = item.months.find((m) => m.fiscalMonth === fm)?.value ?? null;
    if (monthlyStar(item, mv, indirectBlankAsAchieved)) stars++;
  }
  return stars;
}

/** 部署の自動★合計(全項目の月間★の合計) */
export function deptAutoStars(
  items: StarItem[],
  elapsed: number,
  indirectBlankAsAchieved = false
): number {
  return items.reduce(
    (s, it) => s + itemStars(it, elapsed, indirectBlankAsAchieved),
    0
  );
}

/** 期末ボーナス(年間目標を期末累計で達成した項目ごとに +3) */
export function yearEndBonus(items: StarItem[]): number {
  let bonus = 0;
  for (const it of items) {
    if (it.annualTarget == null) continue;
    const total = it.months.reduce((s, m) => s + (m.value ?? 0), 0);
    const achieved =
      it.direction === "高い方が良い"
        ? total >= it.annualTarget
        : total <= it.annualTarget;
    if (achieved) bonus += 3;
  }
  return bonus;
}

/**
 * 部署の総合計★ = 自動★ + 期末ボーナス(期末のみ) + 手入力調整
 */
export function deptTotalStars(opts: {
  items: StarItem[];
  elapsed: number;
  isPeriodClosed: boolean;
  adjustments?: StarAdjustment[];
  indirectBlankAsAchieved?: boolean;
}): number {
  const auto = deptAutoStars(
    opts.items,
    opts.elapsed,
    opts.indirectBlankAsAchieved ?? false
  );
  const bonus = opts.isPeriodClosed ? yearEndBonus(opts.items) : 0;
  const manual = (opts.adjustments ?? []).reduce((s, a) => s + a.delta, 0);
  return auto + bonus + manual;
}
