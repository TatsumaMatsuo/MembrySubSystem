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
 * 操作種別の型定義
 */
export type OperationType = "追加" | "差替" | "削除";

/**
 * 更新履歴の型定義
 */
export interface DocumentHistory {
  record_id: string;
  seiban: string;
  document_type: string;
  operation_type: OperationType;
  file_name: string;
  operator: string;
  operated_at: number;
  notes?: string;
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

/**
 * 社員マスタの型定義
 */
export interface Employee {
  record_id: string;
  社員コード: string;
  社員名: string;
  メールアドレス: string;
  部署?: string;
}

/**
 * 権限レベルの型定義
 */
export type PermissionLevel = "edit" | "view" | "hidden";

/**
 * メニューグループの型定義
 */
export type MenuGroup =
  | "共通"
  | "総務部"
  | "営業部"
  | "設計部"
  | "製造部"
  | "生産管理部"
  | "工務課"
  | "運輸部"
  | "システムハウス"
  | "マスタ";

/**
 * 機能タイプの型定義
 */
export type FeatureType = "menu" | "feature" | "action";

/**
 * 機能マスタの型定義
 */
export interface FeatureMaster {
  record_id: string;
  機能ID: string;
  機能名: string;
  所属メニューグループ: MenuGroup;
  機能タイプ: FeatureType;
  親機能ID?: string;
  表示順: number;
  機能説明?: string;
  有効フラグ: boolean;
}

/**
 * ユーザー権限の型定義
 */
export interface UserPermission {
  record_id: string;
  権限ID?: string;
  ユーザーメール: string;
  ユーザー名: string;
  対象機能: string[];  // リンクフィールド
  権限レベル: PermissionLevel;
  付与者?: string;
  付与日時?: number;
  有効期限?: number;
  備考?: string;
}

/**
 * ロールマスタの型定義
 */
export interface RoleMaster {
  record_id: string;
  ロールID: string;
  ロール名: string;
  説明?: string;
  有効フラグ: boolean;
}

/**
 * ロール権限の型定義
 */
export interface RolePermission {
  record_id: string;
  ロール: string[];  // リンクフィールド
  対象機能: string[];  // リンクフィールド
  権限レベル: PermissionLevel;
}

/**
 * ユーザーロールの型定義
 */
export interface UserRole {
  record_id: string;
  ユーザーメール: string;
  割当ロール: string[];  // リンクフィールド
  割当日?: number;
}

/**
 * 権限チェック結果の型定義
 */
export interface PermissionCheckResult {
  featureId: string;
  level: PermissionLevel;
  canEdit: boolean;
  canView: boolean;
  isHidden: boolean;
}
