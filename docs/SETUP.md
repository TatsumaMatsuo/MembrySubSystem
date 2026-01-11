# MembrySubSystem 共同開発環境構築手順書

## 概要

本ドキュメントは、MembrySubSystem プロジェクトの共同開発環境構築手順を記載します。
Miyabiフレームワークによる自律型開発とGitHubでのソース管理を前提としています。

---

## 1. 必要なツールのインストール

### 1.1 必須ツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 18.x 以上 | JavaScript実行環境 |
| npm | 9.x 以上 | パッケージ管理 |
| Git | 2.40 以上 | バージョン管理 |
| GitHub CLI (gh) | 2.x 以上 | GitHub操作 |
| Claude Code | 最新 | AI支援開発 |

### 1.2 インストール手順

```bash
# Node.js (Windows - winget)
winget install OpenJS.NodeJS.LTS

# GitHub CLI
winget install GitHub.cli

# Claude Code
npm install -g @anthropic/claude-code
```

### 1.3 インストール確認

```bash
node --version    # v18.x.x 以上
npm --version     # 9.x.x 以上
git --version     # 2.40.x 以上
gh --version      # gh version 2.x.x
claude --version  # Claude Code version
```

---

## 2. GitHubアカウント設定

### 2.1 GitHub認証

```bash
# GitHub CLIでログイン
gh auth login

# 認証状態確認
gh auth status
```

### 2.2 リポジトリアクセス設定

```bash
# リポジトリをクローン
git clone https://github.com/TatsumaMatsuo/MembrySubSystem.git
cd MembrySubSystem

# リモート確認
git remote -v
```

### 2.3 Git設定

```bash
# ユーザー情報設定（必須）
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 推奨設定
git config pull.rebase false
git config core.autocrlf true   # Windows
git config core.ignorecase false
```

---

## 3. プロジェクトセットアップ

### 3.1 依存関係インストール

```bash
# プロジェクトディレクトリに移動
cd MembrySubSystem

# 依存関係をインストール
npm install
```

### 3.2 環境変数設定

```bash
# .env.example をコピー
cp .env.example .env.local
```

`.env.local` を編集して必要な値を設定:

```bash
# Lark API設定（管理者から取得）
LARK_APP_ID=cli_xxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxx
LARK_BASE_TOKEN=xxxxxxxxxxxxxx

# NextAuth設定
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:4000

# GitHub関連（Miyabi Agent用）
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### 3.3 動作確認

```bash
# 開発サーバー起動
npm run dev

# ブラウザで確認
# http://localhost:4000
```

---

## 4. Miyabi フレームワーク設定

### 4.1 Miyabi初期化確認

```bash
# Miyabiステータス確認
npx miyabi status

# システムヘルスチェック
npx miyabi doctor
```

### 4.2 Miyabi設定ファイル

`.miyabi.yml` が既に設定済み。主要設定:

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| framework | nextjs | Next.jsプロジェクト |
| language | typescript | TypeScript使用 |
| quality_threshold | 80 | 品質スコア閾値 |
| draft_by_default | true | Draft PRを作成 |

### 4.3 Claude Code設定

```bash
# Claude Codeを起動
claude

# Miyabi自動モード起動
/miyabi-auto
```

---

## 5. Git ブランチ戦略

### 5.1 ブランチ命名規則

| プレフィックス | 用途 | 例 |
|--------------|------|-----|
| `main` | 本番環境（保護） | - |
| `develop` | 開発統合 | - |
| `feat/` | 新機能開発 | `feat/user-auth` |
| `fix/` | バグ修正 | `fix/login-error` |
| `refactor/` | リファクタリング | `refactor/api-client` |
| `docs/` | ドキュメント | `docs/setup-guide` |
| `chore/` | 雑務・設定変更 | `chore/update-deps` |

### 5.2 ブランチ作成手順

```bash
# 最新のmainを取得
git checkout main
git pull origin main

# 新しいブランチを作成
git checkout -b feat/your-feature-name

# 作業後、コミット
git add .
git commit -m "feat: 機能の説明"

# リモートにプッシュ
git push -u origin feat/your-feature-name
```

### 5.3 Conventional Commits

コミットメッセージは以下の形式に従う:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type一覧:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードスタイル（機能変更なし）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: 雑務・ビルド設定

**例:**
```bash
git commit -m "feat(auth): Lark OAuth認証を追加"
git commit -m "fix(api): 売約データ取得エラーを修正"
```

---

## 6. 開発ワークフロー（Miyabi連携）

### 6.1 Issue駆動開発

```
1. Issue作成 → 2. Agent分析 → 3. 実装 → 4. PR作成 → 5. レビュー → 6. マージ
```

### 6.2 Issue作成

```bash
# Claude Codeから作成（推奨）
/create-issue

# または gh コマンド
gh issue create --title "feat: 機能名" --body "説明"
```

### 6.3 Miyabi Agent 自動処理

```bash
# Water Spider全自動モード
npx miyabi auto

# 状態確認
npx miyabi status

# 単一Issue処理
/miyabi-agent
```

### 6.4 Pull Request作成

```bash
# Claude CodeでPR作成
# Agentが自動的にDraft PRを作成

# 手動でPR作成する場合
gh pr create --title "feat: 機能名" --body "説明" --draft
```

---

## 7. コードレビュープロセス

### 7.1 レビュー基準

| 項目 | 基準 |
|------|------|
| 品質スコア | 80点以上 |
| テストカバレッジ | 80%以上 |
| Lintエラー | 0件 |
| セキュリティ | 脆弱性なし |

### 7.2 レビューAgent

ReviewAgentが自動的に以下をチェック:
- 静的解析
- セキュリティスキャン
- コードスタイル
- 品質スコアリング

### 7.3 人間レビュー

Draft PR → Ready for Review → Approve → Merge

```bash
# PRをレビュー状態に変更
gh pr ready <PR番号>

# PRをマージ
gh pr merge <PR番号> --squash
```

---

## 8. CI/CD パイプライン

### 8.1 GitHub Actions ワークフロー

| ワークフロー | トリガー | 説明 |
|------------|---------|------|
| `issue-opened.yml` | Issue作成 | Agent自動分析 |
| `pr-opened.yml` | PR作成 | 自動レビュー |
| `autonomous-agent.yml` | Issue | Agent自動実行 |
| `deploy-pages.yml` | main push | 自動デプロイ |

### 8.2 必要なSecrets設定

リポジトリ Settings → Secrets and variables → Actions:

| Secret名 | 説明 |
|----------|------|
| `ANTHROPIC_API_KEY` | Claude API キー |
| `LARK_APP_ID` | Lark アプリID |
| `LARK_APP_SECRET` | Lark アプリシークレット |

---

## 9. コーディング規約

### 9.1 TypeScript設定

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "target": "ES2022"
  }
}
```

### 9.2 ファイル構成

```
MembrySubSystem/
├── app/                    # Next.js App Router
│   ├── api/               # APIルート
│   ├── (routes)/          # ページルート
│   └── layout.tsx         # ルートレイアウト
├── components/            # Reactコンポーネント
│   ├── ui/               # 汎用UIコンポーネント
│   └── layout/           # レイアウトコンポーネント
├── lib/                   # ユーティリティ・API
├── hooks/                 # カスタムフック
├── docs/                  # ドキュメント
└── tests/                 # テストコード
```

### 9.3 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `UserProfile.tsx` |
| 関数 | camelCase | `getUserData()` |
| 定数 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| ファイル | kebab-case | `user-profile.ts` |

---

## 10. トラブルシューティング

### 10.1 よくある問題

**Q: `npm install` でエラー**
```bash
# node_modules削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

**Q: 開発サーバーが起動しない**
```bash
# .nextキャッシュクリア
npm run dev:clean
```

**Q: GitHub認証エラー**
```bash
# 再認証
gh auth logout
gh auth login
```

**Q: Miyabiが動作しない**
```bash
# 診断実行
npx miyabi doctor

# 環境変数確認
cat .env.local | grep -E "(GITHUB|ANTHROPIC)"
```

### 10.2 サポート

- **Issue報告**: GitHub Issues で報告
- **ドキュメント**: `/docs` ディレクトリ参照
- **Miyabi**: `npx miyabi --help`

---

## 11. セキュリティガイドライン

### 11.1 機密情報管理

- `.env` ファイルは **絶対にコミットしない**
- `.env.example` にはダミー値のみ記載
- Secrets は GitHub Settings で管理

### 11.2 禁止事項

- APIキー・トークンのハードコーディング
- 本番データのローカル保存
- セキュリティ警告の無視

---

## 12. 参考リンク

- [Miyabi Framework](https://github.com/ShunsukeHayashi/Autonomous-Operations)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 更新履歴

| 日付 | 更新内容 | 担当 |
|------|---------|------|
| 2026-01-11 | 初版作成 | Claude Code |

---

*このドキュメントは Issue #13 に基づいて作成されました。*
