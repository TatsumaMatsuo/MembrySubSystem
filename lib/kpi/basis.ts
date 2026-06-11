/**
 * 基礎データ算出KPI(docs/kpi-system/04_api-design.md §2.5)
 *
 * 会計データ(KAIKEI_ACTUAL)から累計ベースで率を算出する。
 * 会計データは本部長が一括入力し、生産本部Lv2(粗利率等)も同じデータを参照(二重入力なし)。
 *
 * Excel実値(50期・経過8ヶ月の基礎データ)で検証:
 *  - 粗利率:       Σ売上3749.2 / Σ原価2862.5 → 0.23650...(23.65%)
 *  - 材料金額比率: Σ材料683.5 / Σ原価2862.5 → 0.23877...(23.88%)
 */

/** 月次の会計勘定値(百万円など、単位は呼び出し側で統一) */
export interface BasisMonth {
  fiscalMonth: number; // 1..12
  sales?: number; // 売上高
  cost?: number; // 製造原価
  assets?: number; // 総資産(直近月値を使用)
  material?: number; // 材料金額
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

function within(rows: BasisMonth[], elapsed: number): BasisMonth[] {
  return rows.filter((r) => r.fiscalMonth <= elapsed);
}

/** 粗利率 = Σ(売上高 − 製造原価) / Σ売上高 */
export function grossProfitRate(rows: BasisMonth[], elapsed: number): number {
  const r = within(rows, elapsed);
  const sales = sum(r.map((x) => x.sales ?? 0));
  const cost = sum(r.map((x) => x.cost ?? 0));
  return sales === 0 ? 0 : (sales - cost) / sales;
}

/** 材料金額比率 = Σ材料金額 / Σ製造原価 */
export function materialRate(rows: BasisMonth[], elapsed: number): number {
  const r = within(rows, elapsed);
  const material = sum(r.map((x) => x.material ?? 0));
  const cost = sum(r.map((x) => x.cost ?? 0));
  return cost === 0 ? 0 : material / cost;
}

/**
 * 総資産回転率 = 売上高(年換算) / 直近総資産
 *
 * ⚠️ 年換算の定義(累計/経過月×12 か 直近×12)は Excel 数式の確認が必要。
 *    docs/kpi-system/04_api-design.md ❓2(M-02 算出値 0.858 と整合する定義を採用)。
 *    既定は「累計÷経過月×12」で実装。
 */
export function assetTurnover(rows: BasisMonth[], elapsed: number): number {
  const r = within(rows, elapsed);
  const salesCum = sum(r.map((x) => x.sales ?? 0));
  const annualized = elapsed === 0 ? 0 : (salesCum / elapsed) * 12;
  const latestAssets = [...r]
    .reverse()
    .find((x) => x.assets != null && x.assets !== 0)?.assets;
  return latestAssets ? annualized / latestAssets : 0;
}
