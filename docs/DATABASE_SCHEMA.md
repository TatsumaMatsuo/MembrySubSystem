# データベース（Lark Tables）設計規約

MembrySubSystem で使用する Lark Tables のテーブル・フィールド命名規約とスキーマ定義です。

## 目次

1. [命名規約](#命名規約)
2. [テーブル一覧](#テーブル一覧)
3. [テーブル定義詳細](#テーブル定義詳細)
4. [フィールド定義の実装](#フィールド定義の実装)

---

## 命名規約

### 環境変数（テーブルID）

```
LARK_TABLE_<テーブル名（英語・UPPER_SNAKE_CASE）>
```

| 規則 | 例 |
|------|-----|
| 単数形 | `LARK_TABLE_EMPLOYEE` ✗ → `LARK_TABLE_EMPLOYEES` ✓ |
| 機能を表す名前 | `LARK_TABLE_MENU_DISPLAY` |
| 略語は避ける | `LARK_TABLE_CUST_REQ` ✗ → `LARK_TABLE_CUSTOMER_REQUESTS` ✓ |

### フィールド名（日本語）

| カテゴリ | 命名規則 | 例 |
|----------|----------|-----|
| **ID系** | `〇〇ID` | メニューID, プログラムID, 社員ID |
| **名称系** | `〇〇名` / `〇〇名称` | メニュー名, プログラム名称 |
| **日付系** | `〇〇日` / `〇〇日時` | 受注日, 更新日時, 操作日時 |
| **フラグ系** | `〇〇フラグ` | 有効フラグ, 許可フラグ, 退職者フラグ |
| **金額系** | `〇〇金額` / `〇〇額` | 受注金額, 売上目標 |
| **率系** | `〇〇率` / `〇〇レート` | 粗利率, 変動費率 |
| **数量系** | `〇〇数` / `〇〇件数` | 販売棟数, 問合せ件数 |
| **順序系** | `表示順` / `〇〇順` | 表示順 |
| **区分系** | `〇〇区分` / `〇〇種別` | 要求区分, 操作種別 |
| **参照系** | `〇〇ID` / `親〇〇ID` | 親メニューID, 配置メニューID |

### TypeScript 定数名

```typescript
// テーブルフィールド定義: <テーブル名>_FIELDS
export const BAIYAKU_FIELDS = { ... };
export const MENU_DISPLAY_FIELDS = { ... };

// フィールドキー: snake_case（英語）
export const EMPLOYEE_FIELDS = {
  employee_id: "社員コード",      // キー: snake_case
  employee_name: "社員名",        // 値: 日本語フィールド名
};
```

---

## テーブル一覧

### Base 構成

| Base | 用途 | 環境変数 |
|------|------|----------|
| **project** | 案件情報・トランザクション | `LARK_BASE_TOKEN` |
| **master** | マスタデータ | `LARK_BASE_TOKEN_MASTER` |

### テーブル一覧

| テーブル | 環境変数 | Base | 説明 |
|----------|----------|------|------|
| 売約情報 | `LARK_TABLE_BAIYAKU` | project | 案件基本情報 |
| 顧客要求事項 | `LARK_TABLE_CUSTOMER_REQUESTS` | project | 要求事項変更履歴 |
| 品質改善 | `LARK_TABLE_QUALITY_ISSUES` | project | 不具合・品質改善 |
| 案件書庫 | `LARK_TABLE_PROJECT_DOCUMENTS` | project | 書類ファイル管理 |
| 更新履歴 | `LARK_TABLE_DOCUMENT_HISTORY` | project | 操作ログ |
| クイズマスタ | `LARK_TABLE_QUIZ_MASTER` | project | クイズ問題 |
| クイズ回答履歴 | `LARK_TABLE_QUIZ_ANSWER_HISTORY` | project | 回答記録 |
| 全社KPI | `LARK_TABLE_COMPANY_KPI` | project | 経営指標 |
| 営業部KPI | `LARK_TABLE_SALES_KPI` | project | 営業部目標 |
| 社員マスタ | `LARK_TABLE_EMPLOYEES` | master | 社員情報 |
| 機能マスタ | `LARK_TABLE_FEATURE_MASTER` | master | 機能定義 |
| ユーザー権限 | `LARK_TABLE_USER_PERMISSIONS` | master | 権限設定 |
| メニュー表示 | `LARK_TABLE_MENU_DISPLAY` | master | メニュー構造 |
| 機能配置 | `LARK_TABLE_FUNCTION_PLACEMENT` | master | プログラム配置 |
| グループ権限 | `LARK_TABLE_GROUP_PERMISSION` | master | グループ権限 |
| 個別権限 | `LARK_TABLE_USER_PERMISSION` | master | ユーザー権限 |

---

## テーブル定義詳細

### 売約情報（BAIYAKU）

案件の基本情報を管理するメインテーブル。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| 製番 | テキスト | 案件識別番号（PK） |
| 担当者 | テキスト | 営業担当者名 |
| 品名 | テキスト | 案件名称 |
| 品名2 | テキスト | 案件名称（詳細） |
| 受注日 | 日付 | 受注確定日 |
| 受注金額 | 数値 | 受注金額（円） |
| 施工開始日 | 日付 | 施工開始予定日 |
| 得意先宛名1 | テキスト | 顧客名1 |
| 得意先宛名2 | テキスト | 顧客名2 |

---

### メニュー表示マスタ（MENU_DISPLAY）

サイドバーメニューの階層構造を定義。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| メニューID | テキスト | 一意識別子（M001, M001-01） |
| メニュー名 | テキスト | 表示名 |
| 階層レベル | 数値 | 1=第1階層, 2=第2階層 |
| 親メニューID | テキスト | 親メニューへの参照（第2階層のみ） |
| 表示順 | 数値 | ソート順 |
| アイコン | テキスト | lucide-react アイコン名 |
| 有効フラグ | チェックボックス | 表示/非表示 |

---

### 機能配置マスタ（FUNCTION_PLACEMENT）

プログラム（画面）とメニューの紐付けを定義。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| プログラムID | テキスト | 一意識別子（PGM001） |
| プログラム名称 | テキスト | 機能名 |
| 配置メニューID | テキスト | 所属する第2階層メニューID |
| URLパス | テキスト | Next.js ルートパス（/upload/xxx） |
| 表示順 | 数値 | メニュー内ソート順 |
| 説明 | テキスト | 機能説明 |
| 有効フラグ | チェックボックス | 表示/非表示 |

---

### グループ権限マスタ（GROUP_PERMISSION）

部門単位の権限設定。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| グループID | テキスト | Lark部門ID |
| グループ名 | テキスト | 部門名 |
| 対象種別 | 選択 | menu / program |
| 対象ID | テキスト | メニューID or プログラムID |
| 許可フラグ | チェックボックス | true=許可, false=拒否 |
| 更新日時 | 日時 | 最終更新日時 |

---

### 個別権限マスタ（USER_PERMISSION）

ユーザー個別の権限設定（グループ権限より優先）。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| 社員ID | テキスト | 社員識別子 |
| 社員名 | テキスト | 社員名 |
| 対象種別 | 選択 | menu / program |
| 対象ID | テキスト | メニューID or プログラムID |
| 許可フラグ | チェックボックス | true=許可, false=拒否 |
| 更新日時 | 日時 | 最終更新日時 |

---

### 社員マスタ（EMPLOYEES）

社員情報のマスタテーブル。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| 社員コード | テキスト | 社員ID |
| 社員名 | テキスト | 氏名 |
| 社員名 (メンバー).仕事用メールアドレス | テキスト | メールアドレス |
| 社員名 (メンバー).部署 | テキスト | 所属部署 |
| 退職者フラグ | チェックボックス | 退職済みフラグ |

---

### 営業部KPI（SALES_KPI）

営業部門の目標設定テーブル。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| 期 | テキスト | 期間（例: 2026年度） |
| 期間開始日 | 日付 | 期間開始 |
| 期間終了日 | 日付 | 期間終了 |
| 売上目標 | 数値 | 年間売上目標（円） |
| 月次売上目標 | 数値 | 月次目標（円） |
| 粗利目標 | 数値 | 粗利目標（円） |
| 粗利率 | 数値 | 粗利率（%） |
| テント倉庫販売棟数 | 数値 | 目標棟数 |
| 膜構造建築物売上 | 数値 | 目標金額 |
| 畜舎案件売上 | 数値 | 目標金額 |
| 海洋事業製品売上 | 数値 | 目標金額 |
| レンタルテント売上 | 数値 | 目標金額 |
| WEB問合せ年間件数 | 数値 | 目標件数 |
| WEB問合せ月間件数 | 数値 | 月次目標件数 |
| WEB受注金額 | 数値 | 目標金額 |
| Aランク顧客目標 | 数値 | 目標数 |
| 営業1人あたりAランク目標 | 数値 | 人別目標 |
| Aランク条件 | テキスト | 条件定義 |
| クレーム上限件数 | 数値 | 上限値 |
| 備考 | テキスト | メモ |

---

### クイズマスタ（QUIZ_MASTER）

メンくまクイズの問題マスタ。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| クイズID | テキスト | 問題ID |
| 問題文 | テキスト | クイズ本文 |
| 選択肢A | テキスト | 選択肢1 |
| 選択肢B | テキスト | 選択肢2 |
| 選択肢C | テキスト | 選択肢3 |
| 正解 | 選択 | A / B / C |
| 解説 | テキスト | 正解の解説 |
| カテゴリ | 選択 | 問題カテゴリ |
| 有効フラグ | チェックボックス | 出題対象 |

---

## フィールド定義の実装

### 定義ファイル

すべてのフィールド定義は `lib/lark-tables.ts` に集約されています。

```typescript
// lib/lark-tables.ts

// テーブルID取得
export function getLarkTables() {
  return {
    BAIYAKU: process.env.LARK_TABLE_BAIYAKU || "",
    MENU_DISPLAY: process.env.LARK_TABLE_MENU_DISPLAY || "",
    // ...
  };
}

// フィールド定義
export const BAIYAKU_FIELDS = {
  seiban: "製番",
  tantousha: "担当者",
  hinmei: "品名",
  // ...
} as const;
```

### 使用方法

```typescript
import { BAIYAKU_FIELDS, getLarkTables } from "@/lib/lark-tables";

// フィールド名を使用
const data = response.data.items.map((item: any) => ({
  seiban: item.fields[BAIYAKU_FIELDS.seiban] || "",
  hinmei: item.fields[BAIYAKU_FIELDS.hinmei] || "",
}));
```

### 新しいテーブルを追加する場合

1. **環境変数を追加**（`.env.local`）
   ```
   LARK_TABLE_NEW_TABLE=tblXXXXXX
   ```

2. **テーブルIDを登録**（`lib/lark-tables.ts`）
   ```typescript
   export function getLarkTables() {
     return {
       // ...
       NEW_TABLE: process.env.LARK_TABLE_NEW_TABLE || "",
     };
   }
   ```

3. **フィールド定義を追加**
   ```typescript
   export const NEW_TABLE_FIELDS = {
     id: "ID",
     name: "名称",
     is_active: "有効フラグ",
   } as const;
   ```

4. **Base設定を追加**
   ```typescript
   export const TABLE_BASE_CONFIG: Record<string, BaseType> = {
     // ...
     NEW_TABLE: "master", // or "project"
   };
   ```

5. **このドキュメントを更新**

---

## 部署別書類カテゴリ

案件書庫で使用する書類種別の定義。

| 部署 | 書類種別 |
|------|----------|
| **営業部** | 見積書, 見積根拠, 原価明細書, 売約表紙, 注文書 |
| **設計部** | 地盤調査, 製作図, 副資材リスト, 切板リスト, ミルシート, 現場工程写真, 検査済証, 確認済証, 消防書類, 申請図書 |
| **製造部** | 鉄骨製作要領書, 膜製作要領書, 検査証, 鉄骨製作工程写真, 縫製製作工程写真, 鋼材リスト, ボルトリスト |
| **工務課** | 施工要領書, 施工計画書, 安全書類 |

---

*最終更新: 2026-01-17*
