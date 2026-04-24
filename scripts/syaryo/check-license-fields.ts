/**
 * 運転免許証テーブルのフィールド定義確認
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkLicenseFields() {
  console.log("🔍 運転免許証テーブルフィールド確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    console.log("📋 フィールド定義:");
    const fieldsResponse = await larkClient.bitable.appTableField.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
    });

    fieldsResponse.data?.items?.forEach((field: any) => {
      console.log(`  - ${field.field_name} (type: ${field.type}, id: ${field.field_id})`);
    });
    console.log("");

    const hasStatus = fieldsResponse.data?.items?.some((f: any) => f.field_name === "status");
    const hasApprovalStatus = fieldsResponse.data?.items?.some((f: any) => f.field_name === "approval_status");
    const hasUpdatedAt = fieldsResponse.data?.items?.some((f: any) => f.field_name === "updated_at");

    console.log("フィールド存在確認:");
    console.log(`  status: ${hasStatus ? "✅ あり" : "❌ なし"}`);
    console.log(`  approval_status: ${hasApprovalStatus ? "✅ あり" : "❌ なし"}`);
    console.log(`  updated_at: ${hasUpdatedAt ? "✅ あり" : "❌ なし"}`);

    console.log("\n✨ 確認完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkLicenseFields()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
