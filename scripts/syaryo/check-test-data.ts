/**
 * テストデータ確認スクリプト
 * Lark Baseに保存されているデータを確認
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkTestData() {
  console.log("📊 テストデータ確認開始...\n");

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
    // 1. 運転免許証データを確認
    console.log("🔍 運転免許証テーブルを確認中...");
    const licensesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    console.log(`  レコード数: ${licensesResponse.data?.items?.length || 0}`);
    licensesResponse.data?.items?.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. employee_id: ${item.fields.employee_id}, license_number: ${item.fields.license_number}`);
    });
    console.log("");

    // 2. 車検証データを確認
    console.log("🔍 車検証テーブルを確認中...");
    const vehiclesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: VEHICLE_REGISTRATIONS_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    console.log(`  レコード数: ${vehiclesResponse.data?.items?.length || 0}`);
    vehiclesResponse.data?.items?.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. employee_id: ${item.fields.employee_id}, vehicle_number: ${item.fields.vehicle_number}`);
    });
    console.log("");

    // 3. 任意保険証データを確認
    console.log("🔍 任意保険証テーブルを確認中...");
    const insurancesResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: INSURANCE_POLICIES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    console.log(`  レコード数: ${insurancesResponse.data?.items?.length || 0}`);
    insurancesResponse.data?.items?.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. employee_id: ${item.fields.employee_id}, policy_number: ${item.fields.policy_number}`);
    });
    console.log("");

    // 結果サマリー
    console.log("📋 データサマリー:");
    console.log(`  運転免許証: ${licensesResponse.data?.items?.length || 0}件`);
    console.log(`  車検証: ${vehiclesResponse.data?.items?.length || 0}件`);
    console.log(`  任意保険証: ${insurancesResponse.data?.items?.length || 0}件`);
    console.log("");

    if ((vehiclesResponse.data?.items?.length || 0) === 0 || (insurancesResponse.data?.items?.length || 0) === 0) {
      console.log("⚠️  車検証または任意保険証のデータが不足しています");
      console.log("💡 次のステップ:");
      console.log("   1. Lark Baseで車検証・任意保険証テーブルのフィールド定義を確認");
      console.log("   2. 必要なフィールドが存在するか確認");
      console.log("   3. スクリプトを修正してデータを再作成");
    } else {
      console.log("✅ すべての書類データが揃っています！");
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkTestData()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
