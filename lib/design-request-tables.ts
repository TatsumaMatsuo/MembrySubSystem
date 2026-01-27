/**
 * 設計依頼テーブルの定義
 * Issue #29: 設計部メニュー - 設計依頼工程管理機能
 */

// 設計依頼Base情報
export const DESIGN_REQUEST_BASE_TOKEN = "CxVgbbMI6apIY8swB63j5zKNp1b";
export const DESIGN_REQUEST_TABLE_ID = "tblQa9eimBPgXPiD";

/**
 * 設計依頼テーブルのフィールド定義
 */
export const DESIGN_REQUEST_FIELDS = {
  // 基本情報
  anken_bangou: "案件番号",
  anken_mei: "案件名",
  kubun: "区分",
  kaishi_bi: "開始日",
  kanryo_kijitsu: "完了期日",
  tenpu_file: "添付ファイル",
  tantousha: "担当者",
  taiou_bi: "対応日",
  calendar_title: "カレンダータイトル",
  kansei_zumen: "完成図面",
  sagyou_kubun: "作業区分",
  kouzou_kanryou: "構造完了(参考)",
  sakuzu_kanryou: "作図完了(参考)",
  keikaku_joukyou: "計画状況",
  juchuu_doai: "受注度合",
  dairi_jouhou: "代理店情報",
  kensetsu_basho_todouhuken: "建設場所(都道府県)",
  kensetsu_basho_ika: "建設場所(以下住所)",
  tatemono_tousuu: "建物棟数",
  eigyou_tantousha: "営業担当者",
  kiso_umu: "基礎の有無",
  doma_kouryo: "土間考慮",
  tekkotsu_buzai_umu: "鉄骨部材の有無",
  tekkotsu_shurui: "鉄骨種類",
  hitsuyou_zumen: "必要図面",
  youto: "用途",
  tatemono_keijou: "建物形状",
  size_w: "サイズ(W)",
  size_l: "サイズ(L)",
  size_h: "サイズ(H)",
  shinsei_umu: "申請有無",
  gyousei_jizen_chousa: "行政事前調査",
  sekkei_jouken: "設計条件",
  bikou: "備考",
  buzai_list: "部材リスト",
  buzai_list_comment: "部材リストコメント",
  kansei_zumen_comment: "完成図面コメント",
  makuzai: "膜材",
  sakusei_nichiji: "作成日時",
  juchuu_anken: "受注案件",
  henkou_taishou: "変更対象案件",
  henkou_naiyou: "変更内容",
  tenpu_file_henkou: "添付ファイル(変更依頼)",
  gantt_hantei: "ガントチャート判定用",
  gantt_you: "ガントチャート用",
  group: "グループ",
  sekkei_irai_seiban: "設計依頼製番",
  oya_record: "親レコード",
} as const;

/**
 * 作業区分オプション
 */
export const SAGYOU_KUBUN_OPTIONS = [
  "構造検討",
  "構造検討済",
  "構造計算書",
  "構造計算書済",
  "構造質疑",
  "構造質疑済",
  "作図",
  "作図済",
  "申請図",
  "申請図済",
  "意匠質疑",
  "意匠質疑済",
  "図面修正",
  "図面修正済",
  "対応不要",
  "対応不可",
  "申請書",
  "申請書済",
  "配置図",
  "配置図済",
  "その他",
  "対応完了",
  "承認図",
  "承認図済",
  "構造再検討",
  "構造再検討済",
  "構造部材指示",
  "構造部材指示済",
] as const;

/**
 * 区分オプション
 */
export const KUBUN_OPTIONS = [
  "テント倉庫",
  "上屋",
  "スポーツ施設",
  "畜舎",
  "仮設建築物",
  "移動式テント",
  "ブース",
  "シェード",
  "日除け",
  "オーニング",
  "カーテン",
  "壁",
  "開閉式",
  "変形建物",
] as const;

/**
 * 計画状況オプション
 */
export const KEIKAKU_JOUKYOU_OPTIONS = ["新規案件", "継続案件"] as const;

/**
 * 受注度合オプション
 */
export const JUCHUU_DOAI_OPTIONS = ["計画段階案件", "受注決定案件"] as const;

/**
 * 設計依頼レコード型定義
 */
export interface DesignRequestRecord {
  record_id: string;
  anken_bangou: string;
  anken_mei: string;
  kubun: string;
  kaishi_bi: number | null;
  kanryo_kijitsu: number | null;
  tenpu_file: FileAttachment[];
  tantousha: LarkUser[];
  taiou_bi: number | null;
  sagyou_kubun: string;
  kouzou_kanryou: number | null;
  sakuzu_kanryou: number | null;
  keikaku_joukyou: string;
  juchuu_doai: string;
  kensetsu_basho_todouhuken: string;
  kensetsu_basho_ika: string;
  tatemono_tousuu: string;
  eigyou_tantousha: LarkUser[];
  youto: string;
  tatemono_keijou: string;
  size_w: number | null;
  size_l: number | null;
  size_h: number | null;
  shinsei_umu: string;
  bikou: string;
  buzai_list: FileAttachment[];
  kansei_zumen: FileAttachment[];
  buzai_list_comment: string;
  kansei_zumen_comment: string;
  sakusei_nichiji: number | null;
}

/**
 * Larkファイル添付型
 */
export interface FileAttachment {
  file_token: string;
  name: string;
  size: number;
  tmp_url?: string;
  type?: string;
}

/**
 * Larkユーザー型
 */
export interface LarkUser {
  id: string;
  email: string;
  en_name: string;
  avatar_url?: string;
}

/**
 * 工程管理用のステータス判定
 * がんチャート判定により、設計事務所か企画設計かを判断
 */
export type DesignTeamType = "設計事務所" | "企画設計";

/**
 * 担当者割り当て情報
 */
export interface AssignmentInfo {
  record_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: Date;
  scheduled_start: Date | null;
  scheduled_end: Date | null;
  status: "pending" | "in_progress" | "completed";
}
