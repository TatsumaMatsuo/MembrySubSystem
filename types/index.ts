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
  | "baiyaku-detail"
  | "customer-requests"
  | "quality-issues"
  | "gantt-chart"
  | "cost-analysis"
  | "construction-detail"
  | "documents";

/**
 * 売約詳細情報の型定義
 */
export interface BaiyakuDetail {
  seiban: string;
  juchu_denpyo_no: string;
  juchu_kenmei: string;
  tantousha: string;
  bumon: string;
  tokuisaki: {
    name1: string;
    name2: string;
    postal_code: string;
    address: string;
    tel: string;
    fax: string;
  };
  nounyusaki: {
    name1: string;
    name2: string;
    postal_code: string;
    address: string;
    tel: string;
  };
  juchu_date: string;
  hinmei: string;
  hinmei2: string;
  juchu_suryo: number | null;
  juchu_tani: string;
  juchu_tanka: number | null;
  juchu_kingaku: number | null;
  yotei_arariritsu: number | null;
  nouki: string;
  uriage_mikomi_date: string;
  maguchi_size: number | null;
  keta_size: number | null;
  takasa: number | null;
  tateya_area: number | null;
  tekkotsu_juryo: number | null;
  maku_area: number | null;
  maku_shiyou: string;
  tosou_shiyou: string;
  yotei_tekko_jikan: number | null;
  yotei_housei_jikan: number | null;
  yotei_seizu_jikan: number | null;
  yotei_sekou_ninzu: number | null;
  yotei_sekou_nissu: number | null;
}

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

/**
 * 工事仕様書の型定義
 */
export interface ConstructionSpec {
  // 基本情報
  seiban: string;                    // 受注製番
  seiban_name: string;               // 製番名
  form_number: string;               // フォーム番号
  issue_date: string;                // 発行日・版数
  created_date: string;              // 作成日
  sales_person: string;              // 営業担当者
  issue_department: string;          // 発行部署

  // 基礎工事
  foundation: {
    jurisdiction: string;            // 所掌（所掌/所掌外）
    order_status: string;            // 発注状況
    order_destination: string;       // 発注先
    foundation_type: string;         // 基礎工事種別（布基礎等）
    floor_work: boolean;             // 土間工事有無
    comment: string;                 // コメント
  };

  // アンカー関連
  anchor: {
    bolt_jurisdiction: string;       // アンカーボルト所掌
    bolt_type: string;               // ボルト種別
    template_production: boolean;    // テンプレート製作有無
    template_count: number;          // テンプレート製作枚数
    anchor_set_jurisdiction: string; // アンカーセット所掌
  };

  // 運搬・梱包
  transportation: {
    jurisdiction: string;            // 所掌
    ten_ton_available: boolean;      // 10t搬入可否
    transport_method: string;        // 運搬方法
    ten_ton_count: number;           // 10t台数
    four_ton_count: number;          // 4t台数
    comment: string;
  };

  // 現場施工
  site_construction: {
    jurisdiction: string;
    existing_building_work: boolean; // 既設建物との取合工事
    crane_jurisdiction: string;      // 建て方重機所掌
    crane_tonnage: number;           // 重機t数
    crane_count_per_day: number;     // 台数/日
    crane_days: number;              // 日数
    crane_comment: string;
    work_vehicle_jurisdiction: string; // 作業車所掌
    work_vehicle_type: string;       // 作業車種別
    work_vehicle_count_per_day: number;
    work_vehicle_days: number;
    work_vehicle_comment: string;
  };

  // 現場環境
  site_environment: {
    vehicle_space: boolean;          // 車両スペース有無
    heavy_equipment_space: boolean;  // 重機設置スペース有無
    vehicle_space_comment: string;
    obstacle: boolean;               // 車両スペース障害物
    obstacle_comment: string;
    power_available: boolean;        // 電源の貸与可否
    power_comment: string;
    ground_condition: string;        // 地面状況
    ground_comment: string;
    entry_education: boolean;        // 入場教育必要
    morning_meeting: boolean;        // 朝礼有無
    morning_meeting_time: string;    // 朝礼時刻
    floor_exists: boolean;           // 土間の有無
    floor_protection: boolean;       // 土間養生必要
    floor_protection_area: number;   // 養生㎡数
    logo_required: boolean;          // ロゴマーク貼付
  };

  // 電気工事
  electrical: {
    jurisdiction: string;
    primary_work: string;            // 1次工事
    secondary_work: string;          // 2次工事
    lighting_work: string;           // 照明工事
    order_status: string;
    order_destination: string;
    comment: string;
  };

  // 消防設備
  fire_protection: {
    jurisdiction: string;
    order_status: string;
    order_destination: string;
    comment: string;
  };

  // 張替
  replacement: {
    previous_membrane: string;       // 張替前膜材
    previous_replacement_date: string; // 前回張替日
  };

  // 特記事項
  special_notes: {
    production_notes: string;        // 製作について特記
    steel_frame_notes: string;       // 鉄骨製作について
    membrane_notes: string;          // 膜製作について
    plating_required: boolean;       // メッキ塗装について
    membrane_type: string;           // 膜種類（例: クローザーV3）
    construction_notes: string;      // 施工について特記
    other_notes: string;             // その他特記事項
  };

  // 準備品
  preparation: {
    items: string;                   // 準備品
    comment: string;
  };

  // 提出書類
  documents: {
    project_name: string;            // 工事名称
    confirmation_required: boolean;  // 確認申請
    application_creation: boolean;   // 申請書作成
    application_submission: boolean; // 申請書提出
    drawing_creation: boolean;       // 申請図面作成
    calculation_creation: boolean;   // 計算書作成
    fire_procedure_jurisdiction: string; // 消防手続き所掌
    mill_sheet_required: boolean;    // ミルシートおよび出荷証明書
    steel_required: boolean;         // 鋼材
    raw_material_required: boolean;  // 原反
    material_required: boolean;      // 資材
    plating_test_report_required: boolean; // メッキ試験報告書
    main_contractor: string;         // 元請け名
    designer: string;                // 設計者
    steel_frame_category: boolean;   // 鉄骨製作区分
    steel_frame_manual: boolean;     // 鉄骨製作要領書
    membrane_category: boolean;      // 膜製作区分
    membrane_manual: boolean;        // 膜製作要領書
    construction_manual: boolean;    // 施工要領書
    construction_plan: boolean;      // 施工計画書
    photo_required: boolean;         // 工程写真
    steel_production_photo: boolean; // 鉄骨製作工程
    membrane_production_photo: boolean; // 膜製作工程
    site_construction_photo: boolean; // 現場施工工程
    constructor: string;             // 施工者
    factory_inspection: boolean;     // 工場立会
    non_destructive: boolean;        // 非破壊
    coating_thickness: boolean;      // 塗装膜厚
    safety_documents: boolean;       // 安全書類
    contract_type: string;           // 工事請負
    subcontract_level: number;       // 請負何次
    work_category: string;           // 工事種別
    safety_document_format: string;  // 安全書類書式
    submission_method: string;       // 提出方法
    submission_count: number;        // 提出部数
    submission_deadline: string;     // 提出期限
  };
}
