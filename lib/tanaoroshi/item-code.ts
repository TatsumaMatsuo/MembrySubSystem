/**
 * 棚卸: 品番の正規化・検証（純関数・依存なし）
 *
 * Phase 0 実測: 品番は全1,699件が英数字6文字固定・接頭辞衝突ゼロ。
 * Code 39 はチェックディジットが無いため、この書式検証が truncation 誤読への主防御になる。
 */
export function normalizeItemCode(raw: string): string | null {
  if (!raw) return null;
  // ① Code 39 の start/stop 文字(*)を除去
  let c = raw.trim().replace(/^\*+|\*+$/g, "");
  // ② 大文字化・全角→半角
  c = c.toUpperCase().replace(/[Ａ-Ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  // ③ 書式検証: 英数字6文字固定
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  return c;
}
