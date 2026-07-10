/**
 * 営業メニューへ「基準風速積雪検索」を登録する。
 *
 *   npx tsx scripts/register-eigyo-kijun-fusoku-menu.ts --dry-run
 *   npx tsx scripts/register-eigyo-kijun-fusoku-menu.ts
 *
 *   L1 M003 営業部（既存）
 *     └ L2 M003-05 支援ツール（新規）
 *         PGM045 基準風速積雪検索 /eigyo/kijun-fusoku
 *
 * 既存の同一IDがあればスキップ(冪等)。program_id は PGM044 まで使用済み → PGM045 起点。
 * 配置先は master base のメニュー表示マスタ / 機能配置マスタ。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

interface MenuDef { id: string; name: string; level: number; parent: string; sort: number; icon?: string }
interface ProgDef { id: string; name: string; menu_id: string; url: string; sort: number }

const MENUS: MenuDef[] = [
  { id: "M003-05", name: "支援ツール", level: 2, parent: "M003", sort: 5 },
];

const PROGRAMS: ProgDef[] = [
  { id: "PGM045", name: "基準風速積雪検索", menu_id: "M003-05", url: "/eigyo/kijun-fusoku", sort: 1 },
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
  const dryRun = process.argv.includes("--dry-run");
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === メニュー表示マスタ ===
  console.log(`=== メニュー表示マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
  // 参考: 営業部(M003)配下の既存L2を表示（ID衝突確認用）
  const m003children = menus
    .filter((r) => getField(r, "親メニューID").trim() === "M003")
    .map((r) => `${getField(r, "メニューID")}(${getField(r, "メニュー名")})`)
    .sort();
  console.log(`  既存 M003 配下: ${m003children.join(", ") || "(なし)"}`);

  const menuIds = new Set(menus.map((r) => getField(r, "メニューID").trim()));
  let createdMenus = 0;
  for (const m of MENUS) {
    if (menuIds.has(m.id)) {
      console.log(`  ✓ ${m.id} 「${m.name}」 既存 → スキップ`);
      continue;
    }
    console.log(`  + ${m.id} 「${m.name}」 (L${m.level}, 親=${m.parent}) を登録...`);
    if (!dryRun) {
      const fields: Record<string, any> = {
        "メニューID": m.id,
        "メニュー名": m.name,
        "階層レベル": m.level,
        "親メニューID": m.parent,
        "表示順": m.sort,
        "有効フラグ": true,
      };
      if (m.icon) fields["アイコン"] = m.icon;
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_MENU_DISPLAY },
        data: { fields },
      });
      if (res.code !== 0) throw new Error(`Menu create failed (${m.id}): ${res.msg}`);
      createdMenus++;
    }
  }

  // === 機能配置マスタ ===
  console.log(`\n=== 機能配置マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);
  const progIds = new Set(programs.map((r) => getField(r, "プログラムID").trim()));
  let createdProgs = 0;
  for (const p of PROGRAMS) {
    if (progIds.has(p.id)) {
      console.log(`  ✓ ${p.id} 「${p.name}」 既存 → スキップ`);
      continue;
    }
    console.log(`  + ${p.id} 「${p.name}」 → ${p.url} (配置=${p.menu_id})`);
    if (!dryRun) {
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
        data: {
          fields: {
            "プログラムID": p.id,
            "プログラム名称": p.name,
            "配置メニューID": p.menu_id,
            "URLパス": p.url,
            "表示順": p.sort,
            "有効フラグ": true,
          },
        },
      });
      if (res.code !== 0) throw new Error(`Program create failed (${p.id}): ${res.msg}`);
      createdProgs++;
    }
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
  console.log(`  メニュー: 新規 ${createdMenus} 件 / 定義 ${MENUS.length} 件`);
  console.log(`  プログラム: 新規 ${createdProgs} 件 / 定義 ${PROGRAMS.length} 件`);
  console.log(`\n注意: ユーザに表示するには グループ権限マスタ / 個別権限マスタ で許可設定が必要です。`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
