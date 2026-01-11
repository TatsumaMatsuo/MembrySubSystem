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
  before_image?: LarkAttachment[];
  after_image?: LarkAttachment[];
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
  | "cost-analysis"
  | "documents";

/**
 * 原価分析データの型定義
 */
export interface CostAnalysisData {
  seiban: string;
  summary: {
    sales_amount: number;       // 売上金額
    total_planned_cost: number; // 予定原価合計
    total_actual_cost: number;  // 実績原価合計
    planned_profit: number;     // 予定利益
    actual_profit: number;      // 実績利益
    planned_profit_rate: number; // 予定利益率
    actual_profit_rate: number;  // 実績利益率
  };
  categories: CostCategory[];   // 科目別原価
}

export interface CostCategory {
  category: string;             // 科目名
  planned_cost: number;         // 予定原価
  actual_cost: number;          // 実績原価
  difference: number;           // 差異
  cost_ratio: number;           // 原価比率（実績ベース）
  [key: string]: string | number; // Rechartsとの互換性のためのインデックスシグネチャ
}

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


// ========================================
// メニュー権限システム（新）
// ========================================

/**
 * メニュー表示マスタの型定義
 */
export interface MenuDisplayMaster {
  record_id: string;
  menu_id: string;           // メニューID（例: M001, M001-01）
  menu_name: string;         // メニュー名
  level: number;             // 階層レベル（1 or 2）
  parent_menu_id?: string;   // 親メニューID（第2階層のみ）
  sort_order: number;        // 表示順
  icon?: string;             // lucide-reactアイコン名
  is_active: boolean;        // 有効フラグ
}

/**
 * 機能配置マスタの型定義
 */
export interface FunctionPlacementMaster {
  record_id: string;
  program_id: string;        // プログラムID（例: PGM001）
  program_name: string;      // プログラム名称
  menu_id: string;           // 配置メニューID（第2階層）
  url_path: string;          // URLパス（例: /upload/order-backlog）
  sort_order: number;        // 表示順
  description?: string;      // 説明
  is_active: boolean;        // 有効フラグ
}

/**
 * 権限対象種別
 */
export type PermissionTargetType = "menu" | "program";

/**
 * グループ権限マスタの型定義
 */
export interface GroupPermissionMaster {
  record_id: string;
  group_id: string;          // LarkグループID
  group_name: string;        // グループ名
  target_type: PermissionTargetType; // 対象種別
  target_id: string;         // メニューID or プログラムID
  is_allowed: boolean;       // 許可フラグ
  updated_at?: number;       // 更新日時
}

/**
 * 個別権限マスタの型定義
 */
export interface UserPermissionMaster {
  record_id: string;
  employee_id: string;       // 社員ID
  employee_name: string;     // 社員名
  target_type: PermissionTargetType; // 対象種別
  target_id: string;         // メニューID or プログラムID
  is_allowed: boolean;       // 許可フラグ
  updated_at?: number;       // 更新日時
}

/**
 * メニュー構造（階層付き）
 */
export interface MenuStructure {
  menu: MenuDisplayMaster;
  children: MenuDisplayMaster[];
  programs: FunctionPlacementMaster[];
}

/**
 * 権限付きメニュー構造
 */
export interface PermittedMenuStructure {
  menu: MenuDisplayMaster;
  children: {
    menu: MenuDisplayMaster;
    programs: FunctionPlacementMaster[];
  }[];
}

/**
 * ユーザー権限情報
 */
export interface UserMenuPermissions {
  employee_id: string;
  employee_name: string;
  group_ids: string[];
  permitted_menus: string[];      // 許可されたメニューID
  permitted_programs: string[];   // 許可されたプログラムID
  denied_menus: string[];         // 明示的に拒否されたメニューID
  denied_programs: string[];      // 明示的に拒否されたプログラムID
  source: "user" | "group";       // 権限ソース
}
