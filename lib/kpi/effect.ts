/**
 * 施策の効果 自動判定(docs/kpi-system/02_data-model.md §2.6 / 04_api-design.md §2.7)
 *
 * 対象KPI実績の変化と方向から効果を提示(改善/横ばい/悪化)。
 * システムが自動判定 → 責任者が確定(手動上書き可)。
 *
 * 基準:
 *  - 改善: 基準値(or前月)より良い方向に5%以上 改善、または判定ランク上昇(赤→黄→緑)
 *  - 横ばい: 変化が±5%以内、かつ判定ランク変わらず
 *  - 悪化: 良い方向と逆に5%以上、または判定ランク低下
 */
import { Direction, Effect, Judgment, judgeRank } from "./types";

const DEFAULT_THRESHOLD = 0.05;

export interface AutoEffectInput {
  direction: Direction;
  /** 比較の基準値(施策開始時の基準値 or 前月実績) */
  baseValue: number;
  /** 当月の対象KPI実績 */
  monthValue: number;
  /** 比較基準時点の判定(任意) */
  prevJudge?: Judgment;
  /** 当月の判定(任意) */
  curJudge?: Judgment;
  /** 変化率の閾値(既定5%) */
  threshold?: number;
}

export function autoEffect(input: AutoEffectInput): Effect {
  const th = input.threshold ?? DEFAULT_THRESHOLD;
  const { direction, baseValue, monthValue } = input;

  // 良い方向の変化率
  let better: number;
  if (baseValue === 0) {
    better = monthValue === 0 ? 0 : direction === "高い方が良い" ? 1 : -1;
  } else {
    better =
      direction === "高い方が良い"
        ? (monthValue - baseValue) / Math.abs(baseValue)
        : (baseValue - monthValue) / Math.abs(baseValue);
  }

  const rankUp =
    input.prevJudge != null &&
    input.curJudge != null &&
    judgeRank(input.curJudge) > judgeRank(input.prevJudge);
  const rankDown =
    input.prevJudge != null &&
    input.curJudge != null &&
    judgeRank(input.curJudge) < judgeRank(input.prevJudge);

  if (better >= th || rankUp) return "改善";
  if (better <= -th || rankDown) return "悪化";
  return "横ばい";
}
