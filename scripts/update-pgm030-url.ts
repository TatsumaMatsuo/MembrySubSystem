/**
 * PGM030 のURLパスを管理者トップへ変更
 * /soumu/syaryo/dashboard → /soumu/syaryo/admin/applications
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const TARGET_RECORD_ID = "recvj6kFr83jWR";
const NEW_URL = "/soumu/syaryo/admin/applications";

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const before: any = await client.bitable.appTableRecord.get({
    path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT, record_id: TARGET_RECORD_ID },
  });
  console.log("=== Before ===");
  console.log(`  URLパス: ${JSON.stringify(before.data?.record?.fields?.["URLパス"])}`);

  const res: any = await client.bitable.appTableRecord.update({
    path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT, record_id: TARGET_RECORD_ID },
    data: { fields: { "URLパス": NEW_URL } },
  });
  if (res.code !== 0) throw new Error(`Update failed: ${res.msg}`);

  console.log("\n=== After ===");
  console.log(`  URLパス: ${JSON.stringify(res.data?.record?.fields?.["URLパス"])}`);
  console.log("\n✅ 更新完了");
}

main().catch(e => { console.error("[fatal]", e); process.exit(1); });
