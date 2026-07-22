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
  itemName: string; // 品名 + 品名2 を結合済み
  unit: string;
  systemQty: number; // システム在庫数
  /** 2回目以降の対象品目か（1回目は全 true） */
  inTarget: boolean;
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
  /** 写真の file_token（アップロード済み）。Phase 2 で使用 */
  photoTokens?: string[];
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
