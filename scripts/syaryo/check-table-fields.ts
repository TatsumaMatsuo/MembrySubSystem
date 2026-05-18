/**
 * テーブルフィールド定義確認スクリプト
 * Lark Baseのテーブルフィールドを確認
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkTableFields() {
  console.log("🔍 テーブルフィールド定義確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  const tables = [
    { id: process.env.LARK_TABLE_DRIVERS_LICENSES || "", name: "運転免許証" },
    { id: process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || "", name: "車検証" },
    { id: process.env.LARK_TABLE_INSURANCE_POLICIES || "", name: "任意保険証" },
  ];

  try {
    for (const table of tables) {
      console.log(`📋 ${table.name}テーブル (${table.id})`);
      console.log("─".repeat(60));

      const response = await larkClient.bitable.appTableField.list({
        path: {
          app_token: LARK_BASE_TOKEN,
          table_id: table.id,
        },
      });

      const fields = response.data?.items || [];
      console.log(`フィールド数: ${fields.length}\n`);

      fields.forEach((field: any, index: number) => {
        console.log(`${index + 1}. ${field.field_name}`);
        console.log(`   ID: ${field.field_id}`);
        console.log(`   タイプ: ${field.type}`);
        console.log("");
      });

      console.log("");
    }

    console.log("✨ フィールド定義確認完了！");
    console.log("\n💡 次のステップ:");
    console.log("   1. 上記のフィールド名を使用してスクリプトを修正");
    console.log("   2. 存在しないフィールドは削除するか、テーブルに追加");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkTableFields()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
