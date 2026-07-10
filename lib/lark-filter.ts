/**
 * Lark Bitable フィルタ式の文字列リテラル用エスケープ。
 *
 * `CurrentValue.[フィールド] = "${値}"` のように値を式へ連結する際、
 * ユーザー入力に含まれる `"` でフィルタ条件を改変される(式インジェクション)のを防ぐ。
 * ダブルクォート/バックスラッシュをエスケープし、改行は空白へ無害化する。
 *
 * 使用例: `CurrentValue.[製番] = "${escapeLarkFilterValue(seiban)}"`
 */
export function escapeLarkFilterValue(v: unknown): string {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ");
}
