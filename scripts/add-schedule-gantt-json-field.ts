import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// 社内工程表(SCHEDULE, project base)に「社内工程表ガントJSON」テキスト列を追加する（#95）
// 取込ガントの任意工程(名前/開始/終了)を JSON で保持し、ガントチャートタブで描画する。
const PROJECT_BASE = process.env.LARK_BASE_TOKEN || "";
const TABLE_SCHEDULE = process.env.LARK_TABLE_SCHEDULE || "tblhhTgv5ynrkFjN";
const FIELD_NAME = "社内工程表ガントJSON";

(async () => {
  if (!PROJECT_BASE) throw new Error("LARK_BASE_TOKEN が未設定です");

  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const list: any = await c.bitable.appTableField.list({
    path: { app_token: PROJECT_BASE, table_id: TABLE_SCHEDULE },
    params: { page_size: 500 },
  });
  const fields = (list.data?.items || []) as any[];
  const found = fields.find((f) => f.field_name === FIELD_NAME);
  if (found) {
    console.log(`✅ 「${FIELD_NAME}」は既に存在します (type=${found.type}, field_id=${found.field_id})`);
    return;
  }

  const res: any = await c.bitable.appTableField.create({
    path: { app_token: PROJECT_BASE, table_id: TABLE_SCHEDULE },
    data: { field_name: FIELD_NAME, type: 1 }, // type 1 = テキスト
  });
  if (res.code && res.code !== 0) {
    throw new Error(`フィールド作成失敗: ${res.msg} (code=${res.code})`);
  }
  console.log(`✅ 「${FIELD_NAME}」を追加しました (field_id=${res.data?.field?.field_id})`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
