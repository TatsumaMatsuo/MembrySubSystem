/**
 * PGM031「車両管理-管理者操作」を機能配置マスタに登録
 * - 配置メニューID: "_hidden_syaryo_admin" (実在しないため、サイドバー上には表示されない)
 * - URLパス: 空 (権限フラグ専用、画面なし)
 * - 用途: 旧 admin role の代替。requireAdmin() でこのプログラムIDの許可有無を判定する
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

const NEW_PROGRAM = {
  id: "PGM031",
  name: "車両管理-管理者操作",
  menu_id: "_hidden_syaryo_admin", // 実在しないID = サイドバー非表示
  url: "",
  sort: 0,
};

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

async function fetchAll(client: lark.Client) {
  const items: any[] = [];
  let token: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
      params: { page_size: 100, page_token: token },
    });
    items.push(...(res.data?.items || []));
    token = res.data?.has_more ? res.data?.page_token : undefined;
  } while (token);
  return items;
}

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  console.log("=== Step 1: 既存のPGM031を確認 ===");
  const programs = await fetchAll(client);
  const existing = programs.find(r => val(r.fields?.["プログラムID"]).trim() === NEW_PROGRAM.id);

  if (existing) {
    console.log(`  ✓ ${NEW_PROGRAM.id} は既に存在 (record_id=${existing.record_id}) → スキップ`);
    return;
  }

  console.log(`  + ${NEW_PROGRAM.id} 「${NEW_PROGRAM.name}」 を新規登録...`);
  const res: any = await client.bitable.appTableRecord.create({
    path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
    data: {
      fields: {
        "プログラムID": NEW_PROGRAM.id,
        "プログラム名称": NEW_PROGRAM.name,
        "配置メニューID": NEW_PROGRAM.menu_id,
        "URLパス": NEW_PROGRAM.url,
        "表示順": NEW_PROGRAM.sort,
        "有効フラグ": true,
        "説明": "旧 syaryo admin ロールの代替権限フラグ。サイドバー非表示。",
      },
    },
  });
  if (res.code !== 0) throw new Error(`Create failed: ${res.msg}`);

  console.log(`    -> created (record_id=${res.data?.record?.record_id})`);
  console.log("\n=== 完了 ===");
}

main().catch(e => {
  console.error("[fatal]", e);
  process.exit(1);
});
