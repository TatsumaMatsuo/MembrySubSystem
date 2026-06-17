/**
 * 生産本部KPIマネジメントシステム — 算出ユーティリティ 型定義
 *
 * 設計: docs/kpi-system/04_api-design.md §2
 *
 * Excel(`50期生産本部KPIマスタ.xlsx`)を仕様の正本とし、その計算式を純関数へ移植する。
 * 判定/★/効果/集計はサーバ(API)とクライアント(即時判定)で共有する。
 */

/** 集計タイプ(Excel 07_KPIマスタ「集計タイプ」) */
export type AggType = "累計" | "平均" | "直近月値" | "基礎データ算出";

/** 良い方向(Excel「良い方向」) */
export type Direction = "高い方が良い" | "少ない方が良い";

/** 達成判定(緑/黄/赤) */
export type Judgment = "緑" | "黄" | "赤";

/** 施策の効果 */
export type Effect = "改善" | "横ばい" | "悪化";

/** 会計データの入力粒度 */
export type Granularity = "月" | "四半期" | "半期" | "年";

/**
 * KPIマスタ(算出に必要な最小項目)
 */
export interface KpiMaster {
  kpiId: string;
  aggType: AggType;
  direction: Direction;
  /** 年間目標 */
  annualTarget: number;
  /** 月次目標換算(月割) */
  monthlyTarget: number;
  /**
   * 進捗率/判定の比較モード上書き。
   * 既定は集計タイプ×方向で決まるが、外注金額など特例KPIは "外注" を指定する。
   * (詳細は docs/kpi-system/04_api-design.md §2.3 / 00_運用ガイド)
   */
  compareMode?: "default" | "外注";
}

/**
 * 月次実績(縦持ち1件 = 1KPI×1会計月)
 * fiscalMonth: 1..12 (8月=1, 翌7月=12)
 */
export interface MonthlyActual {
  fiscalMonth: number;
  value: number | null;
}

/** 判定ランク(赤<黄<緑)。効果のランク比較に使用 */
export function judgeRank(j: Judgment): number {
  return j === "緑" ? 2 : j === "黄" ? 1 : 0;
}
