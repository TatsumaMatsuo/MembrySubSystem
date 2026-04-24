# syaryo_kanren_system - GitHubイシュー一括作成スクリプト (PowerShell)
# Usage: .\scripts\create-issues.ps1

$ErrorActionPreference = "Stop"

$REPO = "TatsumaMatsuo/syaryo_kanren_system"
$TEMPLATE_DIR = ".github\ISSUE_TEMPLATE"

Write-Host "🤖 syaryo_kanren_system - GitHub Issue Creator" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# GitHub CLIがインストールされているか確認
try {
    gh --version | Out-Null
} catch {
    Write-Host "❌ GitHub CLI (gh) がインストールされていません" -ForegroundColor Red
    Write-Host ""
    Write-Host "インストール方法:"
    Write-Host "  winget install GitHub.cli"
    exit 1
}

# GitHub CLIが認証されているか確認
try {
    gh auth status 2>&1 | Out-Null
} catch {
    Write-Host "❌ GitHub CLI が認証されていません" -ForegroundColor Red
    Write-Host ""
    Write-Host "認証方法:"
    Write-Host "  gh auth login"
    exit 1
}

Write-Host "✅ GitHub CLI 認証確認" -ForegroundColor Green
Write-Host ""

# イシュー作成関数
function Create-Issue {
    param(
        [int]$Num,
        [string]$Title,
        [string]$Template,
        [string]$Labels
    )

    Write-Host "[$Num/8] Creating: $Title"

    try {
        gh issue create `
            --repo $REPO `
            --title $Title `
            --label $Labels `
            --template $Template `
            2>&1 | Out-Null
        Write-Host "  ✅ Created" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Skipped (may already exist)" -ForegroundColor Yellow
    }
}

Write-Host "📝 Creating 8 issues from templates..." -ForegroundColor Cyan
Write-Host ""

# Priority: High
Create-Issue 1 "🔔 Lark Messenger通知機能の実装" `
    "01-lark-notification.md" `
    "enhancement,priority-high"

Create-Issue 2 "📜 承認履歴の記録機能の実装" `
    "02-approval-history.md" `
    "enhancement,priority-high"

Create-Issue 3 "🔒 ファイルAPIのセキュリティ強化" `
    "03-file-api-security.md" `
    "security,priority-high"

# Priority: Medium
Create-Issue 4 "✅ 個別承認・却下機能の実装" `
    "04-individual-approval.md" `
    "enhancement,priority-medium"

Create-Issue 5 "📄 Content-Type動的設定の実装" `
    "05-content-type-dynamic.md" `
    "enhancement,priority-medium"

Create-Issue 6 "📱 モバイル・タブレット対応の実装" `
    "06-mobile-responsive.md" `
    "enhancement,priority-medium,ui/ux"

# Priority: Low
Create-Issue 7 "📄 PDFプレビュー対応の実装" `
    "07-pdf-preview.md" `
    "enhancement,priority-low"

Create-Issue 8 "🔄 画像回転機能の実装" `
    "08-image-rotation.md" `
    "enhancement,priority-low,ui/ux"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "✅ Issue creation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "View issues: https://github.com/$REPO/issues" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Recommended implementation order:" -ForegroundColor Yellow
Write-Host "  1. 🔒 File API Security (High)"
Write-Host "  2. 📜 Approval History (High)"
Write-Host "  3. 🔔 Lark Notification (High)"
Write-Host "  4. ✅ Individual Approval (Medium)"
Write-Host "  5. 📄 Content-Type Dynamic (Medium)"
Write-Host "  6. 📱 Mobile Responsive (Medium)"
Write-Host "  7. 📄 PDF Preview (Low)"
Write-Host "  8. 🔄 Image Rotation (Low)"
Write-Host ""
