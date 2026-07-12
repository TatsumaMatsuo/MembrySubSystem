/**
 * PGM030 のクリーンアップ
 * - プログラムID: "PGM030 " (末尾スペース) → "PGM030"
 * - プログラム名称: "車両関連管理" → "車両管理システム"（M002-03メニュー名と統一）
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

const TARGET_RECORD_ID = "recvj6kFr83jWR";

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // 更新前に現状を確認
  const before: any = await client.bitable.appTableRecord.get({
    path: {
      app_token: BASE_TOKEN,
      table_id: TABLE_FUNCTION_PLACEMENT,
      record_id: TARGET_RECORD_ID,
    },
  });
  console.log("=== Before ===");
  console.log(`  プログラムID:   ${JSON.stringify(before.data?.record?.fields?.["プログラムID"])}`);
  console.log(`  プログラム名称: ${JSON.stringify(before.data?.record?.fields?.["プログラム名称"])}`);

  // 更新実行
  const res: any = await client.bitable.appTableRecord.update({
    path: {
      app_token: BASE_TOKEN,
      table_id: TABLE_FUNCTION_PLACEMENT,
      record_id: TARGET_RECORD_ID,
    },
    data: {
      fields: {
        "プログラムID": "PGM030",
        "プログラム名称": "車両管理システム",
      },
    },
  });

  if (res.code !== 0) {
    throw new Error(`Update failed: ${res.msg}`);
  }

  console.log("\n=== After ===");
  console.log(`  プログラムID:   ${JSON.stringify(res.data?.record?.fields?.["プログラムID"])}`);
  console.log(`  プログラム名称: ${JSON.stringify(res.data?.record?.fields?.["プログラム名称"])}`);
  console.log("\n✅ クリーンアップ完了");
}

main().catch(e => {
  console.error("[fatal]", e);
  process.exit(1);
});
