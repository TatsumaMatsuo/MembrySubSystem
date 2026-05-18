#!/bin/bash

# syaryo_kanren_system - GitHubイシュー一括作成スクリプト
# Usage: ./scripts/create-issues.sh

set -e

REPO="TatsumaMatsuo/syaryo_kanren_system"
TEMPLATE_DIR=".github/ISSUE_TEMPLATE"

echo "🤖 syaryo_kanren_system - GitHub Issue Creator"
echo "=============================================="
echo ""

# GitHub CLIがインストールされているか確認
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) がインストールされていません"
    echo ""
    echo "インストール方法:"
    echo "  Windows: winget install GitHub.cli"
    echo "  macOS:   brew install gh"
    echo "  Linux:   https://github.com/cli/cli#installation"
    exit 1
fi

# GitHub CLIが認証されているか確認
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI が認証されていません"
    echo ""
    echo "認証方法:"
    echo "  gh auth login"
    exit 1
fi

echo "✅ GitHub CLI 認証確認"
echo ""

# イシュー作成関数
create_issue() {
    local num=$1
    local title=$2
    local template=$3
    local labels=$4

    echo "[$num/8] Creating: $title"

    if gh issue create \
        --repo "$REPO" \
        --title "$title" \
        --label "$labels" \
        --template "$template" \
        > /dev/null 2>&1; then
        echo "  ✅ Created"
    else
        echo "  ⚠️  Skipped (may already exist)"
    fi
}

echo "📝 Creating 8 issues from templates..."
echo ""

# Priority: High
create_issue 1 "🔔 Lark Messenger通知機能の実装" \
    "01-lark-notification.md" \
    "enhancement,priority-high"

create_issue 2 "📜 承認履歴の記録機能の実装" \
    "02-approval-history.md" \
    "enhancement,priority-high"

create_issue 3 "🔒 ファイルAPIのセキュリティ強化" \
    "03-file-api-security.md" \
    "security,priority-high"

# Priority: Medium
create_issue 4 "✅ 個別承認・却下機能の実装" \
    "04-individual-approval.md" \
    "enhancement,priority-medium"

create_issue 5 "📄 Content-Type動的設定の実装" \
    "05-content-type-dynamic.md" \
    "enhancement,priority-medium"

create_issue 6 "📱 モバイル・タブレット対応の実装" \
    "06-mobile-responsive.md" \
    "enhancement,priority-medium,ui/ux"

# Priority: Low
create_issue 7 "📄 PDFプレビュー対応の実装" \
    "07-pdf-preview.md" \
    "enhancement,priority-low"

create_issue 8 "🔄 画像回転機能の実装" \
    "08-image-rotation.md" \
    "enhancement,priority-low,ui/ux"

echo ""
echo "=============================================="
echo "✅ Issue creation completed!"
echo ""
echo "View issues: https://github.com/$REPO/issues"
echo ""
echo "🎯 Recommended implementation order:"
echo "  1. 🔒 File API Security (High)"
echo "  2. 📜 Approval History (High)"
echo "  3. 🔔 Lark Notification (High)"
echo "  4. ✅ Individual Approval (Medium)"
echo "  5. 📄 Content-Type Dynamic (Medium)"
echo "  6. 📱 Mobile Responsive (Medium)"
echo "  7. 📄 PDF Preview (Low)"
echo "  8. 🔄 Image Rotation (Low)"
echo ""
