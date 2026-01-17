/**
 * クイズテーブルのフィールド確認スクリプト
 */

import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkFields() {
  console.log("=== クイズテーブルフィールド確認 ===");

  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: larkDomain,
  });

  const baseToken = process.env.LARK_BASE_TOKEN || "";
  const tableId = process.env.LARK_TABLE_QUIZ_MASTER || "tbl5Od0bDQEHG3Wm";

  console.log("BaseToken:", baseToken.substring(0, 10) + "...");
  console.log("TableId:", tableId);

  try {
    const response = await larkClient.bitable.appTableField.list({
      path: {
        app_token: baseToken,
        table_id: tableId,
      },
      params: {
        page_size: 100,
      },
    });

    console.log("\nフィールド一覧:");
    if (response.code === 0 && response.data?.items) {
      for (const field of response.data.items) {
        console.log(`  - ${field.field_name} (type: ${field.type}, id: ${field.field_id})`);
      }
    } else {
      console.error("エラー:", response);
    }
  } catch (error) {
    console.error("エラー:", error);
  }
}

checkFields().catch(console.error);
