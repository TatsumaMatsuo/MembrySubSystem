/**
 * 達成判定(緑/黄/赤) — docs/kpi-system/04_api-design.md §2.4 / 00_運用ガイド
 *
 * **正本は Excel**。全型を「達成率(高いほど良い)」に正規化し、
 *   緑: 達成率 ≥ 0.95
 *   黄: 達成率 ≥ 0.80
 *   赤: それ未満
 * を適用する。この閾値・モデルは Excel `判定` 列の実値(約20指標)と一致を確認済み:
 *   M-03(黄/0.90) M-04(緑/1.23) M-30(赤) M-31(赤) M-33(黄/0.875) M-43(黄/0.912)
 *   M-93(赤/0.668) M-101(緑) M-103(緑/0.988) M-112(赤/0.778) M-122(赤) M-123(緑) 等
 * (外注金額 M-94 も「少ない累計」として 0.827→黄 で一致。特例不要)
 */
import { Judgment, KpiMaster, MonthlyActual } from "./types";
import { aggregate, attainmentRate } from "./aggregate";

export interface JudgeInput {
  aggType: KpiMaster["aggType"];
  direction: KpiMaster["direction"];
  annualTarget: number;
  monthlyTarget?: number;
}

/** 達成率の閾値 */
export const JUDGE_GREEN = 0.95;
export const JUDGE_AMBER = 0.8;

/** 達成率から判定する */
export function judgeByRate(rate: number): Judgment {
  if (rate >= JUDGE_GREEN) return "緑";
  if (rate >= JUDGE_AMBER) return "黄";
  return "赤";
}

/**
 * 判定を算出する。
 * @param current 現在値(aggregate() の結果 / 基礎データ算出の率)
 * @param elapsed 経過月数
 */
export function judge(m: JudgeInput, current: number, elapsed: number): Judgment {
  const rate = attainmentRate(
    { aggType: m.aggType, direction: m.direction, annualTarget: m.annualTarget },
    current,
    elapsed
  );
  return judgeByRate(rate);
}

/** 月次実績配列から現在値を集計して判定する便利関数 */
export function judgeFromMonths(
  m: JudgeInput,
  months: MonthlyActual[],
  elapsed: number
): Judgment {
  const current = aggregate(m.aggType, months, elapsed);
  return judge(m, current, elapsed);
}
