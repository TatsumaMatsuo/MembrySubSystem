#!/usr/bin/env node

/**
 * Lark Base 環境変数セットアップスクリプト
 *
 * このスクリプトは対話的に環境変数を設定し、.env.local ファイルを生成します
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('車両関連管理システム - Lark Base 環境変数セットアップ');
  console.log('='.repeat(60));
  console.log('');

  console.log('このスクリプトは .env.local ファイルを生成します。');
  console.log('各項目について順番に入力してください。');
  console.log('（空白のまま Enter で既存値を保持、または後で手動設定）');
  console.log('');

  // 既存の .env.local を読み込む
  const envPath = path.join(__dirname, '..', '.env.local');
  let existingEnv = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        existingEnv[match[1]] = match[2];
      }
    });
    console.log('既存の .env.local を検出しました。');
    console.log('');
  }

  const config = {};

  // Lark App ID
  const larkAppId = await question(
    `Lark App ID (例: cli_a1b2c3d4e5f6) [${existingEnv.LARK_APP_ID || 'なし'}]: `
  );
  config.LARK_APP_ID = larkAppId || existingEnv.LARK_APP_ID || '';

  // Lark App Secret
  const larkAppSecret = await question(
    `Lark App Secret [${existingEnv.LARK_APP_SECRET ? '設定済み' : 'なし'}]: `
  );
  config.LARK_APP_SECRET =
    larkAppSecret || existingEnv.LARK_APP_SECRET || '';

  // Lark Base Token
  const larkBaseToken = await question(
    `Lark Base Token (例: bascXXXXXXXX) [${existingEnv.LARK_BASE_TOKEN || 'なし'}]: `
  );
  config.LARK_BASE_TOKEN = larkBaseToken || existingEnv.LARK_BASE_TOKEN || '';

  console.log('');
  console.log('--- テーブルID ---');

  // Table IDs
  const tableIds = {
    LARK_TABLE_DRIVERS_LICENSES: '免許証テーブル',
    LARK_TABLE_VEHICLE_REGISTRATIONS: '車検証テーブル',
    LARK_TABLE_INSURANCE_POLICIES: '任意保険テーブル',
    LARK_TABLE_EMPLOYEES: '社員マスタテーブル',
    LARK_TABLE_USER_PERMISSIONS: 'ユーザー権限テーブル',
    LARK_TABLE_NOTIFICATION_HISTORY: '通知履歴テーブル',
  };

  for (const [key, label] of Object.entries(tableIds)) {
    const value = await question(
      `${label} ID (例: tblXXXXXXXX) [${existingEnv[key] || 'なし'}]: `
    );
    config[key] = value || existingEnv[key] || '';
  }

  console.log('');
  console.log('--- OAuth設定 ---');

  // OAuth
  const oauthClientId = await question(
    `OAuth Client ID (通常はApp IDと同じ) [${existingEnv.LARK_OAUTH_CLIENT_ID || config.LARK_APP_ID}]: `
  );
  config.LARK_OAUTH_CLIENT_ID =
    oauthClientId || existingEnv.LARK_OAUTH_CLIENT_ID || config.LARK_APP_ID;

  const oauthClientSecret = await question(
    `OAuth Client Secret (通常はApp Secretと同じ) [${existingEnv.LARK_OAUTH_CLIENT_SECRET ? '設定済み' : config.LARK_APP_SECRET}]: `
  );
  config.LARK_OAUTH_CLIENT_SECRET =
    oauthClientSecret ||
    existingEnv.LARK_OAUTH_CLIENT_SECRET ||
    config.LARK_APP_SECRET;

  const oauthRedirectUri = await question(
    `OAuth Redirect URI [${existingEnv.LARK_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/auth/callback/lark'}]: `
  );
  config.LARK_OAUTH_REDIRECT_URI =
    oauthRedirectUri ||
    existingEnv.LARK_OAUTH_REDIRECT_URI ||
    'http://localhost:3001/api/auth/callback/lark';

  console.log('');
  console.log('--- NextAuth設定 ---');

  // NextAuth
  const nextauthUrl = await question(
    `NextAuth URL [${existingEnv.NEXTAUTH_URL || 'http://localhost:3001'}]: `
  );
  config.NEXTAUTH_URL =
    nextauthUrl || existingEnv.NEXTAUTH_URL || 'http://localhost:3001';

  // NextAuth Secret
  let nextauthSecret = existingEnv.NEXTAUTH_SECRET;
  if (!nextauthSecret) {
    console.log('NextAuth Secretを自動生成します...');
    nextauthSecret = crypto.randomBytes(32).toString('base64');
  }
  const customSecret = await question(
    `NextAuth Secret [自動生成または既存値を使用]: `
  );
  config.NEXTAUTH_SECRET = customSecret || nextauthSecret;

  console.log('');
  console.log('--- 通知・ストレージ設定（オプション） ---');

  // Webhook
  const webhookUrl = await question(
    `Lark Bot Webhook URL [${existingEnv.LARK_BOT_WEBHOOK_URL || 'スキップ'}]: `
  );
  config.LARK_BOT_WEBHOOK_URL =
    webhookUrl || existingEnv.LARK_BOT_WEBHOOK_URL || '';

  // Drive Folder
  const folderId = await question(
    `Lark Drive Folder ID [${existingEnv.LARK_DRIVE_FOLDER_ID || 'スキップ'}]: `
  );
  config.LARK_DRIVE_FOLDER_ID =
    folderId || existingEnv.LARK_DRIVE_FOLDER_ID || '';

  // Node Environment
  const nodeEnv = await question(
    `Node Environment [${existingEnv.NODE_ENV || 'development'}]: `
  );
  config.NODE_ENV = nodeEnv || existingEnv.NODE_ENV || 'development';

  console.log('');
  console.log('='.repeat(60));
  console.log('設定内容:');
  console.log('='.repeat(60));

  // .env.local ファイルを生成
  const envContent = `# Lark Base Configuration
LARK_APP_ID=${config.LARK_APP_ID}
LARK_APP_SECRET=${config.LARK_APP_SECRET}
LARK_BASE_TOKEN=${config.LARK_BASE_TOKEN}

# Lark Base Table IDs
LARK_TABLE_DRIVERS_LICENSES=${config.LARK_TABLE_DRIVERS_LICENSES}
LARK_TABLE_VEHICLE_REGISTRATIONS=${config.LARK_TABLE_VEHICLE_REGISTRATIONS}
LARK_TABLE_INSURANCE_POLICIES=${config.LARK_TABLE_INSURANCE_POLICIES}
LARK_TABLE_EMPLOYEES=${config.LARK_TABLE_EMPLOYEES}
LARK_TABLE_USER_PERMISSIONS=${config.LARK_TABLE_USER_PERMISSIONS}
LARK_TABLE_NOTIFICATION_HISTORY=${config.LARK_TABLE_NOTIFICATION_HISTORY}

# Lark OAuth Configuration
LARK_OAUTH_CLIENT_ID=${config.LARK_OAUTH_CLIENT_ID}
LARK_OAUTH_CLIENT_SECRET=${config.LARK_OAUTH_CLIENT_SECRET}
LARK_OAUTH_REDIRECT_URI=${config.LARK_OAUTH_REDIRECT_URI}

# NextAuth Configuration
NEXTAUTH_URL=${config.NEXTAUTH_URL}
NEXTAUTH_SECRET=${config.NEXTAUTH_SECRET}

# Lark Messenger API (通知用)
LARK_BOT_WEBHOOK_URL=${config.LARK_BOT_WEBHOOK_URL}

# Lark Drive API (ファイルストレージ)
LARK_DRIVE_FOLDER_ID=${config.LARK_DRIVE_FOLDER_ID}

# Node Environment
NODE_ENV=${config.NODE_ENV}
`;

  console.log(envContent);
  console.log('='.repeat(60));

  const confirm = await question(
    '\n.env.local ファイルに保存しますか？ (y/n): '
  );

  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local ファイルを保存しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. 開発サーバーを再起動してください: npm run dev');
    console.log(
      '2. 接続テストを実行してください: http://localhost:3001/api/test/lark-connection'
    );
  } else {
    console.log('キャンセルしました。');
  }

  rl.close();
}

main().catch((error) => {
  console.error('エラーが発生しました:', error);
  rl.close();
  process.exit(1);
});
