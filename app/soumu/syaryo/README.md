# 車両関連管理システム (syaryo) — 総務部サブシステム

syaryo_kanren_system から MembrySubSystem に統合されたサブモジュール。

## ディレクトリ構造

```
app/soumu/syaryo/          # ページ（管理画面 + ダッシュボード + 公開verify）
├── admin/                 # 管理者用ページ一式
├── dashboard/             # 申請者用ページ一式
└── verify/[token]/        # 公開許可証照合

app/api/syaryo/            # 車両管理専用APIルート一式
lib/syaryo/                # サービスロジック・Lark クライアント・ユーティリティ
├── lark-client.ts         # 車両用 Lark クライアント（LARK_SYARYO_BASE_TOKEN 使用）
├── lark-tables.ts         # 車両用テーブル/フィールド定義
├── services/              # 申請・従業員・免許・車検・保険・許可証ロジック
├── auth-utils.ts          # MembrySub JWT にブリッジする認証ラッパ
├── session-shim.tsx       # next-auth/react の useSession シム
└── validations/           # zod スキーマ

components/features/syaryo/
├── features/              # 申請・承認・通知コンポーネント
├── forms/                 # 免許/車検/保険 入力フォーム
├── pdf/                   # 許可証 PDF テンプレート
├── providers/             # SessionProvider (パススルー)
└── ui/                    # shadcn 互換 UI プリミティブ

types/syaryo/              # 車両関連型定義
scripts/syaryo/            # セットアップ・検証スクリプト
```

## 必要な環境変数（`.env.local` に追加）

```bash
# ==== 車両管理専用 (syaryo) ====
# 車両用 Lark Base トークン (URL: /base/<ここ>)
LARK_SYARYO_BASE_TOKEN=NNLCbCdohajZpYsHCrkjy1adpNX

# 車両関連テーブル ID (Lark Base から取得)
LARK_TABLE_DRIVERS_LICENSES=
LARK_TABLE_VEHICLE_REGISTRATIONS=
LARK_TABLE_INSURANCE_POLICIES=
LARK_TABLE_EMPLOYEES=
LARK_TABLE_USER_PERMISSIONS=
LARK_TABLE_NOTIFICATION_HISTORY=
LARK_TABLE_SYSTEM_SETTINGS=
LARK_TABLE_PERMITS=
LARK_APPROVAL_HISTORY_TABLE_ID=

# Lark Bot (通知)
LARK_BOT_WEBHOOK_URL=

# Lark Drive (ファイル保管)
LARK_DRIVE_FOLDER_ID=

# 許可証検証URLのベース
NEXT_PUBLIC_APP_URL=https://<amplify-app-url>

# Sentry（任意 - SENTRY_ORG 未設定なら次のも全て無効化される）
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Cron 用シークレット
CRON_SECRET=
```

## URL マッピング（旧 → 新）

| 旧 (syaryo_kanren_system) | 新 (MembrySubSystem) |
|---------------------------|----------------------|
| `/admin/*`                | `/soumu/syaryo/admin/*`     |
| `/dashboard/*`            | `/soumu/syaryo/dashboard/*` |
| `/verify/[token]`         | `/soumu/syaryo/verify/[token]` |
| `/api/*`                  | `/api/syaryo/*` |

## 認証層

- NextAuth は撤去。すべて MembrySubSystem の JWT (`lib/auth-server.ts`) に統一
- クライアントでは `lib/syaryo/session-shim.tsx` が `useSession` を提供し、内部で `useAuth()` を呼ぶ
- サーバーでは `lib/syaryo/auth-utils.ts` が `requireAuth / requireAdmin / requireViewPermission` を提供

## メニュー追加手順（Lark Bitable マスタ）

MembrySubSystem は `MS_SYSメニュー表示マスタ` + `MS_SYS機能配置マスタ` でサイドメニューを動的構築します。総務部メニューに「車両管理」を追加するには:

1. `MS_SYSメニュー表示マスタ` に新規行を追加
   - `menu_id`: `M_SOUMU_SYARYO`
   - `menu_name`: `車両管理`
   - `parent_menu_id`: 総務部カテゴリの menu_id
   - `icon`: 任意の lucide アイコン名
   - `sort_order`: 表示順

2. `MS_SYS機能配置マスタ` に各ページ行を追加（代表例）
   - `機能ID`: `FN_SYARYO_DASHBOARD` / `url_path`: `/soumu/syaryo/dashboard`
   - `FN_SYARYO_ADMIN_APPLICATIONS` / `/soumu/syaryo/admin/applications`
   - `FN_SYARYO_ADMIN_MONITORING` / `/soumu/syaryo/admin/monitoring/expiration`
   - 他、`/soumu/syaryo/admin/*` と `/soumu/syaryo/dashboard/*` を必要に応じて登録

3. `MS_SYSグループ権限マスタ` / `MS_SYSユーザー権限マスタ` で閲覧・編集権限を総務部グループに付与

4. サイドバーに反映される（`/api/menu-permission` 経由で再取得）

## 期限切れ監視（cron）

- `/api/syaryo/cron/expiration-check` がバッチエンドポイント（`CRON_SECRET` で保護）
- AWS Amplify にはネイティブな cron が無いため、以下のいずれかを設定:
  - **EventBridge Scheduler** → `POST /api/syaryo/cron/expiration-check` with `Authorization: Bearer $CRON_SECRET`
  - **GitHub Actions スケジュール**（`.github/workflows/expiration-cron.yml`）
  - **Lark Bitable 自動化**（工程を Webhook で叩く）

## 依存パッケージ追加

`package.json` に以下が追加済み。`npm install` で反映:

- `@hookform/resolvers`, `@radix-ui/react-slot`, `class-variance-authority`
- `@react-pdf/renderer@^3.4.5` (React 18 互換)
- `react-pdf@^9.2.1` (React 18 互換)
- `@sentry/nextjs`, `node-cron`, `qrcode`, `react-dropzone`, `react-hook-form`
- `react-zoom-pan-pinch`, `tailwindcss-animate`, `jose`
- dev: `@types/node-cron`, `@types/qrcode`

## 残課題 (Manual TODO)

- [ ] `npm install` を実行
- [ ] `.env.local` に上記の環境変数を全て設定
- [ ] Lark Bitable マスタへのメニュー行追加
- [ ] `next build` で型エラーが出た箇所を修正
- [ ] `app/api/syaryo/auth/me/route.ts` は不要なら削除（MembrySub の `/api/lark-auth` を使う）
- [ ] `app/api/syaryo/cron/expiration-check` に EventBridge を接続
- [ ] 動作確認後、`syaryo_kanren_system` フォルダをアーカイブ/削除
