import type { Judgment, Effect } from "@/lib/kpi";

/** 判定(緑/黄/赤)の表示色。全画面で共通の正(Excel/設計準拠) */
export const JUDGMENT_COLORS: Record<Judgment, string> = {
  緑: "#16a34a",
  黄: "#d97706",
  赤: "#dc2626",
};

/** 施策の効果(改善/横ばい/悪化)の表示色 */
export const EFFECT_COLORS: Record<Effect, string> = {
  改善: "#16a34a",
  横ばい: "#64748b",
  悪化: "#dc2626",
};

/** ブランド色(生産本部KPI ヘッダ等) */
export const KPI_NAVY = "#1f3864";
export const KPI_GOLD = "#eab308";
