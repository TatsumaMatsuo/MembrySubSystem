import type { Judgment } from "@/lib/kpi";
import { JUDGMENT_COLORS } from "./colors";

/**
 * 達成判定バッジ(緑/黄/赤)。全画面共通。
 * size: "sm"(一覧の小型) / "md"(既定)
 */
export function JudgmentBadge({ judgment, size = "md" }: { judgment: Judgment; size?: "sm" | "md" }) {
  const dims = size === "sm"
    ? { fontSize: 10, padding: "2px 8px" }
    : { fontSize: 11, padding: "2px 9px" };
  return (
    <span
      style={{
        display: "inline-block",
        fontWeight: 700,
        borderRadius: 999,
        color: "#fff",
        background: JUDGMENT_COLORS[judgment],
        ...dims,
      }}
    >
      {judgment}
    </span>
  );
}
