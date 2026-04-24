/**
 * 承認ステータス確認スクリプト
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkApprovalStatus() {
  console.log("🔍 承認ステータス確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";
  const VEHICLE_REGISTRATIONS_TABLE = process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || "";
  const INSURANCE_POLICIES_TABLE = process.env.LARK_TABLE_INSURANCE_POLICIES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    // 運転免許証
    console.log("📋 運転免許証:");
    const licensesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    licensesResponse.data?.items?.forEach((item: any) => {
      console.log(`  ${item.fields.employee_id}: ${item.fields.approval_status}`);
    });

    // 車検証
    console.log("\n📋 車検証:");
    const vehiclesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: VEHICLE_REGISTRATIONS_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    vehiclesResponse.data?.items?.forEach((item: any) => {
      console.log(`  ${item.fields.employee_id}: ${item.fields.approval_status}`);
    });

    // 任意保険証
    console.log("\n📋 任意保険証:");
    const insurancesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: INSURANCE_POLICIES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    insurancesResponse.data?.items?.forEach((item: any) => {
      console.log(`  ${item.fields.employee_id}: ${item.fields.approval_status}`);
    });

    console.log("\n✨ 確認完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkApprovalStatus()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
