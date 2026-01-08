/**
 * Lark Base テーブルID定義
 */

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
    // 社員マスタテーブル
    EMPLOYEES: process.env.LARK_TABLE_EMPLOYEES || "tblFj7MnxF3svRcu",
  };
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
 * 社員マスタテーブルのフィールド定義
 */
export const EMPLOYEE_FIELDS = {
  employee_id: "社員コード",
  employee_name: "社員名",
  email: "メールアドレス",
  department: "部署",
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
