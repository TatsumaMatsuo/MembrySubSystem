# Git ブランチ戦略・ワークフロー

MembrySubSystem プロジェクトのGit運用ルールです。

## 目次

1. [ブランチ戦略](#ブランチ戦略)
2. [ブランチ命名規則](#ブランチ命名規則)
3. [開発フロー](#開発フロー)
4. [コミット規約](#コミット規約)
5. [Pull Request ルール](#pull-request-ルール)
6. [マージ戦略](#マージ戦略)
7. [緊急対応（Hotfix）](#緊急対応hotfix)

---

## ブランチ戦略

### GitHub Flow ベース

```
main ─────────────────────────────────────────────►
       │                    │
       └─ feat/xxx ─────────┘ (PR & Merge)
       │                    │
       └─ fix/xxx ──────────┘ (PR & Merge)
```

### ブランチ構成

| ブランチ | 用途 | 保護 |
|----------|------|------|
| `main` | 本番環境・リリース可能な状態 | ✅ 保護 |
| `feat/*` | 新機能開発 | - |
| `fix/*` | バグ修正 | - |
| `chore/*` | 設定変更・依存更新など | - |
| `docs/*` | ドキュメント更新 | - |
| `refactor/*` | リファクタリング | - |
| `hotfix/*` | 緊急バグ修正 | - |

---

## ブランチ命名規則

### 形式

```
<type>/<issue番号または説明>
```

### 例

```bash
# Issue に紐づく場合
feat/issue-20-koutei-function
fix/issue-19-image-diff-bug

# Issue がない場合
feat/sales-analysis
fix/calendar-api
chore/update-dependencies
docs/coding-standards
refactor/menu-permission
```

### Type 一覧

| Type | 説明 | 例 |
|------|------|-----|
| `feat` | 新機能 | `feat/user-authentication` |
| `fix` | バグ修正 | `fix/login-error` |
| `chore` | 設定・依存関係 | `chore/update-package-name` |
| `docs` | ドキュメント | `docs/api-reference` |
| `refactor` | リファクタリング | `refactor/sidebar-component` |
| `test` | テスト追加・修正 | `test/menu-permission` |
| `hotfix` | 緊急修正 | `hotfix/critical-auth-bug` |

---

## 開発フロー

### 1. Issue の確認

```bash
# Issue一覧を確認
gh issue list

# Issue詳細を確認
gh issue view 20
```

### 2. ブランチ作成

```bash
# main から最新を取得
git checkout main
git pull origin main

# 新しいブランチを作成
git checkout -b feat/issue-20-koutei-function
```

### 3. 開発・コミット

```bash
# 変更をコミット（Conventional Commits形式）
git add .
git commit -m "feat: 工程表作成機能の基本UIを追加"

# 定期的にリモートへプッシュ
git push -u origin feat/issue-20-koutei-function
```

### 4. Pull Request 作成

```bash
# PR作成
gh pr create --title "feat: 工程表作成機能（営業部用）" --body "
## 概要
Issue #20 の対応

## 変更内容
- 工程表作成画面の追加
- APIエンドポイントの実装

## テスト
- [x] ローカルで動作確認済み
- [x] TypeScriptエラーなし

Closes #20
"
```

### 5. レビュー・マージ

```bash
# レビュー後、マージ
gh pr merge --squash

# ローカルブランチの削除
git checkout main
git pull origin main
git branch -d feat/issue-20-koutei-function
```

---

## コミット規約

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

| Type | 説明 | バージョン影響 |
|------|------|---------------|
| `feat` | 新機能 | minor |
| `fix` | バグ修正 | patch |
| `docs` | ドキュメント | - |
| `style` | フォーマット | - |
| `refactor` | リファクタリング | - |
| `test` | テスト | - |
| `chore` | ビルド・補助 | - |
| `perf` | パフォーマンス改善 | patch |

### 例

```bash
# 良い例
git commit -m "feat: 営業部KPI登録機能追加"
git commit -m "fix: カレンダーAPI改善 - ユーザー自身の今日の予定のみ表示"
git commit -m "docs: コーディング規約を追加"
git commit -m "chore: ESLint設定を追加"

# 悪い例
git commit -m "修正"           # 何を修正したか不明
git commit -m "update"         # 英語だが内容不明
git commit -m "WIP"            # 作業中のままコミット
```

### スコープ（オプション）

```bash
git commit -m "feat(menu): メニュー権限システムを追加"
git commit -m "fix(api): 認証エラーハンドリングを修正"
git commit -m "docs(setup): セットアップ手順を更新"
```

---

## Pull Request ルール

### PR作成時の必須事項

1. **タイトル**: Conventional Commits 形式
2. **概要**: 変更内容の説明
3. **関連Issue**: `Closes #XX` または `Refs #XX`
4. **テスト**: 動作確認済みであること

### PRテンプレート

```markdown
## 概要
<!-- 変更の概要を記載 -->

## 変更内容
<!-- 主な変更点を箇条書きで -->
-
-

## スクリーンショット
<!-- UI変更がある場合 -->

## テスト
- [ ] ローカルで動作確認済み
- [ ] TypeScriptエラーなし（`npm run lint`）
- [ ] 既存機能への影響なし

## 関連Issue
Closes #XX
```

### レビュー基準

- [ ] コードがコーディング規約に従っている
- [ ] TypeScript strict mode でエラーがない
- [ ] 適切なエラーハンドリング
- [ ] セキュリティ上の問題がない
- [ ] パフォーマンスへの悪影響がない

---

## マージ戦略

### Squash Merge（推奨）

```bash
gh pr merge --squash
```

- 複数のコミットを1つにまとめる
- mainブランチの履歴がクリーンに保たれる
- PR単位で変更を追跡しやすい

### マージ後の作業

```bash
# mainを最新に
git checkout main
git pull origin main

# 不要になったローカルブランチを削除
git branch -d feat/xxx

# リモートで削除されたブランチをローカルから削除
git fetch --prune
```

---

## 緊急対応（Hotfix）

### 本番で緊急バグが発生した場合

```bash
# 1. mainから直接hotfixブランチを作成
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# 2. 最小限の修正を実施
git add .
git commit -m "hotfix: 認証エラーの緊急修正"

# 3. 即座にPR作成・レビュー・マージ
gh pr create --title "hotfix: 認証エラーの緊急修正" --body "
## 緊急対応
本番環境で認証エラーが発生しているため緊急修正

## 変更内容
- XXXの修正

## テスト
- [x] ローカル確認済み
"

# 4. レビュー後、即座にマージ
gh pr merge --squash
```

---

## ブランチ保護ルール

### main ブランチ

- 直接pushは禁止
- PR必須
- レビュー承認必須（推奨）
- ステータスチェック必須（CI通過）

### 設定方法（GitHub）

```
Settings > Branches > Add rule
- Branch name pattern: main
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
```

---

## よく使うコマンド

```bash
# ブランチ一覧
git branch -a

# 現在のブランチ確認
git branch --show-current

# ブランチ切り替え
git checkout <branch-name>

# ブランチ作成＆切り替え
git checkout -b <new-branch>

# 変更を一時退避
git stash
git stash pop

# mainの変更を取り込む（リベース）
git checkout feat/xxx
git rebase main

# コンフリクト解消後
git add .
git rebase --continue

# Issue一覧
gh issue list

# PR一覧
gh pr list

# PR作成
gh pr create

# PRマージ
gh pr merge --squash
```

---

*最終更新: 2026-01-17*
