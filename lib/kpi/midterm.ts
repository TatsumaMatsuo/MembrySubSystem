/**
 * 中期経営計画トラジェクトリ(docs/kpi-system/04_api-design.md §2.9 / 07_kpi-layering.md)
 *
 * 起点(開始期の値) → 終点(終了期のKGI)を直線按分(線形補間)。
 * 各期は個別上書き可。複数中計を並存でき、任意スパン(3カ年に限定しない)。
 *
 * 例: 50→52期 ROA 8→13% なら { 50:8, 51:10.5, 52:13 }
 */

/**
 * 線形補間で各期の年度目標を生成する。
 * @param startPeriod 開始期
 * @param startValue  開始期の値(起点)
 * @param endPeriod   終了期
 * @param endTarget   終了期のKGI(終点)
 */
export function midtermTrajectory(
  startPeriod: number,
  startValue: number,
  endPeriod: number,
  endTarget: number
): Record<number, number> {
  if (endPeriod < startPeriod) {
    throw new Error("endPeriod は startPeriod 以上である必要があります");
  }
  const out: Record<number, number> = {};
  const span = endPeriod - startPeriod;
  if (span === 0) {
    out[startPeriod] = endTarget;
    return out;
  }
  for (let p = startPeriod; p <= endPeriod; p++) {
    out[p] = startValue + ((endTarget - startValue) * (p - startPeriod)) / span;
  }
  return out;
}

/** 中計の到達度(=最新年度実績 ÷ 最終目標) */
export function midtermAttainment(latestActual: number, finalTarget: number): number {
  return finalTarget === 0 ? 0 : latestActual / finalTarget;
}
