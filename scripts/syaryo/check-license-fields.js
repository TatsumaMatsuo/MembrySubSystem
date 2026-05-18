// 免許証テーブルのフィールド一覧を取得
const lark = require("@larksuiteoapi/node-sdk");
const fs = require('fs');
const path = require('path');

// .env.localから環境変数を読み込む
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

const client = new lark.Client({
  appId: env.LARK_APP_ID,
  appSecret: env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Feishu,
});

async function checkTableFields() {
  try {
    console.log("=== 免許証テーブル フィールド確認 ===\n");

    const response = await client.bitable.appTableField.list({
      path: {
        app_token: env.LARK_BASE_TOKEN,
        table_id: env.LARK_TABLE_DRIVERS_LICENSES,
      },
    });

    console.log("✅ テーブルのフィールド一覧:\n");

    if (response.data?.items) {
      response.data.items.forEach((field, index) => {
        console.log(`${index + 1}. フィールド名: ${field.field_name}`);
        console.log(`   タイプ: ${field.type}`);
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ エラー:", error.message);
  }
}

checkTableFields();
