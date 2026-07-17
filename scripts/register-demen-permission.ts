/**
 * 出面管理(PGM052) の表示権限を DX推進室・工務課 のグループ権限マスタへ付与 (#93)
 *
 * メニュー表示にはツリー各階層の許可が必要:
 *   L1 M007(工務課) … 両グループとも既に許可済(確認済) → 追加なし
 *   L2 M007-01(出面管理) … menu 許可を追加
 *   PGM052(/koumu/demen) … program 許可を追加
 *
 * グループ権限マスタ(tbldL8lBsCnhCJQx): グループID/グループ名/対象種別(menu|program)/対象ID/許可フラグ
 * 既存(グループ名×対象種別×対象ID)があればスキップ（冪等）。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const GROUPS = [
  { name: "DX推進室", id: "od-9821438cc59b8647a6324e4b6fba7dca" },
  { name: "工務課", id: "od-9046ccd95938d48dcf48b7e55d44e1b7" },
];

// 付与対象(M007 L1 は付与済のため含めない)
const TARGETS = [
  { type: "menu", id: "M007-01" },
  { type: "program", id: "PGM052" },
];

async function fetchAll(client: lark.Client, tableId: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: tableId },
      params: { page_size: 200, page_token: pageToken },
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

  const rows = await fetchAll(client, TABLE_GROUP_PERMISSION);
  const exists = (name: string, type: string, id: string) =>
    rows.some(
      (r) => getField(r, "グループ名") === name && getField(r, "対象種別") === type && getField(r, "対象ID") === id
    );

  for (const g of GROUPS) {
    console.log(`\n=== ${g.name} ===`);
    for (const t of TARGETS) {
      if (exists(g.name, t.type, t.id)) {
        console.log(`  ✓ ${t.type}:${t.id} は既に存在 → スキップ`);
        continue;
      }
      console.log(`  + ${t.type}:${t.id} を許可付与...`);
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
        data: {
          fields: {
            "グループID": g.id,
            "グループ名": g.name,
            "対象種別": t.type,
            "対象ID": t.id,
            "許可フラグ": true,
          },
        },
      });
      if (res.code !== 0) throw new Error(`Create failed (${g.name} ${t.type}:${t.id}): ${res.msg}`);
      console.log(`    -> created (record_id=${res.data?.record?.record_id})`);
    }
  }

  console.log("\n=== 完了 ===");
  console.log("  DX推進室・工務課 に M007-01(menu) + PGM052(program) を許可付与。");
  console.log("  ※ 反映は権限キャッシュ(60s)後。ユーザーは再ログイン/再読込で反映。");
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
