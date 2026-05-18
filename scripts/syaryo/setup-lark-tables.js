#!/usr/bin/env node

/**
 * Lark Baseテーブルのフィールドを自動作成するスクリプト
 */

const lark = require("@larksuiteoapi/node-sdk");
const fs = require('fs');
const path = require('path');

// .env.localから環境変数を読み込む
const envPath = path.join(__dirname, '..', '.env.local');
console.log('Loading .env.local from:', envPath);
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

console.log('Loaded environment variables:', Object.keys(env));

const client = new lark.Client({
  appId: env.LARK_APP_ID || process.env.LARK_APP_ID,
  appSecret: env.LARK_APP_SECRET || process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Feishu,
});

const BASE_TOKEN = env.LARK_BASE_TOKEN || process.env.LARK_BASE_TOKEN;

// フィールドタイプの定義
const FieldType = {
  TEXT: 1,        // テキスト
  NUMBER: 2,      // 数値
  SINGLE_SELECT: 3, // 単一選択
  MULTI_SELECT: 4,  // 複数選択
  DATE: 5,        // 日付
  CHECKBOX: 7,    // チェックボックス
  PERSON: 11,     // ユーザー
  PHONE: 13,      // 電話番号
  URL: 15,        // URL
  ATTACHMENT: 17, // 添付ファイル
  DATETIME: 1001, // 日付時刻
  EMAIL: 1004,    // メール
};

// 免許証テーブルのフィールド定義
const driversLicenseFields = [
  {
    field_name: "id",
    type: FieldType.TEXT,
    description: "レコードID"
  },
  {
    field_name: "issue_date",
    type: FieldType.DATE,
    description: "発行日"
  },
  {
    field_name: "image_url",
    type: FieldType.TEXT,
    description: "画像URL"
  },
  {
    field_name: "status",
    type: FieldType.SINGLE_SELECT,
    description: "ステータス",
    property: {
      options: [
        { name: "temporary" },
        { name: "approved" }
      ]
    }
  },
  {
    field_name: "approval_status",
    type: FieldType.SINGLE_SELECT,
    description: "承認状態",
    property: {
      options: [
        { name: "pending" },
        { name: "approved" },
        { name: "rejected" }
      ]
    }
  },
  {
    field_name: "rejection_reason",
    type: FieldType.TEXT,
    description: "却下理由"
  },
  {
    field_name: "created_at",
    type: FieldType.DATETIME,
    description: "作成日時"
  },
  {
    field_name: "updated_at",
    type: FieldType.DATETIME,
    description: "更新日時"
  },
  {
    field_name: "deleted_flag",
    type: FieldType.CHECKBOX,
    description: "削除フラグ"
  },
  {
    field_name: "deleted_at",
    type: FieldType.DATETIME,
    description: "削除日時"
  }
];

// 車検証テーブルのフィールド定義
const vehicleRegistrationFields = [
  {
    field_name: "id",
    type: FieldType.TEXT,
    description: "レコードID"
  },
  {
    field_name: "manufacturer",
    type: FieldType.TEXT,
    description: "メーカー"
  },
  {
    field_name: "model_name",
    type: FieldType.TEXT,
    description: "車名"
  },
  {
    field_name: "owner_name",
    type: FieldType.TEXT,
    description: "所有者名"
  },
  {
    field_name: "image_url",
    type: FieldType.TEXT,
    description: "画像URL"
  },
  {
    field_name: "status",
    type: FieldType.SINGLE_SELECT,
    description: "ステータス",
    property: {
      options: [
        { name: "temporary" },
        { name: "approved" }
      ]
    }
  },
  {
    field_name: "approval_status",
    type: FieldType.SINGLE_SELECT,
    description: "承認状態",
    property: {
      options: [
        { name: "pending" },
        { name: "approved" },
        { name: "rejected" }
      ]
    }
  },
  {
    field_name: "rejection_reason",
    type: FieldType.TEXT,
    description: "却下理由"
  },
  {
    field_name: "created_at",
    type: FieldType.DATETIME,
    description: "作成日時"
  },
  {
    field_name: "updated_at",
    type: FieldType.DATETIME,
    description: "更新日時"
  },
  {
    field_name: "deleted_flag",
    type: FieldType.CHECKBOX,
    description: "削除フラグ"
  },
  {
    field_name: "deleted_at",
    type: FieldType.DATETIME,
    description: "削除日時"
  }
];

// 任意保険証テーブルのフィールド定義
const insurancePolicyFields = [
  {
    field_name: "id",
    type: FieldType.TEXT,
    description: "レコードID"
  },
  {
    field_name: "insurance_company",
    type: FieldType.TEXT,
    description: "保険会社名"
  },
  {
    field_name: "coverage_start_date",
    type: FieldType.DATE,
    description: "補償開始日"
  },
  {
    field_name: "insured_amount",
    type: FieldType.NUMBER,
    description: "補償金額"
  },
  {
    field_name: "image_url",
    type: FieldType.TEXT,
    description: "画像URL"
  },
  {
    field_name: "status",
    type: FieldType.SINGLE_SELECT,
    description: "ステータス",
    property: {
      options: [
        { name: "temporary" },
        { name: "approved" }
      ]
    }
  },
  {
    field_name: "approval_status",
    type: FieldType.SINGLE_SELECT,
    description: "承認状態",
    property: {
      options: [
        { name: "pending" },
        { name: "approved" },
        { name: "rejected" }
      ]
    }
  },
  {
    field_name: "rejection_reason",
    type: FieldType.TEXT,
    description: "却下理由"
  },
  {
    field_name: "created_at",
    type: FieldType.DATETIME,
    description: "作成日時"
  },
  {
    field_name: "updated_at",
    type: FieldType.DATETIME,
    description: "更新日時"
  },
  {
    field_name: "deleted_flag",
    type: FieldType.CHECKBOX,
    description: "削除フラグ"
  },
  {
    field_name: "deleted_at",
    type: FieldType.DATETIME,
    description: "削除日時"
  }
];

// 社員マスタテーブルのフィールド定義
const employeeFields = [
  {
    field_name: "department",
    type: FieldType.TEXT,
    description: "所属部署"
  },
  {
    field_name: "hire_date",
    type: FieldType.DATE,
    description: "入社日"
  },
  {
    field_name: "resignation_date",
    type: FieldType.DATE,
    description: "退職日"
  },
  {
    field_name: "created_at",
    type: FieldType.DATETIME,
    description: "作成日時"
  },
  {
    field_name: "updated_at",
    type: FieldType.DATETIME,
    description: "更新日時"
  }
];

async function createField(tableId, fieldDef) {
  try {
    const response = await client.bitable.appTableField.create({
      path: {
        app_token: BASE_TOKEN,
        table_id: tableId,
      },
      data: fieldDef,
    });

    if (response.code === 0) {
      console.log(`  ✓ フィールド「${fieldDef.field_name}」を作成しました`);
      return true;
    } else {
      console.log(`  ⚠ フィールド「${fieldDef.field_name}」: ${response.msg}`);
      return false;
    }
  } catch (error) {
    console.log(`  ✗ フィールド「${fieldDef.field_name}」の作成に失敗: ${error.message}`);
    return false;
  }
}

async function setupTable(tableName, tableId, fields) {
  console.log(`\n📋 ${tableName} テーブルのセットアップ中...`);
  console.log(`   テーブルID: ${tableId}`);

  let successCount = 0;
  let skipCount = 0;

  for (const field of fields) {
    const result = await createField(tableId, field);
    if (result) {
      successCount++;
    } else {
      skipCount++;
    }
    // API制限を避けるため少し待つ
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ ${tableName}: ${successCount}個のフィールドを作成、${skipCount}個をスキップ`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Lark Base テーブルフィールド自動セットアップ');
  console.log('='.repeat(60));

  // 環境変数の確認
  if (!env.LARK_APP_ID || !env.LARK_APP_SECRET || !env.LARK_BASE_TOKEN) {
    console.error('❌ エラー: 環境変数が設定されていません');
    console.error('   LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_TOKEN を設定してください');
    process.exit(1);
  }

  const tables = [
    {
      name: '免許証 (drivers_licenses)',
      id: env.LARK_TABLE_DRIVERS_LICENSES || process.env.LARK_TABLE_DRIVERS_LICENSES,
      fields: driversLicenseFields
    },
    {
      name: '車検証 (vehicle_registrations)',
      id: env.LARK_TABLE_VEHICLE_REGISTRATIONS || process.env.LARK_TABLE_VEHICLE_REGISTRATIONS,
      fields: vehicleRegistrationFields
    },
    {
      name: '任意保険 (insurance_policies)',
      id: env.LARK_TABLE_INSURANCE_POLICIES || process.env.LARK_TABLE_INSURANCE_POLICIES,
      fields: insurancePolicyFields
    },
    {
      name: '社員マスタ (employees)',
      id: env.LARK_TABLE_EMPLOYEES || process.env.LARK_TABLE_EMPLOYEES,
      fields: employeeFields
    }
  ];

  // 各テーブルのセットアップ
  for (const table of tables) {
    if (!table.id) {
      console.log(`\n⚠️  ${table.name}: テーブルIDが設定されていません。スキップします。`);
      continue;
    }
    await setupTable(table.name, table.id, table.fields);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ セットアップ完了！');
  console.log('='.repeat(60));
  console.log('\n次のステップ:');
  console.log('1. 開発サーバーを再起動: npm run dev');
  console.log('2. 接続テスト: http://localhost:3002/api/test/lark-connection');
  console.log('3. 申請フォームでテスト: http://localhost:3002/dashboard/license/new');
}

main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
