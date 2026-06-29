# 参考図台帳検索 — PDF連携(Box)手配依頼書

参考図台帳検索の結果一覧から図面PDFを開けるようにするため、**Box側の手配**をお願いします。
手配が済み、下記の環境変数を設定すると、画面の「開く」ボタンが自動で有効化されます
（それまでは「PDF連携(Box)は準備中です」と表示されます）。

> 仕組み: PDFは全件が**単一のBoxフォルダ**（`共有フォルダ/system/SubSystem/参考図面データ/`）にあります。
> サーバが「ファイル名」でそのフォルダ内を検索し、プレビュー/ダウンロードURLへ中継します。
> **Boxの認証情報はサーバ側だけで保持**し、ブラウザには出しません（既存の地理院連携と同方針）。
> 設計の詳細は `docs/eigyo-sankou-zu/README.md` §8-A。

---

## 手配いただくこと（管理者作業）

### 1. Box Platform アプリの作成（推奨: サーバ認証 / Client Credentials Grant = CCG）

[Box Developer Console](https://app.box.com/developers/console) で新規アプリを作成します。

- アプリ種別: **Custom App**
- 認証方式: **Server Authentication (Client Credentials Grant)** ← 推奨（鍵管理が不要で簡単）
  - ※ 組織方針でJWTが必須の場合はJWTでも可（その場合は設定JSONをお渡しください）。
- Application Scopes（権限）:
  - ✅ **Read all files and folders stored in Box**（フォルダ内検索とファイル取得に必要）
  - 書き込み系は不要（閲覧のみ）。
- Advanced Features:
  - 「Make API calls using the as-user header」は**不要**。
- 作成後、**App Settings** に表示される以下を控える:
  - **Client ID**
  - **Client Secret**

### 2. アプリの認可（管理コンソールでの承認）

作成したアプリは、利用前に**Box管理者の承認**が必要です。

- Developer Console → 対象アプリ → **Authorization** タブ → **Review and Submit**
- Box管理コンソール（Admin Console → Apps → Custom Apps Manager）で**承認**
  - CCGアプリの「App Access Level」は **App + Enterprise Access** を推奨
    （フォルダをコラボレーター追加で限定アクセスにする場合は App Access でも可。下記3参照）。

### 3. 対象フォルダへのアクセス権

CCGアプリは**サービスアカウント**（アプリ専用ユーザー）として動作します。
このサービスアカウントが参考図面フォルダを読めるようにします。どちらかで対応:

- **(推奨)** 参考図面フォルダ `共有フォルダ/system/SubSystem/参考図面データ` を、
  サービスアカウントの**コラボレーター（閲覧者 / Viewer）に追加**する。
  - サービスアカウントのメール/IDは Admin Console のアプリ詳細で確認できます
    （`AutomationUser_….@boxdevedition.com` のような形式）。
- または、アプリを **Enterprise Access** にしている場合はコラボ追加不要（全社ファイルを読めるため）。

### 4. 対象フォルダの folder_id を控える

ブラウザでBoxの `参考図面データ` フォルダを開いたときの **URL末尾の数値**が folder_id です。
例: `https://app.box.com/folder/123456789012` → folder_id = `123456789012`

---

## お渡しいただきたい情報（4点）

| 項目 | 例 | 用途 |
|---|---|---|
| Client ID | `abcd1234...` | アプリ認証 |
| Client Secret | `wxyz5678...` | アプリ認証（**秘匿**） |
| Enterprise ID | `1234567` | CCGのトークン取得に必要 |
| 参考図面フォルダの folder_id | `123456789012` | 検索対象フォルダ |

> Client Secret は機密情報です。チャットに貼らず、安全な経路（パスワードマネージャ共有等）でお願いします。
> こちらは環境変数（`.env.local` / Amplify環境変数）に設定し、コードには埋め込みません。

---

## 受領後にこちらで行うこと

1. サーバ環境変数を設定（`.env.local` と Amplify。**main と feat/sales-analysis の両環境**）:
   ```
   BOX_CLIENT_ID=...
   BOX_CLIENT_SECRET=...
   BOX_ENTERPRISE_ID=...
   BOX_FOLDER_ID=...
   ```
   （JWT方式の場合は `BOX_JWT_CONFIG_BASE64`（設定JSONをbase64化したもの）＋ `BOX_FOLDER_ID`）
2. PDF中継APIの本実装（`app/api/eigyo/sankou-zu/file/route.ts`）:
   - CCGトークン取得 → 対象フォルダ内をファイル名で検索 → file_id 特定
   - プレビュー/ダウンロードURLへ302、または埋め込みプレビューを返す
   - ファイル名重複時は最新/先頭を採用（台帳は図面と多対一）
3. 動作確認 → 画面の `pdfEnabled` が true になり「開く」が有効化。

---

## 補足・留意点

- **環境変数だけで有効/無効が切り替わる**設計です（`BOX_FOLDER_ID` と認証情報が揃うと有効）。
  手配前にコードを先行マージしても、未設定の間は安全に「準備中」表示のままです。
- ファイル名は台帳の `ファイル名` 列を使用。フォルダは固定のため、行ごとにパスは持ちません。
- 将来的にPDFの画面内プレビュー埋め込み（v2）も同APIで対応可能です。
