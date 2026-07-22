/**
 * Lark Base テーブルID定義
 */

// Base token は amplify.yml 経由で .env.production に書き出され SSR ランタイムへ渡る。
// 実値のソース埋め込み(fallback)は情報露出になるため撤去(env必須化)。
// 未設定は設定不備=fail-loud(実行時throw)で早期検知する。
function requireBaseToken(name: "LARK_BASE_TOKEN" | "LARK_BASE_TOKEN_MASTER"): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`[lark-tables] 環境変数 ${name} が未設定です(env必須化)`);
  }
  return v;
}

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
    SALES_KPI: process.env.LARK_TABLE_SALES_KPI || "tblnTpa3k7yrMTPt",
    // コピー経費テーブル
    COPY_EXPENSE: process.env.LARK_TABLE_COPY_EXPENSE || "tblAewkgMf7ZmEUv",
    // 事業所マスタテーブル
    OFFICES: process.env.LARK_TABLE_OFFICES || "tbl1S12KMGhVW91p",
    // 社内工程表テーブル
    SCHEDULE: process.env.LARK_TABLE_SCHEDULE || "tblhhTgv5ynrkFjN",
    // 基準風速・積雪量マスタ（営業: 基準風速/垂直積雪量 検索の参照データ。project base）
    KIJUN_FUSOKU: process.env.LARK_TABLE_KIJUN_FUSOKU || "tblHMXBoYkXWGk4t",
    // 参考図台帳検索（営業: Access 参考図.accdb 移行）。Lark UIで手動作成済（project base）。
    SANKOU_DAICHO: process.env.LARK_TABLE_SANKOU_DAICHO || "tblB8WpT3dOIGwfj",
    SANKOU_BUHIN: process.env.LARK_TABLE_SANKOU_BUHIN || "tbliF60cCLGAP66v",
    // 参考図汎用マスタ（部材以外の★候補。区分/値/表示順/有効フラグ。project base）
    SANKOU_HANYOU: process.env.LARK_TABLE_SANKOU_HANYOU || "tbl9MGRMMHGNXFUU",
    // 建屋区分マスタ（建屋分類/建屋区分コード/建屋区分名称。参考図の建屋区分絞り込み候補。project base）
    SANKOU_KENYA: process.env.LARK_TABLE_SANKOU_KENYA || "tblRVvbUrUddNFEb",
    // 参考図台帳 利用状況（年月×担当者で 起動回数/情報取得回数 を集計。project base）
    SANKOU_USAGE: process.env.LARK_TABLE_SANKOU_USAGE || "tblCPZFOU4bBStJw",

    // ===== 生産本部KPIシステム(docs/kpi-system) =====
    // --- 経営レイヤー(L0/L1) ※全社年度KPIは既存 COMPANY_KPI を流用 ---
    // 経営_中期経営計画ヘッダ
    KEIEI_MIDTERM_PLAN_HEADER:
      process.env.LARK_TABLE_KEIEI_MIDTERM_PLAN_HEADER || "tbl0mRIrdu5CNXJg",
    // 経営_中期経営計画明細
    KEIEI_MIDTERM_PLAN:
      process.env.LARK_TABLE_KEIEI_MIDTERM_PLAN || "tbls3w16SRX4KQRn",
    // 経営_会計データ実績
    KAIKEI_ACTUAL: process.env.LARK_TABLE_KAIKEI_ACTUAL || "tbloZgcbsFls9LWt",
    // --- 生産本部レイヤー(L2) ---
    // 生産KPI_KPIマスタ
    SEISAN_KPI_MASTER:
      process.env.LARK_TABLE_SEISAN_KPI_MASTER || "tblCiDxUsOEM05Tc",
    // 生産KPI_期マスタ
    SEISAN_KPI_PERIOD:
      process.env.LARK_TABLE_SEISAN_KPI_PERIOD || "tblseheBISHZKGnh",
    // 生産KPI_グループマスタ
    SEISAN_KPI_GROUP:
      process.env.LARK_TABLE_SEISAN_KPI_GROUP || "tbleQOhwn9RkOXcK",
    // 生産KPI_グループ所属(M:N)
    SEISAN_KPI_GROUP_MEMBER:
      process.env.LARK_TABLE_SEISAN_KPI_GROUP_MEMBER || "tblRQcbFM1fxP5Wa",
    // 生産KPI_月次実績
    SEISAN_KPI_ACTUAL:
      process.env.LARK_TABLE_SEISAN_KPI_ACTUAL || "tbl3X8Xe8r1BoXnU",
    // 生産KPI_施策
    SEISAN_KPI_MEASURE:
      process.env.LARK_TABLE_SEISAN_KPI_MEASURE || "tblMfqKPv02mwBYd",
    // 生産KPI_施策月次PDCA
    SEISAN_KPI_PDCA: process.env.LARK_TABLE_SEISAN_KPI_PDCA || "tblFsaKWU4cum2ki",
    // 生産KPI_★達成調整
    SEISAN_KPI_STAR_ADJ:
      process.env.LARK_TABLE_SEISAN_KPI_STAR_ADJ || "tblxdNl1zAzyid2U",
    // 生産KPI_過去実績
    SEISAN_KPI_HISTORY:
      process.env.LARK_TABLE_SEISAN_KPI_HISTORY || "tblWjZkAUGXaZVH0",
    // 生産KPI_変更履歴
    SEISAN_KPI_AUDIT: process.env.LARK_TABLE_SEISAN_KPI_AUDIT || "tblEgJOw2uxKOVUf",
    // 現場作業日報システム（project base）
    NIPPOU: process.env.LARK_TABLE_NIPPOU || "tbl428UNr7jZbN5D",
    NIPPOU_ANKEN: process.env.LARK_TABLE_NIPPOU_ANKEN || "tblH486vHdn7mixz",
    // 工事写真台帳_設定（#94 台帳作成の下書き状態を製番ごとに保存。project base）
    // 環境変数 or 実行時に名称「工事写真台帳設定」でテーブルIDを自動解決（route側）。
    KOJI_LEDGER_SETTINGS: process.env.LARK_TABLE_KOJI_LEDGER_SETTINGS || "tbl2gxbdiu0oJl3o",
    // ガントチャート機能（#95 営業部支援ツール。project base）
    GANTT_CHART: process.env.LARK_TABLE_GANTT_CHART || "tblZu9auJGP1Jsbn",
    GANTT_TEMPLATE: process.env.LARK_TABLE_GANTT_TEMPLATE || "tbljLtonssQbpHAx",
    // ===== 棚卸入力Webアプリ（project base）=====
    // 参照（既存・基幹からの月次アップロード先）
    TANAOROSHI_STOCK: process.env.LARK_TABLE_TANAOROSHI_STOCK || "tblFG23F6WgRPr5a", // システム在庫情報
    TANAOROSHI_RESULT: process.env.LARK_TABLE_TANAOROSHI_RESULT || "tbl8pCg48KRx8710", // 棚卸在庫情報(基幹取込レイアウト)
    // 新規（docs/tanaoroshi/table-spec.md に従い Lark UI で手動作成。IDは env 必須）
    TANAOROSHI_PERIOD: process.env.LARK_TABLE_TANAOROSHI_PERIOD || "",
    TANAOROSHI_WH_STATUS: process.env.LARK_TABLE_TANAOROSHI_WH_STATUS || "",
    TANAOROSHI_ENTRY: process.env.LARK_TABLE_TANAOROSHI_ENTRY || "",
    TANAOROSHI_DIFF: process.env.LARK_TABLE_TANAOROSHI_DIFF || "",
    TANAOROSHI_REASON: process.env.LARK_TABLE_TANAOROSHI_REASON || "",
    TANAOROSHI_AUDIT: process.env.LARK_TABLE_TANAOROSHI_AUDIT || "",
  };
}

/** 工事写真台帳_設定 テーブル名（IDが未設定のとき名称でテーブルIDを解決するのに使う） */
export const KOJI_LEDGER_SETTINGS_TABLE_NAME = "工事写真台帳設定";

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
  // 社内工程表（プロジェクトBase）
  SCHEDULE: "project",
  // 基準風速・積雪量マスタ（プロジェクトBase）
  KIJUN_FUSOKU: "project",
  // 参考図台帳検索（プロジェクトBase）
  SANKOU_DAICHO: "project",
  SANKOU_BUHIN: "project",
  SANKOU_HANYOU: "project",
  SANKOU_USAGE: "project",
  // ===== 生産本部KPIシステム（全て project base） =====
  KEIEI_MIDTERM_PLAN_HEADER: "project",
  KEIEI_MIDTERM_PLAN: "project",
  KAIKEI_ACTUAL: "project",
  SEISAN_KPI_MASTER: "project",
  SEISAN_KPI_PERIOD: "project",
  SEISAN_KPI_GROUP: "project",
  SEISAN_KPI_GROUP_MEMBER: "project",
  SEISAN_KPI_ACTUAL: "project",
  SEISAN_KPI_MEASURE: "project",
  SEISAN_KPI_PDCA: "project",
  SEISAN_KPI_STAR_ADJ: "project",
  SEISAN_KPI_HISTORY: "project",
  SEISAN_KPI_AUDIT: "project",
  // 現場作業日報システム
  NIPPOU: "project",
  NIPPOU_ANKEN: "project",
  // 工事写真台帳_設定
  KOJI_LEDGER_SETTINGS: "project",
  // ガントチャート機能
  GANTT_CHART: "project",
  GANTT_TEMPLATE: "project",
  // 棚卸入力Webアプリ（全て project base）
  TANAOROSHI_STOCK: "project",
  TANAOROSHI_RESULT: "project",
  TANAOROSHI_PERIOD: "project",
  TANAOROSHI_WH_STATUS: "project",
  TANAOROSHI_ENTRY: "project",
  TANAOROSHI_DIFF: "project",
  TANAOROSHI_REASON: "project",
  TANAOROSHI_AUDIT: "project",
};

/**
 * 棚卸テーブルIDの取得（未設定なら明示的に落とす）
 * 新規6テーブルは Lark UI で手動作成するためソース内フォールバックを持たない。
 * env 未設定のまま動くと「空文字のtable_id」で不可解なAPIエラーになるため、ここで止める。
 */
export function requireTanaoroshiTable(
  key:
    | "TANAOROSHI_PERIOD"
    | "TANAOROSHI_WH_STATUS"
    | "TANAOROSHI_ENTRY"
    | "TANAOROSHI_DIFF"
    | "TANAOROSHI_REASON"
    | "TANAOROSHI_AUDIT"
): string {
  const id = getLarkTables()[key];
  if (!id) {
    throw new Error(
      `環境変数 LARK_TABLE_${key} が未設定です。docs/tanaoroshi/table-spec.md に従いテーブルを作成し、` +
        `npx tsx scripts/verify-tanaoroshi-tables.ts で取得したIDを設定してください。`
    );
  }
  return id;
}

/**
 * ガントチャートテーブルのフィールド定義（#95）
 * 作成者=テキスト(実ユーザー名を書込)、作成日時/更新日時=日付(epoch ms書込)。
 */
export const GANTT_CHART_FIELDS = {
  chart_id: "チャートID",
  title: "題名",
  seiban: "売約番号",
  data_json: "データJSON",
  created_by: "作成者", // テキスト。作成時に実ユーザー名
  created_at: "作成日時", // 日付。作成時のepoch ms
  updated_at: "更新日時", // 日付。更新時のepoch ms
} as const;

/**
 * ガントひな型テーブルのフィールド定義（#95）
 * 更新者=テキスト、更新日時=日付。
 */
export const GANTT_TEMPLATE_FIELDS = {
  template_id: "ひな型ID",
  name: "ひな型名",
  category: "分類",
  is_active: "有効フラグ",
  data_json: "データJSON",
  updated_by: "更新者", // テキスト
  updated_at: "更新日時", // 日付。epoch ms
} as const;

/**
 * 工事写真台帳_設定テーブルのフィールド定義（#94）
 * 台帳作成画面の下書き（選択/並び順/コメント/表紙/レイアウト）を製番ごとにJSONで保存。
 */
export const KOJI_LEDGER_SETTINGS_FIELDS = {
  seiban: "製番",
  settings_json: "設定JSON",
  updated_at: "更新日時",
} as const;

/* ===================== 棚卸入力Webアプリ ===================== */

/**
 * システム在庫情報（既存・基幹から月次アップロード / 洗い替え）
 * 48列あるが棚卸で使うのはここに定義した分のみ。
 * 注意: 在庫数などの数値は Text 型で入っており、金額はカンマ区切り。
 *       参照時は必ず parseStockNumber() を通すこと。
 */
export const TANAOROSHI_STOCK_FIELDS = {
  closing_date: "締日", // 日付。月次スナップショットの基準日
  warehouse_code: "倉庫コード", // 数値だがAPIでは文字列で返る
  warehouse_name: "倉庫", // 全角空白を含む。突合キーには使わない
  shelf_no: "棚番", // 次期フェーズ用
  item_code: "品番",
  item_name: "品名",
  item_name2: "品名2", // 品名と結合して表示する
  unit: "単位",
  stock_qty: "在庫数", // Text型
  tanaoroshi_qty: "棚卸数", // 数値型
  adjust_qty: "調整数", // 数値型
} as const;

/**
 * 棚卸在庫情報（既存・基幹取込レイアウト。F-11 の出力先）
 * 確定値をここへ書き戻し、同じ列構成で EXCEL もダウンロードする。
 */
export const TANAOROSHI_RESULT_FIELDS = {
  warehouse_code: "倉庫コード", // 数値
  warehouse_name: "倉庫",
  item_code: "品番",
  item_name: "品名",
  item_name2: "品名2",
  qty: "数量", // 数値。確定実棚数量
  note: "備考",
  staff_code: "担当者コード",
  staff_name: "担当者",
  theoretical_qty: "理論数", // 数値。システム在庫数
  diff_qty: "差異数", // 数値。数量 - 理論数
} as const;

/** 棚卸_期 */
export const TANAOROSHI_PERIOD_FIELDS = {
  period_id: "期ID",
  name: "棚卸名称",
  closing_date: "基準締日",
  status: "状態", // 単一選択: 準備中/実施中/締め
  created_by: "作成者",
  created_at: "作成日時",
  updated_at: "更新日時",
} as const;

/** 棚卸_倉庫進捗（回数は倉庫単位で管理する） */
export const TANAOROSHI_WH_STATUS_FIELDS = {
  status_id: "進捗ID", // 期ID|倉庫コード
  period_id: "期ID",
  warehouse_code: "倉庫コード",
  warehouse_name: "倉庫名",
  current_round: "現在回数",
  status: "ステータス", // 単一選択。"発行処理中" は二重発行防止ロック
  target_items: "対象品目数",
  reported_items: "報告済品目数",
  diff_count: "差分件数",
  last_reported_at: "最終報告日時",
  updated_at: "更新日時",
} as const;

/**
 * 棚卸_実績（追記専用）
 * 実棚数量は「状態=有効 の 入力数量 の SUM」で常に導出する。累計列は持たない。
 */
export const TANAOROSHI_ENTRY_FIELDS = {
  entry_id: "実績ID", // クライアント採番UUID。冪等キー
  period_id: "期ID",
  warehouse_code: "倉庫コード",
  warehouse_name: "倉庫名",
  item_code: "品番",
  item_name: "品名",
  qty: "入力数量", // この1操作の数量。累計ではない
  stock_state: "在庫状態", // 単一選択: 良品/不良品/滞留
  photos: "写真",
  input_method: "入力方式", // 単一選択: 読取/手入力/検索
  round: "棚卸回数",
  reason_code: "差分理由コード",
  status: "状態", // 単一選択: 有効/取消
  voided_from: "取消元実績ID",
  no_system_stock: "システム在庫なし",
  input_by: "入力者",
  input_by_email: "入力者メール",
  input_at: "入力日時", // 入力時刻（送信時刻ではない）
  sent_at: "送信日時",
  device_id: "端末ID",
} as const;

/** 棚卸_差分リスト */
export const TANAOROSHI_DIFF_FIELDS = {
  diff_id: "差分ID", // 期ID|倉庫コード|品番|回数
  period_id: "期ID",
  warehouse_code: "倉庫コード",
  warehouse_name: "倉庫名",
  item_code: "品番",
  item_name: "品名",
  system_qty: "システム在庫数",
  actual_qty: "実棚数量",
  diff_qty: "差分数",
  state_breakdown: "在庫状態内訳",
  round: "棚卸回数",
  reason_code: "差分理由コード",
  reason_name: "差分理由名称",
  resolved: "解消フラグ",
  issued_by: "発行者",
  issued_at: "発行日時",
} as const;

/** 棚卸_差分理由コードマスタ */
export const TANAOROSHI_REASON_FIELDS = {
  code: "理由コード",
  name: "理由名称",
  sort_order: "表示順",
  is_active: "有効フラグ",
} as const;

/** 棚卸_操作履歴（取消・修正・管理操作のみ記録。登録は実績テーブル自体が履歴を兼ねる） */
export const TANAOROSHI_AUDIT_FIELDS = {
  audit_id: "履歴ID",
  period_id: "期ID",
  target_key: "対象キー",
  action: "操作種別", // 単一選択: 取消/修正/差分リスト発行/締め/基幹出力/在庫取込/初期化
  before: "変更前",
  after: "変更後",
  note: "備考",
  operator: "操作者",
  operated_at: "操作日時",
} as const;

/**
 * テーブル名からBaseトークンを取得
 */
export function getBaseTokenForTable(tableName: keyof typeof TABLE_BASE_CONFIG): string {
  const baseType = TABLE_BASE_CONFIG[tableName] || "project";
  if (baseType === "master") {
    return requireBaseToken("LARK_BASE_TOKEN_MASTER");
  }
  return requireBaseToken("LARK_BASE_TOKEN");
}

/**
 * マスタ用Baseトークンを取得
 */
export function getLarkBaseTokenMaster(): string {
  return requireBaseToken("LARK_BASE_TOKEN_MASTER");
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
  uriage_mikomi_date: "売上見込日",
  uriage_date: "売上日",
} as const;

/**
 * 売上済フラグの判定ヘルパー
 *
 * 案件一覧の売上済フラグは文字列 "0"(未売上)/"1"(売上済) で表現される。
 * Lark のテキスト型はAPI取得時に [{ text: "1", type: "text" }] のセグメント配列で
 * 返るため、その形式も解釈する。旧チェックボックス(boolean)/数値にも後方互換で対応。
 */
export function isUriagezumi(value: unknown): boolean {
  if (value === "1" || value === 1 || value === true) return true;
  let text = "";
  if (Array.isArray(value)) {
    text = value
      .map((v: any) => (v && typeof v === "object" && v.text != null ? v.text : v))
      .join("");
  } else if (value && typeof value === "object" && (value as any).text != null) {
    text = String((value as any).text);
  }
  return text.trim() === "1";
}

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
  営業部: ["見積書", "見積根拠", "原価明細書", "売約表紙", "注文書", "工程表", "図面", "申請情報", "現地写真"],
  設計部: [
    "計画図",
    "承認図",
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
  工務課: ["施工要領書", "施工計画書", "安全書類", "工事写真台帳"],
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
 * 社内工程表テーブルのフィールド定義
 */
export const SCHEDULE_FIELDS = {
  seiban: "製番",
  juchu_start: "社内工程表_受注開始日",
  juchu_end: "社内工程表_受注終了日",
  keikakuzu_start: "社内工程表_計画図作成開始日",
  keikakuzu_end: "社内工程表_計画図作成終了日",
  shinsei_joho_start: "社内工程表_申請必要情報確定開始日",
  shinsei_joho_end: "社内工程表_申請必要情報確定終了日",
  shoninzu_start: "社内工程表_承認図作成開始日",
  shoninzu_end: "社内工程表_承認図作成終了日",
  zumen_shonin_start: "社内工程表_図面承認開始日",
  zumen_shonin_end: "社内工程表_図面承認終了日",
  shinsei_tosho_start: "社内工程表_申請図書作成開始日",
  shinsei_tosho_end: "社内工程表_申請図書作成終了日",
  shinsei_kikan_kouzou_start: "社内工程表_申請期間構造開始日",
  shinsei_kikan_kouzou_end: "社内工程表_申請期間構造終了日",
  shinsei_kikan_kakunin_start: "社内工程表_申請期間確認済開始日",
  shinsei_kikan_kakunin_end: "社内工程表_申請期間確認済終了日",
  sesakuzu_start: "社内工程表_製作図開始日",
  sesakuzu_end: "社内工程表_製作図終了日",
  zairyo_tehai_start: "社内工程表_材料手配開始日",
  zairyo_tehai_end: "社内工程表_材料手配終了日",
  sesaku_kikan_start: "社内工程表_製作期間開始日",
  sesaku_kikan_end: "社内工程表_製作期間終了日",
  kiso_kouji_start: "社内工程表_基礎工事開始日",
  kiso_kouji_end: "社内工程表_基礎工事終了日",
  sekou_kikan_start: "社内工程表_施工期間開始日",
  sekou_kikan_end: "社内工程表_施工期間終了日",
  kanryo_kensa_start: "社内工程表_完了検査開始日",
  kanryo_kensa_end: "社内工程表_完了検査終了日",
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

/**
 * 基準風速・積雪量マスタ のフィールド定義（営業: 基準風速/垂直積雪量 検索）
 * ※ Lark上の表示名は日本語（業務ユーザーが直接編集するため）
 */
export const KIJUN_FUSOKU_FIELDS = {
  ken: "県名",
  shi: "市・郡・区",
  k1: "区分1",
  k2: "区分2",
  k3: "区分3",
  wind: "基準風速", // m/s
  snow: "垂直積雪量", // cm（標高依存地域は空）
  elev_flag: "標高計算有無",
  elev_sign: "標高符号",
  elev_base: "基準標高", // 式の「基準値」変数（しきい標高 m）
  elev_method: "積雪算出方法", // 旧方式の原文（参考表示用に保持）
  note: "備考",
  // 標高依存積雪の確定算出（計算パターン方式）用。定数1〜19
  const1: "定数1",
  const2: "定数2",
  const3: "定数3",
  const4: "定数4",
  const5: "定数5",
  const6: "定数6",
  const7: "定数7",
  const8: "定数8",
  const9: "定数9",
  const10: "定数10",
  const11: "定数11",
  const12: "定数12",
  const13: "定数13",
  const14: "定数14",
  const15: "定数15",
  const16: "定数16",
  const17: "定数17",
  const18: "定数18",
  const19: "定数19",
  pattern_id: "計算パターンID",
} as const;

/** 定数1〜19 のフィールド名を順に並べた配列（import/route 共通利用） */
export const KIJUN_FUSOKU_CONST_FIELDS: readonly string[] = [
  "定数1", "定数2", "定数3", "定数4", "定数5", "定数6", "定数7", "定数8", "定数9", "定数10",
  "定数11", "定数12", "定数13", "定数14", "定数15", "定数16", "定数17", "定数18", "定数19",
];

/* ===========================================================================
 * 参考図台帳検索（営業: Access 参考図.accdb 移行）フィールド定義
 * 設計: docs/eigyo-sankou-zu/README.md, lark-table-spec.md
 * ※ Lark 表示名は日本語。Access 列名を踏襲（ファイルパスは単一Boxフォルダのため列に持たない）。
 * =========================================================================== */

/** 参考図面台帳: 数値型フィールド（範囲検索に使用） */
export const SANKOU_DAICHO_NUMERIC_FIELDS: readonly string[] = [
  "伝票番号", "期", "設計条件(基準風)", "設計条件(基準雪)", "間口", "桁行", "軒高", "柱ピッチ", "勾配", "庇出巾",
];

/** 参考図面台帳: 全フィールド（Lark作成順の正・ファイルパスは除外）。突合キー=伝票番号 */
export const SANKOU_DAICHO_FIELDS: readonly string[] = [
  "伝票番号", "管理番号", "管理名", "売約番号", "案件名", "期", "設計ルート", "申請有無",
  "設計条件(基準風)", "設計条件(基準雪)", "建屋区分", "建屋区分名称", "用途", "計画概要memo",
  "間口", "桁行", "軒高", "柱ピッチ", "勾配",
  "出入口1", "サイズ1", "出入口2", "サイズ2", "庇出巾", "壁面",
  "柱形状", "B-PL形状", "C1", "柱成", "柱ラチ", "T1", "梁成", "梁ラチ", "G1",
  "B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4", "Ga", "Gc", "WB", "ST",
  "基礎形状", "F1", "F2", "F3", "FG", "土間",
  "形状関連", "出入口関連", "膜関連", "設備関連", "構造関連", "移動建屋関連", "開閉関連", "畜舎関連",
  "ファイル名",
];

/** 建屋区分マスタのフィールド（絞り込み候補＝名称、登録は建屋区分コードを台帳「建屋区分」へ書込） */
export const SANKOU_KENYA_NAME_FIELD = "建屋区分名称";
export const SANKOU_KENYA_CODE_FIELD = "建屋区分コード";

/**
 * 参考図面台帳の書込不可フィールド（登録/更新で送らない）。
 * 建屋区分名称は「建屋区分」コードから引くLookup項目のため、コードのみ書き込めば自動反映される。
 */
export const SANKOU_DAICHO_READONLY_FIELDS: readonly string[] = ["建屋区分名称"];

/**
 * 設計依頼集計テーブル（参考図利用分析の相関用。参考図の利用件数と設計依頼件数の相関を見る）。
 * 参考図とは別baseにあるため base token も明示指定する。集計年月は YYYY/MM 形式。
 * ※base token は amplify.yml 経由で .env.production に書き出され SSR ランタイムへ渡る。
 *   実値のソース埋め込みは撤去(env必須化)。未設定時は空文字となり実API呼び出し時にエラー化する
 *   (module-level const のためimport/build時のthrowは避ける)。
 */
export const SEKKEI_IRAI_BASE = process.env.LARK_BASE_TOKEN_SEKKEI_IRAI || "";
export const SEKKEI_IRAI_TABLE = process.env.LARK_TABLE_SEKKEI_IRAI || "tblrNsEMuTP8Lg4u";
export const SEKKEI_IRAI_YM_FIELD = "集計年月"; // YYYY/MM（YYYY-MM へ正規化して利用状況と突合）
export const SEKKEI_IRAI_COUNT_FIELD = "全体設計依頼数";

/** 参考図面台帳の突合キー（業務PK） */
export const SANKOU_DAICHO_KEY = "伝票番号";

/** 参考図面部品マスタ: 全フィールド。突合キー=ID */
export const SANKOU_BUHIN_FIELDS: readonly string[] = ["ID", "部品名称", "分類1", "分類2", "分類3"];
export const SANKOU_BUHIN_KEY = "ID";

/**
 * 参考図汎用マスタ（全社共通マスタ。tbl9MGRMMHGNXFUU）の実構造:
 *   システム名 / 項目名 / 内容 / 備考1 / 備考2 / 備考3
 * 参考図台帳検索は システム名="参考図面情報" の行を 項目名→内容[] で候補に使う。
 * 項目名の例: 用途, 柱形状, 壁面, 土間, 基礎形状, BPL, 出入口種類, F1布基礎/F1独立基礎/F1H鋼材,
 *   形状関連, 出入口関連, 膜関連, 設備関連, 構造関連, 移動建屋関連, 開閉関連, 畜舎関連 等。
 * 候補ソースの読込は app/api/eigyo/sankou-zu/route.ts、列→項目名の対応は app/eigyo/sankou-zu/page.tsx。
 */
export const SANKOU_HANYOU_SYSTEM = "参考図面情報";

/* ===========================================================================
 * 生産本部KPIマネジメントシステム フィールド定義
 * 設計: docs/kpi-system/02_data-model.md / 08_lark-base-setup.md
 * ※ Lark上の表示名は日本語(業務ユーザーが直接見るため)
 * =========================================================================== */

/** 経営_中期経営計画ヘッダ */
export const KEIEI_MIDTERM_PLAN_HEADER_FIELDS = {
  plan_id: "中計コード",
  name: "中計名",
  start_period: "開始期",
  end_period: "終了期",
  status: "ステータス",
  kgi_set: "KGI指標セット",
  interpolation: "補間方法",
  notes: "備考",
} as const;

/** 経営_中期経営計画明細 */
export const KEIEI_MIDTERM_PLAN_FIELDS = {
  detail_id: "明細コード",
  plan_id: "中計コード",
  indicator: "指標",
  unit: "単位",
  period: "対象期",
  annual_target: "年度目標",
  final_target: "最終目標",
  method: "算出方法",
  notes: "備考",
} as const;

/** 経営_会計データ実績 */
export const KAIKEI_ACTUAL_FIELDS = {
  actual_id: "実績コード",
  period: "期",
  granularity: "粒度",
  span: "期間",
  fiscal_month: "会計月序",
  account: "勘定科目",
  value: "実績値",
  unit: "単位",
  input_by: "入力者",
  input_at: "入力日時",
  locked: "確定フラグ",
} as const;

/** 生産KPI_KPIマスタ */
export const SEISAN_KPI_MASTER_FIELDS = {
  kpi_id: "KPIコード",
  period: "期",
  level: "階層",
  department_div: "部門",
  department: "部署",
  department_id: "部署コード",
  category: "カテゴリ",
  kpi_name: "KPI名称",
  unit: "単位",
  agg_type: "集計タイプ",
  direction: "良い方向",
  prev_actual: "49期実績",
  annual_target: "年間目標",
  monthly_target: "月次目標換算",
  owner: "KPIオーナー",
  data_source: "データソース",
  input_timing: "入力タイミング",
  sort_order: "並び順",
  is_active: "有効フラグ",
  notes: "備考",
  rollup_target: "積み上げ先KPI",
} as const;

/** 生産KPI_期マスタ */
export const SEISAN_KPI_PERIOD_FIELDS = {
  period: "期",
  start_date: "期間開始日",
  end_date: "期間終了日",
  elapsed_months: "経過月数",
  is_current: "当期フラグ",
  notes: "備考",
} as const;

/** 生産KPI_グループマスタ */
export const SEISAN_KPI_GROUP_FIELDS = {
  group_id: "グループコード",
  group_name: "グループ名",
  group_type: "グループ種別",
  period: "期",
  sort_order: "並び順",
  is_active: "有効フラグ",
  notes: "備考",
} as const;

/** 生産KPI_グループ所属(M:N) */
export const SEISAN_KPI_GROUP_MEMBER_FIELDS = {
  member_id: "所属コード",
  group_id: "グループコード",
  department_id: "部署コード",
  department: "部署",
  period: "期",
  sort_order: "並び順",
} as const;

/** 生産KPI_月次実績 */
export const SEISAN_KPI_ACTUAL_FIELDS = {
  actual_id: "実績コード",
  period: "期",
  kpi_id: "KPIコード",
  target_ym: "対象年月",
  fiscal_month: "会計月序",
  value: "実績値",
  input_by: "入力者",
  input_at: "入力日時",
  locked: "確定フラグ",
  locked_by: "確定者",
  notes: "備考",
} as const;

/** 生産KPI_施策 */
export const SEISAN_KPI_MEASURE_FIELDS = {
  measure_id: "施策コード",
  period: "期",
  group_id: "グループコード",
  no: "No",
  measure_name: "施策名",
  detail: "施策詳細",
  target_kpi_id: "対象KPIコード",
  status: "状態",
  start_month: "開始月",
  end_month: "終了月",
  base_value: "基準値",
  goal_value: "狙い値",
  created_by: "作成者",
  updated_at: "更新日時",
} as const;

/** 生産KPI_施策月次PDCA */
export const SEISAN_KPI_PDCA_FIELDS = {
  pdca_id: "PDCAコード",
  measure_id: "施策コード",
  period: "期",
  target_ym: "対象年月",
  fiscal_month: "会計月序",
  plan: "計画（Plan）",
  do: "実施（Do）",
  kpi_actual: "対象KPI実績",
  effect_auto: "効果（自動判定）",
  effect: "効果（確定）",
  effect_memo: "効果メモ",
  director_comment: "本部長コメント",
  next_action: "翌月アクション",
  writer: "記入者",
  updated_at: "更新日時",
} as const;

/** 生産KPI_★達成調整 */
export const SEISAN_KPI_STAR_ADJ_FIELDS = {
  adj_id: "調整コード",
  period: "期",
  department_id: "部署コード",
  department: "部署",
  target_ym: "対象年月",
  type: "種別",
  delta: "★増減",
  reason: "理由",
  registered_by: "登録者",
} as const;

/** 生産KPI_過去実績 */
export const SEISAN_KPI_HISTORY_FIELDS = {
  history_id: "履歴コード",
  indicator_name: "指標名",
  kpi_id: "KPIコード",
  department_id: "部署コード",
  department: "部署",
  agg_level: "集計レベル",
  unit: "単位",
  period: "期",
  value: "実績値",
  target_50: "50期目標",
} as const;

/** 生産KPI_変更履歴(監査ログ) */
export const SEISAN_KPI_AUDIT_FIELDS = {
  history_id: "履歴コード",
  target_table: "対象テーブル",
  target_record_id: "対象レコードコード",
  operation: "操作種別",
  before: "変更前",
  after: "変更後",
  operator: "操作者",
  operated_at: "操作日時",
} as const;
