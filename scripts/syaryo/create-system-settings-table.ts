import { larkClient } from "../lib/lark-client";

const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";

async function createSystemSettingsTable() {
  console.log('🔧 Creating System Settings table...\n');

  try {
    // テーブルを作成
    const response = await larkClient.bitable.appTable.create({
      path: {
        app_token: LARK_BASE_TOKEN,
      },
      data: {
        table: {
          name: "システム設定",
          default_view_name: "設定一覧",
          fields: [
            {
              field_name: "設定キー",
              type: 1, // テキスト
              property: {},
            },
            {
              field_name: "設定値",
              type: 1, // テキスト
              property: {},
            },
            {
              field_name: "更新日時",
              type: 5, // 数値（タイムスタンプ）
              property: {},
            },
            {
              field_name: "更新者",
              type: 1, // テキスト
              property: {},
            },
          ],
        },
      },
    });

    if (response.code === 0 && response.data?.table_id) {
      const tableId = response.data.table_id;
      console.log('✅ Table created successfully!');
      console.log('📋 Table ID:', tableId);
      console.log('\n📝 Add this to your .env.local file:');
      console.log(`LARK_TABLE_SYSTEM_SETTINGS=${tableId}`);

      // デフォルト設定を挿入
      console.log('\n🔄 Inserting default settings...');

      const now = Date.now();
      const defaultSettings = [
        {
          setting_key: "license_expiry_warning_days",
          setting_value: "30",
        },
        {
          setting_key: "vehicle_expiry_warning_days",
          setting_value: "30",
        },
        {
          setting_key: "insurance_expiry_warning_days",
          setting_value: "30",
        },
        {
          setting_key: "admin_notification_after_days",
          setting_value: "7",
        },
      ];

      for (const setting of defaultSettings) {
        await larkClient.bitable.appTableRecord.create({
          path: {
            app_token: LARK_BASE_TOKEN,
            table_id: tableId,
          },
          data: {
            fields: {
              "設定キー": setting.setting_key,
              "設定値": setting.setting_value,
              "更新日時": now,
              "更新者": "system",
            },
          },
        });
        console.log(`  ✓ ${setting.setting_key}: ${setting.setting_value}`);
      }

      console.log('\n✅ Default settings inserted successfully!');
      console.log('\n⚠️  Important: Update your .env.local file with the table ID above!');
    } else {
      console.error('❌ Failed to create table:', response.msg);
    }
  } catch (error) {
    console.error('❌ Error creating table:', error);
  }
}

createSystemSettingsTable();
