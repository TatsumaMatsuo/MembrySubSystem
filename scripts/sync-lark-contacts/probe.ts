/**
 * 読み取り専用プローブ: Lark Contact 同期の設計用に現状を把握する。
 *  1) 社員マスタ(tblXpm1d05ovRf1y @ master base)のフィールド定義を列挙
 *  2) contact.user.list / batch でユーザーの実データ(custom_attrs含む)をサンプル取得
 * データは一切変更しない。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const MASTER_BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const EMP_TABLE = "tblXpm1d05ovRf1y"; // 社員マスタ

const c = new lark.Client({
  appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
  appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

async function dumpFields() {
  console.log("=== 社員マスタ フィールド定義 ===");
  const fr: any = await c.bitable.appTableField.list({
    path: { app_token: MASTER_BASE, table_id: EMP_TABLE },
    params: { page_size: 100 },
  });
  for (const f of fr.data?.items || []) {
    const opts = f.property?.options ? ` options=[${f.property.options.map((o: any) => o.name).join(",")}]` : "";
    console.log(`  - "${f.field_name}" type=${f.type}${opts}`);
  }

  // サンプル行を1件
  const rr: any = await c.bitable.appTableRecord.list({
    path: { app_token: MASTER_BASE, table_id: EMP_TABLE },
    params: { page_size: 1 },
  });
  console.log("\n=== 社員マスタ サンプル1件(raw fields) ===");
  console.log(JSON.stringify(rr.data?.items?.[0]?.fields ?? {}, null, 2));
  console.log(`総行数(total)= ${rr.data?.total}`);
}

async function sampleContacts() {
  console.log("\n=== Contact: 部署列挙 ===");
  const deptIds = new Set<string>();
  let pt: string | undefined;
  do {
    const r: any = await c.contact.department.list({
      params: { parent_department_id: "0", fetch_child: true, page_size: 50, page_token: pt, department_id_type: "open_department_id" },
    });
    for (const d of r.data?.items || []) if (d.open_department_id) deptIds.add(d.open_department_id);
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);
  console.log(`  部署数= ${deptIds.size}`);

  // 最初の部署からユーザーを1ページ取り、open_idを集める
  const someIds: string[] = [];
  for (const dep of [...deptIds].slice(0, 5)) {
    try {
      const r: any = await c.contact.user.list({
        params: { department_id: dep, page_size: 20, department_id_type: "open_department_id", user_id_type: "open_id" },
      });
      for (const u of r.data?.items || []) if (u.open_id) someIds.push(u.open_id);
      if (someIds.length >= 3) break;
    } catch (e: any) {
      console.log(`  [!] user.list 失敗 dep=${dep}: ${e?.response?.data?.msg || e.message}`);
    }
  }
  console.log(`  サンプルopen_id数= ${someIds.length}`);

  if (someIds.length) {
    // 1) user.list の生itemに含まれるキーを確認（スコープで欠落する項目を特定）
    const dep0 = [...deptIds][0];
    const lr: any = await c.contact.user.list({
      params: { department_id: dep0, page_size: 5, department_id_type: "open_department_id", user_id_type: "open_id" },
    });
    console.log("\n=== Contact: user.list 生item[0] のキー一覧 ===");
    const item0 = lr.data?.items?.[0];
    console.log("keys:", item0 ? Object.keys(item0).join(", ") : "(なし)");
    console.log("raw:", JSON.stringify(item0 ?? {}, null, 2));

    // 2) user.get 単体（最も詳細が返る想定）
    console.log("\n=== Contact: user.get 単体 ===");
    try {
      const gr: any = await c.contact.user.get({
        path: { user_id: someIds[0] },
        params: { user_id_type: "open_id", department_id_type: "open_department_id" },
      });
      console.log("code:", gr.code, "msg:", gr.msg);
      console.log("user:", JSON.stringify(gr.data?.user ?? {}, null, 2));
    } catch (e: any) {
      console.log("user.get 失敗:", JSON.stringify(e?.response?.data || e.message));
    }
  }
}

(async () => {
  await dumpFields();
  await sampleContacts();
})().catch((e) => { console.error("FATAL:", e?.response?.data || e); process.exit(1); });
