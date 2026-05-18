/**
 * Larkフィルター動作確認スクリプト
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function debugLarkFilter() {
  console.log("🔍 Larkフィルター動作確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    // 1. フィルターなしで取得
    console.log("📋 フィルターなしで運転免許証を取得:");
    const responseNoFilter = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });
    console.log(`  レコード数: ${responseNoFilter.data?.items?.length || 0}`);
    console.log(`  Response code: ${responseNoFilter.code}`);
    console.log("");

    // 2. deleted_flagフィルター付きで取得
    console.log("📋 deleted_flag=falseフィルターで運転免許証を取得:");
    const responseWithFilter = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
      params: {
        page_size: 10,
        filter: `CurrentValue.[deleted_flag]=false`,
      },
    });
    console.log(`  レコード数: ${responseWithFilter.data?.items?.length || 0}`);
    console.log(`  Response code: ${responseWithFilter.code}`);
    console.log(`  Response msg: ${responseWithFilter.msg || "OK"}`);
    console.log("");

    // 3. フィールド確認
    console.log("📋 フィールド定義確認:");
    const fieldsResponse = await larkClient.bitable.appTableField.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
    });
    const hasDeletedFlag = fieldsResponse.data?.items?.some((f: any) => f.field_name === "deleted_flag");
    console.log(`  deleted_flag フィールド存在: ${hasDeletedFlag ? "あり" : "なし"}`);

    fieldsResponse.data?.items?.forEach((field: any) => {
      console.log(`  - ${field.field_name} (${field.type})`);
    });

    console.log("\n✨ デバッグ完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

debugLarkFilter()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
