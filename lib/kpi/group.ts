/**
 * グループ集計(M:N) — docs/kpi-system/04_api-design.md §2.8
 *
 * グループは所属部署(GROUP_MEMBER)の値を集計するレンズ。
 * 累計/件数系 → 合算、率/平均系 → 平均。
 * 1部署が複数グループに重複所属する場合は各グループで重複計上(表示)。
 * 実績は部署単位で1回登録され、グループ表示時に参照する(複製なし)。
 */
import { AggType } from "./types";

/** 集計タイプが合算系(累計)か平均系(平均/直近/率)か */
export function isCumulative(aggType: AggType): boolean {
  return aggType === "累計";
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

/**
 * 所属部署の値を集計タイプに応じて合算/平均する。
 * @param values 所属部署それぞれの現在値
 */
export function aggregateGroup(aggType: AggType, values: number[]): number {
  return isCumulative(aggType) ? sum(values) : avg(values);
}
