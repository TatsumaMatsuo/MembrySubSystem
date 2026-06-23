import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// 生産KPI_施策テーブル(project base)の「施策詳細」フィールド存在確認
const PROJECT_BASE = process.env.LARK_BASE_TOKEN || "";
const TABLE_MEASURE = process.env.LARK_TABLE_SEISAN_KPI_MEASURE || "tblMfqKPv02mwBYd";
const FIELD_NAME = "施策詳細";

(async () => {
  if (!PROJECT_BASE) throw new Error("LARK_BASE_TOKEN が未設定です");

  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const list: any = await c.bitable.appTableField.list({
    path: { app_token: PROJECT_BASE, table_id: TABLE_MEASURE },
    params: { page_size: 200 },
  });
  const fields = (list.data?.items || []) as any[];
  const found = fields.find((f) => f.field_name === FIELD_NAME);
  console.log("全フィールド:", fields.map((f) => f.field_name).join(" / "));
  if (found) {
    console.log(`\n✅ 「${FIELD_NAME}」が存在します (type=${found.type}, field_id=${found.field_id})`);
  } else {
    console.log(`\n❌ 「${FIELD_NAME}」が見つかりません`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
