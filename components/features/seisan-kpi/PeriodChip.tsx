import { KPI_NAVY } from "./colors";

/**
 * 期/経過月数の表示チップ(各画面ヘッダ共通)。
 * 例: 「50期 / 経過 9ヶ月」。elapsed 省略時は「50期」。
 */
export function PeriodChip({ period, elapsed }: { period: number | string; elapsed?: number }) {
  return (
    <span style={{ background: KPI_NAVY, color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>
      {period}期{elapsed != null ? ` / 経過 ${elapsed}ヶ月` : ""}
    </span>
  );
}
