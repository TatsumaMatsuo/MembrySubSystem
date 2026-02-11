/**
 * Lark Base テーブルID定義
 */

// AWS Amplify SSR では環境変数にアクセスできない場合があるため、フォールバック値を設定
const FALLBACK_BASE_TOKEN = "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const FALLBACK_BASE_TOKEN_MASTER = "J09zbrPDxa5QR8sEgU9jqLlxpxg";

export type BaseType = "project" | "master";

export function getLarkTables() {
  return {
    // 売約情報テーブル
    BAIYAKU: process.env.LARK_TABLE_BAIYAKU || "tbl1ICzfUixpGqDy",
    // 顧客要求事項変更履歴テーブル
    CUSTOMER_REQUESTS: process.env.LARK_TABLE_CUSTOMER_REQUESTS || "tblY4Xh2gRFtieW4",
    // 品質改善リクエストテーブル
    QUALITY_ISSUES: process.env.LARK_TABLE_QUALITY_ISSUES || "tblLKAcEaleuCrMB",
    // 案件書庫テーブル
    PROJECT_DOCUMENTS: process.env.LARK_TABLE_PROJECT_DOCUMENTS || "tblHdcIy11FwCLCE",
    // 更新履歴テーブル
    DOCUMENT_HISTORY: process.env.LARK_TABLE_DOCUMENT_HISTORY || "tblOi19V3t3XO2Te",
    // 工事仕様書テーブル
    CONSTRUCTION_SPEC: process.env.LARK_TABLE_CONSTRUCTION_SPEC || "tbl1ICzfUixpGqDy",
    // 社員マスタテーブル
    EMPLOYEES: process.env.LARK_TABLE_EMPLOYEES || "tblXpm1d05ovRf1y",
    // 機能マスタテーブル
    FEATURE_MASTER: process.env.LARK_TABLE_FEATURE_MASTER || "tbloM14bI5lBJCgT",
    // ユーザー権限テーブル
    USER_PERMISSIONS: process.env.LARK_TABLE_USER_PERMISSIONS || "tbl0qPqlC88kaUeZ",
    // 全社KPIテーブル
    COMPANY_KPI: process.env.LARK_TABLE_COMPANY_KPI || "tbliC8ZdNr5deQ5h",
    // クイズマスタテーブル
    QUIZ_MASTER: process.env.LARK_TABLE_QUIZ_MASTER || "tbl5Od0bDQEHG3Wm",
    // クイズ回答履歴テーブル
    QUIZ_ANSWER_HISTORY: process.env.LARK_TABLE_QUIZ_ANSWER_HISTORY || "tblBuHepIBi5YlfT",
    // 営業部KPIテーブル
    SALES_KPI: process.env.LARK_TABLE_SALES_KPI || "",
    // コピー経費テーブル
    COPY_EXPENSE: process.env.LARK_TABLE_COPY_EXPENSE || "tblAewkgMf7ZmEUv",
    // 事業所マスタテーブル
    OFFICES: process.env.LARK_TABLE_OFFICES || "tbl1S12KMGhVW91p",
  };
}

/**
 * テーブルごとのBase設定
 * - project: 案件情報用Base (LARK_BASE_TOKEN)
 * - master: マスタ用Base (LARK_BASE_TOKEN_MASTER)
 */
export const TABLE_BASE_CONFIG: Record<string, BaseType> = {
  // 案件情報用Base
  BAIYAKU: "project",
  CUSTOMER_REQUESTS: "project",
  QUALITY_ISSUES: "project",
  PROJECT_DOCUMENTS: "project",
  DOCUMENT_HISTORY: "project",
  CONSTRUCTION_SPEC: "project",
  // マスタ用Base
  EMPLOYEES: "master",
  FEATURE_MASTER: "master",
  USER_PERMISSIONS: "master",
  // プロジェクトBase
  COMPANY_KPI: "project",
  // クイズ関連（プロジェクトBase）
  QUIZ_MASTER: "project",
  QUIZ_ANSWER_HISTORY: "project",
  // 営業部KPI（プロジェクトBase）
  SALES_KPI: "project",
  // コピー経費（プロジェクトBase）
  COPY_EXPENSE: "project",
  // 事業所マスタ（プロジェクトBase）
  OFFICES: "project",
};

/**
 * テーブル名からBaseトークンを取得
 */
export function getBaseTokenForTable(tableName: keyof typeof TABLE_BASE_CONFIG): string {
  const baseType = TABLE_BASE_CONFIG[tableName] || "project";
  if (baseType === "master") {
    return process.env.LARK_BASE_TOKEN_MASTER || FALLBACK_BASE_TOKEN_MASTER;
  }
  return process.env.LARK_BASE_TOKEN || FALLBACK_BASE_TOKEN;
}

/**
 * マスタ用Baseトークンを取得
 */
export function getLarkBaseTokenMaster(): string {
  return process.env.LARK_BASE_TOKEN_MASTER || FALLBACK_BASE_TOKEN_MASTER;
}

/**
 * 売約情報テーブルのフィールド定義
 */
export const BAIYAKU_FIELDS = {
  seiban: "製番",
  tantousha: "担当者",
  hinmei: "品名",
  hinmei2: "品名2",
  juchu_date: "受注日",
  juchu_kingaku: "受注金額",
  sekou_start_date: "施工開始日",
  tokuisaki_atena1: "得意先宛名1",
  tokuisaki_atena2: "得意先宛名2",
  uriagezumi_flag: "売上済フラグ",
  sakujo_flag: "削除フラグ",
} as const;

/**
 * 顧客要求事項変更履歴テーブルのフィールド定義
 */
export const CUSTOMER_REQUEST_FIELDS = {
  seiban: "製番",
  shinsei_date: "申請日",
  youkyuu_kubun: "要求区分",
  honbun: "本文",
} as const;

/**
 * 品質改善リクエストテーブルのフィールド定義
 */
export const QUALITY_ISSUE_FIELDS = {
  seiban: "製番",
  hassei_date: "発生日",
  hakken_busho: "発見部署",
  kiin_busho: "起因部署",
  fuguai_title: "不具合タイトル",
  fuguai_honbun: "不具合本文",
} as const;

/**
 * 案件書庫テーブルのフィールド定義
 */
export const PROJECT_DOCUMENT_FIELDS = {
  seiban: "製番",
  document_type: "書類種別",
  department: "部署",
  file_attachment: "添付ファイル",
  updated_at: "更新日時",
  version: "バージョン",
} as const;

/**
 * 更新履歴テーブルのフィールド定義
 */
export const DOCUMENT_HISTORY_FIELDS = {
  seiban: "製番",
  document_type: "書類種別",
  operation_type: "操作種別",
  file_name: "ファイル名",
  operator: "操作者",
  operated_at: "操作日時",
  notes: "備考",
  before_image: "変更前",
  after_image: "変更後",
} as const;

/**
 * 社員マスタテーブルのフィールド定義
 */
export const EMPLOYEE_FIELDS = {
  employee_id: "社員コード",
  employee_name: "社員名",
  member: "社員名 (メンバー )",
  email: "社員名 (メンバー ).仕事用メールアドレス",
  department: "社員名 (メンバー ).部署",
  retired_flag: "退職者フラグ",
} as const;

/**
 * 部署別書類カテゴリ定義
 */
export const DOCUMENT_CATEGORIES = {
  営業部: ["見積書", "見積根拠", "原価明細書", "売約表紙", "注文書"],
  設計部: [
    "地盤調査",
    "製作図",
    "副資材リスト",
    "切板リスト",
    "ミルシート",
    "現場工程写真",
    "検査済証",
    "確認済証",
    "消防書類",
    "申請図書",
  ],
  製造部: [
    "鉄骨製作要領書",
    "膜製作要領書",
    "検査証",
    "鉄骨製作工程写真",
    "縫製製作工程写真",
    "鋼材リスト",
    "ボルトリスト",
  ],
  工務課: ["施工要領書", "施工計画書", "安全書類"],
} as const;

/**
 * 機能マスタテーブルのフィールド定義
 */
export const FEATURE_MASTER_FIELDS = {
  feature_id: "機能ID",
  feature_name: "機能名",
  menu_group: "所属メニューグループ",
  feature_type: "機能タイプ",
  parent_feature_id: "親機能ID",
  sort_order: "表示順",
  description: "機能説明",
  is_active: "有効フラグ",
} as const;

/**
 * ユーザー権限テーブルのフィールド定義
 */
export const USER_PERMISSION_FIELDS = {
  permission_id: "権限ID",
  user_email: "ユーザーメール",
  user_name: "ユーザー名",
  feature_id: "対象機能",
  permission_level: "権限レベル",
  granted_by: "付与者",
  granted_at: "付与日時",
  expires_at: "有効期限",
  notes: "備考",
} as const;

/**
 * 権限レベル定義
 */
export const PERMISSION_LEVELS = {
  edit: "編集",
  view: "表示のみ",
  hidden: "非表示",
} as const;

/**
 * メニューグループ定義
 */
export const MENU_GROUPS = [
  "共通",
  "総務部",
  "営業部",
  "設計部",
  "製造部",
  "生産管理部",
  "工務課",
  "運輸部",
  "システムハウス",
  "マスタ",
] as const;

/**
 * 機能タイプ定義
 */
export const FEATURE_TYPES = {
  menu: "menu",
  feature: "feature",
  action: "action",
} as const;

/**
 * 全社KPIテーブルのフィールド定義
 */
export const COMPANY_KPI_FIELDS = {
  // 基本情報
  period: "期",
  // 売上目標
  sales_target: "売上目標",
  monthly_sales_target: "月次売上目標",
  // 損益計算書ベース
  cost_of_sales: "売上原価目標",
  cost_of_sales_rate: "売上原価率",
  sga_expenses: "販管費目標",
  sga_rate: "販管費率",
  operating_income: "営業利益目標",
  operating_income_rate: "営業利益率",
  // 限界利益ベース
  variable_cost: "変動費目標",
  variable_cost_rate: "変動費率",
  marginal_profit: "限界利益目標",
  marginal_profit_rate: "限界利益率",
  fixed_cost: "固定費目標",
  fixed_cost_rate: "固定費率",
  ordinary_income: "経常利益目標",
  ordinary_income_rate: "経常利益率",
  // 製造・外注
  manufacturing_cost_rate: "製造原価率目標",
  execution_budget_rate: "実行予算率目標",
  outsourcing_rate: "外注発注率目標",
  // その他計画
  headcount_plan: "人員計画",
  capital_investment: "設備投資計画",
  advertising_budget: "広告販促費",
  // 備考
  notes: "備考",
} as const;

/**
 * クイズマスタテーブルのフィールド定義
 */
export const QUIZ_MASTER_FIELDS = {
  quiz_id: "クイズID",
  question: "問題文",
  choice_a: "選択肢A",
  choice_b: "選択肢B",
  choice_c: "選択肢C",
  correct_answer: "正解",
  explanation: "解説",
  category: "カテゴリ",
  is_active: "有効フラグ",
} as const;

/**
 * クイズ回答履歴テーブルのフィールド定義
 */
export const QUIZ_ANSWER_HISTORY_FIELDS = {
  user_email: "ユーザーメール",
  user_name: "ユーザー名",
  quiz_id: "クイズID",
  answer_date: "回答日",
  user_answer: "回答",
  is_correct: "正誤",
  points: "獲得ポイント",
  fiscal_period: "期",
  created_at: "作成日時",
} as const;

/**
 * 営業部KPIテーブルのフィールド定義
 */
/**
 * 事業所マスタテーブルのフィールド定義
 */
export const OFFICE_FIELDS = {
  name: "事業所名",
} as const;

/**
 * 営業部KPIテーブルのフィールド定義
 */
export const SALES_KPI_FIELDS = {
  // 基本情報
  period: "期",
  period_start: "期間開始日",
  period_end: "期間終了日",
  // 1. 売上目標
  sales_target: "売上目標",
  monthly_sales_target: "月次売上目標",
  // 2. 粗利目標
  gross_profit_target: "粗利目標",
  gross_profit_rate: "粗利率",
  // 3. テント倉庫売上
  tent_warehouse_units: "テント倉庫販売棟数",
  // 4. 膜構造建築物売上
  membrane_building_sales: "膜構造建築物売上",
  // 5. 畜舎案件売上
  livestock_facility_sales: "畜舎案件売上",
  // 6. 海洋事業製品売上
  marine_sales: "海洋事業製品売上",
  // 7. レンタルテント売上
  rental_tent_sales: "レンタルテント売上",
  // 8. WEB新規問い合わせ
  web_inquiries_yearly: "WEB問合せ年間件数",
  web_inquiries_monthly: "WEB問合せ月間件数",
  web_order_amount: "WEB受注金額",
  // 9. セールスフォースAランク顧客
  a_rank_customer_target: "Aランク顧客目標",
  a_rank_per_sales_rep: "営業1人あたりAランク目標",
  a_rank_condition: "Aランク条件",
  // 10. 品質目標
  claim_limit_yearly: "クレーム上限件数",
  // 備考
  notes: "備考",
} as const;
