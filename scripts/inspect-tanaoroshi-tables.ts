/**
 * 棚卸入力Webアプリ Phase 0 実査スクリプト
 *
 *   npx tsx scripts/inspect-tanaoroshi-tables.ts            # テーブル一覧＋候補抽出
 *   npx tsx scripts/inspect-tanaoroshi-tables.ts <tableId>  # 指定テーブルの列定義・件数・サンプル
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

const KEYWORDS = ["倉庫", "品目", "在庫", "資材", "部材", "材料", "商品", "製品マスタ", "棚卸"];

async function listTables(baseToken: string, label: string) {
  const items: any[] = [];
  let token: string | undefined;
  do {
    const r: any = await client.bitable.appTable.list({
      path: { app_token: baseToken },
      params: { page_size: 100, page_token: token },
    });
    items.push(...(r.data?.items || []));
    token = r.data?.has_more ? r.data?.page_token : undefined;
  } while (token);
  console.log(`\n========== ${label} (${baseToken.slice(0, 12)}...) : ${items.length} tables ==========`);
  for (const t of items) {
    const hit = KEYWORDS.some((k) => String(t.name).includes(k));
    console.log(`${hit ? "★" : " "} ${t.table_id}  "${t.name}"`);
  }
}

async function inspectTable(baseToken: string, tableId: string) {
  const fields: any[] = [];
  let ft: string | undefined;
  do {
    const r: any = await client.bitable.appTableField.list({
      path: { app_token: baseToken, table_id: tableId },
      params: { page_size: 100, page_token: ft },
    });
    fields.push(...(r.data?.items || []));
    ft = r.data?.has_more ? r.data?.page_token : undefined;
  } while (ft);

  console.log(`\n--- fields (${fields.length}) ---`);
  for (const f of fields) {
    const opts = f.property?.options?.map((o: any) => o.name).join(" / ");
    console.log(`  ${String(f.type).padStart(4)}  ${f.ui_type || ""}\t"${f.field_name}"${opts ? `  [${opts}]` : ""}`);
  }

  let count = 0;
  let rt: string | undefined;
  let sample: any = null;
  do {
    const r: any = await client.bitable.appTableRecord.list({
      path: { app_token: baseToken, table_id: tableId },
      params: { page_size: 500, page_token: rt },
    });
    const its = r.data?.items || [];
    if (!sample && its.length) sample = its[0];
    count += its.length;
    rt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (rt);

  console.log(`\n--- records: ${count} ---`);
  if (sample) console.log("sample:", JSON.stringify(sample.fields, null, 2).slice(0, 1500));
}

async function main() {
  const arg = process.argv[2];
  const projectBase = process.env.LARK_BASE_TOKEN || "";
  const masterBase = process.env.LARK_BASE_TOKEN_MASTER || "";

  if (arg) {
    for (const [label, bt] of [["project", projectBase], ["master", masterBase]] as const) {
      if (!bt) continue;
      try {
        console.log(`\n########## ${label} / ${arg} ##########`);
        await inspectTable(bt, arg);
        return;
      } catch (e: any) {
        console.log(`  (${label} base では取得不可: ${e?.message || e})`);
      }
    }
    return;
  }

  if (projectBase) await listTables(projectBase, "project base");
  if (masterBase) await listTables(masterBase, "master base");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
