/**
 * 棚卸: 共通型（クライアント/サーバ共用）
 */

/** 在庫状態フラグ（Lark 単一選択の選択肢と完全一致させること） */
export type StockState = "良品" | "不良品" | "滞留";

/** 入力方式（Lark 単一選択の選択肢と完全一致させること） */
export type InputMethod = "読取" | "手入力" | "検索";

/** 倉庫（システム在庫情報の DISTINCT） */
export interface Warehouse {
  code: string;
  name: string;
}

/** カタログ品目（起動時に一括DLして端末にキャッシュ） */
export interface CatalogItem {
  itemCode: string;
  itemName: string; // 品名
  spec: string; // 品名2（規格）
  unit: string;
  systemQty: number; // システム在庫数
  /** 2回目以降の対象品目か（1回目は全 true） */
  inTarget: boolean;
}

/** 入力済み一覧の1行（F-03 取消・修正用。個別レコード単位） */
export interface EntryRow {
  entryId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  stockState: StockState;
  inputMethod: InputMethod;
  noSystemStock: boolean;
  inputAt: number;
  /** true=サーバ登録済み / false=端末に未送信 */
  sent: boolean;
}

/** 差分理由コード */
export interface ReasonCode {
  code: string;
  name: string;
}

/** 棚卸セッション（端末に保持。再起動後の再開に使う） */
export interface TanaoroshiSession {
  periodId: string;
  warehouseCode: string;
  warehouseName: string;
  round: number;
  deviceId: string;
  startedAt: number;
  /** 差分理由コードマスタ（2回目以降の理由選択用） */
  reasons?: ReasonCode[];
}

/**
 * 実績エントリ（1読取 = 1レコード。端末の queue に貯めてから送信）
 * entryId はクライアント採番の冪等キー。
 */
export interface EntryDraft {
  entryId: string;
  periodId: string;
  warehouseCode: string;
  warehouseName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  stockState: StockState;
  inputMethod: InputMethod;
  round: number;
  reasonCode?: string;
  noSystemStock: boolean;
  inputBy: string;
  inputByEmail: string;
  inputAt: number; // 入力時刻（送信時刻ではない）
  deviceId: string;
  /** 未送信時の写真データ（端末に保持。送信時にアップロードして photoTokens 化） */
  photos?: Blob[];
  /** アップロード済み写真の file_token */
  photoTokens?: string[];
}

/** 差分リストの1行 */
export interface DiffRow {
  itemCode: string;
  itemName: string;
  systemQty: number;
  actualQty: number;
  diffQty: number; // 実棚 − システム在庫
  stateBreakdown: string; // 例: 良品 20 / 不良品 4
  reasonCode?: string;
  round: number;
}

/** 進捗ダッシュボードの1行（倉庫別） */
export interface ProgressRow {
  warehouseCode: string;
  warehouseName: string;
  round: number;
  status: string;
  targetItems: number; // 対象品目数（システム在庫の品目数）
  reportedItems: number; // 報告済み品目数（現在回数）
  diffCount: number;
  lastReportedAt: number | null;
}

/** bootstrap（起動時一括取得）のレスポンス */
export interface BootstrapResponse {
  success: boolean;
  period: { periodId: string; name: string; closingDate: number | null } | null;
  warehouse: {
    code: string;
    name: string;
    round: number;
    status: string;
  } | null;
  catalog: CatalogItem[];
  reasons: ReasonCode[];
  /** 当該倉庫・回数で既に報告済みの品目コード（複数端末対応の未報告リスト算出用） */
  reportedItemCodes: string[];
  error?: string;
}
