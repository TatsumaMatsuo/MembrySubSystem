/**
 * メンバーシップタイプの型定義
 */
export type MembershipType = "internal" | "external" | "contractor";

/**
 * 売約情報の型定義
 */
export interface BaiyakuInfo {
  record_id: string;
  seiban: string;
  hinmei: string;
  hinmei2?: string;
  tantousha: string;
  juchu_date?: string;
  juchu_kingaku?: number;
  sekou_start_date?: number;
  tokuisaki_atena1?: string;
  tokuisaki_atena2?: string;
}

/**
 * 顧客要求事項変更履歴の型定義
 */
export interface CustomerRequest {
  record_id: string;
  seiban: string;
  shinsei_date: number;
  youkyuu_kubun: string;
  honbun: string;
}

/**
 * 品質改善リクエストの型定義
 */
export interface QualityIssue {
  record_id: string;
  seiban: string;
  hassei_date: number;
  hakken_busho: string;
  kiin_busho: string;
  fuguai_title: string;
  fuguai_honbun: string;
}

/**
 * 案件書庫の型定義
 */
export interface ProjectDocument {
  record_id: string;
  seiban: string;
  document_type: string;
  department: string;
  file_attachment?: LarkAttachment[];
  updated_at?: number;
  version?: number;
}

/**
 * Lark添付ファイルの型定義
 */
export interface LarkAttachment {
  file_token: string;
  name: string;
  size: number;
  type: string;
  tmp_url?: string;
  url?: string;
}

/**
 * 検索パラメータの型定義
 */
export interface SearchParams {
  seiban?: string;
  tantousha?: string;
  anken_name?: string;
  tokuisaki?: string;
  juchu_date_from?: string;
  juchu_date_to?: string;
}

/**
 * 部署名の型定義
 */
export type DepartmentName = "営業部" | "設計部" | "製造部" | "工務課";

/**
 * メニュー項目の型定義
 */
export type MenuItemType =
  | "customer-requests"
  | "quality-issues"
  | "gantt-chart"
  | "documents";

/**
 * ガントチャート工程の型定義
 */
export interface GanttTask {
  id: string;
  name: string;
  department: DepartmentName;
  start_date: number;
  end_date: number;
  progress: number;
  color: string;
}

/**
 * ガントチャートデータの型定義
 */
export interface GanttChartData {
  seiban: string;
  tasks: GanttTask[];
  start_date: number;
  end_date: number;
}
