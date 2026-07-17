/**
 * 工務課 > 出面管理 メニューを登録 (#93)
 * - メニュー表示マスタ: M007-01「出面管理」(L2, parent=M007, sort=1)
 * - 機能配置マスタ:    PGM052「出面管理」(menu=M007-01, url=/koumu/demen, sort=1)
 *
 * 既存の同一IDがあればスキップ（冪等）。M007(工務課, L1)は既存前提。
 * ※ 工務課ユーザに表示するには グループ/個別権限マスタ で PGM052 の許可設定が別途必要。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

const NEW_MENU = {
  id: "M007-01",
  name: "出面管理",
  level: 2,
  parent: "M007",
  sort: 1,
  icon: "Users",
};

const NEW_PROGRAM = {
  id: "PGM052",
  name: "出面管理",
  menu_id: "M007-01",
  url: "/koumu/demen",
  sort: 1,
};

async function fetchAll(client: lark.Client, tableId: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: tableId },
      params: { page_size: 100, page_token: pageToken },
    });
    if (res.code !== 0) throw new Error(`Fetch failed: ${res.msg}`);
    items.push(...(res.data?.items || []));
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

function getField(rec: any, name: string): string {
  const v = rec?.fields?.[name];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === メニュー表示マスタ ===
  console.log("=== Step 1: メニュー表示マスタ ===");
  const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
  if (!menus.find((r) => getField(r, "メニューID") === NEW_MENU.parent)) {
    console.log(`  ! 親メニュー ${NEW_MENU.parent}(工務課) が見つかりません。中止します。`);
    process.exit(1);
  }
  const existingMenu = menus.find((r) => getField(r, "メニューID") === NEW_MENU.id);
  if (existingMenu) {
    console.log(`  ✓ ${NEW_MENU.id} は既に存在 (record_id=${existingMenu.record_id}) → スキップ`);
  } else {
    console.log(`  + ${NEW_MENU.id} 「${NEW_MENU.name}」 を新規登録...`);
    const res: any = await client.bitable.appTableRecord.create({
      path: { app_token: BASE_TOKEN, table_id: TABLE_MENU_DISPLAY },
      data: {
        fields: {
          "メニューID": NEW_MENU.id,
          "メニュー名": NEW_MENU.name,
          "階層レベル": NEW_MENU.level,
          "親メニューID": NEW_MENU.parent,
          "表示順": NEW_MENU.sort,
          "アイコン": NEW_MENU.icon,
          "有効フラグ": true,
        },
      },
    });
    if (res.code !== 0) throw new Error(`Menu create failed: ${res.msg}`);
    console.log(`    -> created (record_id=${res.data?.record?.record_id})`);
  }

  // === 機能配置マスタ ===
  console.log("\n=== Step 2: 機能配置マスタ ===");
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);
  if (programs.find((r) => getField(r, "プログラムID") === NEW_PROGRAM.id)) {
    console.log(`  ✓ ${NEW_PROGRAM.id} は既に存在 → スキップ`);
  } else if (programs.find((r) => getField(r, "URLパス") === NEW_PROGRAM.url)) {
    console.log(`  ✓ URL ${NEW_PROGRAM.url} は既に登録済 → スキップ`);
  } else {
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
        },
      },
    });
    if (res.code !== 0) throw new Error(`Program create failed: ${res.msg}`);
    console.log(`    -> created (record_id=${res.data?.record?.record_id})`);
  }

  console.log("\n=== 完了 ===");
  console.log(`  メニュー: ${NEW_MENU.id} 「${NEW_MENU.name}」(parent ${NEW_MENU.parent})`);
  console.log(`  プログラム: ${NEW_PROGRAM.id} → ${NEW_PROGRAM.url}`);
  console.log("\n注意: 工務課ユーザに表示するには グループ/個別権限マスタ で PGM052 の許可設定が必要。");
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
