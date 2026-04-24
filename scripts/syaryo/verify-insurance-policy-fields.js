#!/usr/bin/env node

// 任意保険証テーブルのフィールド設定を検証するスクリプト
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

const REQUIRED_FIELDS = [
  { name: "policy_number", type: 1 },
  { name: "insurance_company", type: 1 },
  { name: "policy_type", type: 1 },
  { name: "coverage_start_date", type: 5 },
  { name: "coverage_end_date", type: 5 },
  { name: "insured_amount", type: 2 },
  { name: "image_url", type: 1 },
  { name: "status", type: 3 },
  { name: "approval_status", type: 3 },
  { name: "rejection_reason", type: 1 },
  { name: "created_at", type: 1001 },
  { name: "deleted_flag", type: 7 },
  { name: "deleted_at", type: 1001 },
];

async function verifyFields() {
  try {
    console.log("=== 任意保険証テーブル フィールド設定検証 ===\n");

    const response = await client.bitable.appTableField.list({
      path: {
        app_token: env.LARK_BASE_TOKEN,
        table_id: env.LARK_TABLE_INSURANCE_POLICIES,
      },
    });

    const existingFields = response.data?.items || [];
    console.log(`現在のフィールド数: ${existingFields.length}\n`);

    // 各必須フィールドをチェック
    let allOk = true;
    REQUIRED_FIELDS.forEach((required) => {
      const found = existingFields.find(
        (f) => f.field_name === required.name && f.type === required.type
      );

      if (found) {
        console.log(`✅ ${required.name} - OK`);
      } else {
        console.log(`❌ ${required.name} - 見つかりません`);
        allOk = false;
      }
    });

    console.log("\n" + "=".repeat(50));

    if (allOk) {
      console.log("✅ すべてのフィールドが正しく設定されています！");
      console.log("\n次のステップ:");
      console.log("1. ブラウザでテスト: http://localhost:3003/dashboard/insurance/new");
    } else {
      console.log("❌ 一部のフィールドが不足しています");
      console.log("\nLark Baseで以下のフィールドを追加してください:");
      REQUIRED_FIELDS.forEach((required) => {
        const found = existingFields.find(
          (f) => f.field_name === required.name
        );
        if (!found) {
          const typeNames = {
            1: "テキスト",
            2: "数値",
            3: "単一選択",
            5: "日付",
            7: "チェックボックス",
            1001: "日付時刻",
          };
          console.log(`  - ${required.name} (${typeNames[required.type]})`);
        }
      });
    }

    console.log("\n現在のフィールド一覧:");
    existingFields.forEach((field, i) => {
      console.log(`${i + 1}. ${field.field_name} (タイプ: ${field.type})`);
    });
  } catch (error) {
    console.error("❌ エラー:", error.message);
  }
}

verifyFields();
