/**
 * deleted_flag の実際の値を確認
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkDeletedFlag() {
  console.log("🔍 deleted_flag値確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    const response = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: DRIVERS_LICENSES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    const items = response.data?.items || [];
    console.log(`📋 運転免許証レコード: ${items.length}件\n`);

    items.forEach((item: any, index: number) => {
      console.log(`${index + 1}. employee_id: ${item.fields.employee_id}`);
      console.log(`   deleted_flag: ${item.fields.deleted_flag}`);
      console.log(`   deleted_flag type: ${typeof item.fields.deleted_flag}`);
      console.log(`   deleted_flag === false: ${item.fields.deleted_flag === false}`);
      console.log(`   deleted_flag === true: ${item.fields.deleted_flag === true}`);
      console.log(`   deleted_flag === null: ${item.fields.deleted_flag === null}`);
      console.log(`   deleted_flag === undefined: ${item.fields.deleted_flag === undefined}`);
      console.log("");
    });

    console.log("✨ 確認完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkDeletedFlag()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
