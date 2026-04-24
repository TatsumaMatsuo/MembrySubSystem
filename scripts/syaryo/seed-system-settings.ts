/**
 * システム設定テーブルにデフォルトレコードを追加するスクリプト
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const LARK_APP_ID = process.env.LARK_APP_ID!;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET!;
const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN!;
const LARK_TABLE_SYSTEM_SETTINGS = process.env.LARK_TABLE_SYSTEM_SETTINGS!;

interface SystemSettingRecord {
  setting_key: string;
  setting_value: string;
  updated_at: number;
  updated_by: string;
}

const DEFAULT_SETTINGS: SystemSettingRecord[] = [
  {
    setting_key: "license_expiry_warning_days",
    setting_value: "30",
    updated_at: Date.now(),
    updated_by: "system",
  },
  {
    setting_key: "vehicle_expiry_warning_days",
    setting_value: "30",
    updated_at: Date.now(),
    updated_by: "system",
  },
  {
    setting_key: "insurance_expiry_warning_days",
    setting_value: "30",
    updated_at: Date.now(),
    updated_by: "system",
  },
  {
    setting_key: "admin_notification_after_days",
    setting_value: "7",
    updated_at: Date.now(),
    updated_by: "system",
  },
];

async function getAccessToken(): Promise<string> {
  const response = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: LARK_APP_ID,
        app_secret: LARK_APP_SECRET,
      }),
    }
  );

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get access token: ${data.msg}`);
  }
  return data.tenant_access_token;
}

async function getExistingSettings(accessToken: string): Promise<Map<string, string>> {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_SYSTEM_SETTINGS}/records`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  const existingKeys = new Map<string, string>();

  if (data.data?.items) {
    for (const item of data.data.items) {
      const key = item.fields.setting_key;
      if (key) {
        existingKeys.set(key, item.record_id);
      }
    }
  }

  return existingKeys;
}

async function createRecord(
  accessToken: string,
  record: SystemSettingRecord
): Promise<void> {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_SYSTEM_SETTINGS}/records`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: record }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to create record: ${data.msg}`);
  }
  console.log(`✅ Created: ${record.setting_key} = ${record.setting_value}`);
}

async function main() {
  console.log("🚀 システム設定のデフォルトレコードを追加します...\n");

  try {
    const accessToken = await getAccessToken();
    console.log("✅ アクセストークン取得成功\n");

    // 既存の設定を確認
    const existingSettings = await getExistingSettings(accessToken);
    console.log(`📋 既存の設定数: ${existingSettings.size}\n`);

    // 不足している設定を追加
    let addedCount = 0;
    for (const setting of DEFAULT_SETTINGS) {
      if (!existingSettings.has(setting.setting_key)) {
        await createRecord(accessToken, setting);
        addedCount++;
      } else {
        console.log(`⏭️  スキップ: ${setting.setting_key} (既存)`);
      }
    }

    console.log(`\n✨ 完了: ${addedCount}件追加`);

    // 現在の設定を表示
    console.log("\n📊 現在のシステム設定:");
    const updatedSettings = await getExistingSettings(accessToken);

    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_SYSTEM_SETTINGS}/records`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (data.data?.items) {
      for (const item of data.data.items) {
        console.log(`  - ${item.fields.setting_key}: ${item.fields.setting_value}`);
      }
    }

  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

main();
