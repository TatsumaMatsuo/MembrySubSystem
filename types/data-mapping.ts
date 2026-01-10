// データマッピング設定の型定義

export interface FieldMapping {
  larkField: string;       // Larkテーブルのフィールド名
  excelColumn: string;     // Excelのカラム名
  fieldType: "text" | "number" | "date";  // フィールドタイプ
}

export interface DataMappingConfig {
  id: string;              // 設定ID
  name: string;            // 設定名（表示用）
  description?: string;    // 説明
  tableId: string;         // LarkテーブルID
  baseToken?: string;      // Lark Base Token（省略時はデフォルト使用）
  keyField: string;        // キー項目（upsertに使用）
  mappings: FieldMapping[]; // フィールドマッピング
  createdAt: string;       // 作成日時
  updatedAt: string;       // 更新日時
}

export interface LarkTableField {
  field_id: string;
  field_name: string;
  type: number;  // 1=テキスト, 2=数値, 5=日付, etc.
}

// Larkフィールドタイプのマッピング
export const LARK_FIELD_TYPE_MAP: Record<number, "text" | "number" | "date"> = {
  1: "text",      // テキスト
  2: "number",    // 数値
  3: "text",      // 単一選択
  4: "text",      // 複数選択
  5: "date",      // 日付
  7: "text",      // チェックボックス
  11: "text",     // ユーザー
  13: "text",     // 電話番号
  15: "text",     // URL
  17: "text",     // 添付ファイル
  18: "text",     // リンク
  19: "text",     // ルックアップ
  20: "number",   // 数式
};
