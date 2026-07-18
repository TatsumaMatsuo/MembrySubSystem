/**
 * 営業メニュー（支援ツール）へ「ガントチャート」を登録する（Issue #95）。
 *
 *   npx tsx scripts/register-eigyo-gantt-menu.ts --dry-run
 *   npx tsx scripts/register-eigyo-gantt-menu.ts
 *
 *   L1 M003 営業部（既存）
 *     └ L2 M003-05 支援ツール（既存）
 *         PGMnnn ガントチャート /eigyo/gantt  ← 今回追加
 *
 * program_id は機能配置マスタの既存最大値から自動採番(max+1)。既存の同一URL/名称はスキップ(冪等)。
 * 配置先は master base のメニュー表示/機能配置マスタ。表示にはグループ/個別権限マスタでの許可が別途必要。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

const SUPPORT_MENU = { id: "M003-05", name: "支援ツール", level: 2, parent: "M003", sort: 5 };
const NEW_PROGRAM = { name: "ガントチャート", menu_id: "M003-05", url: "/eigyo/gantt", sort: 3 };

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

  // === メニュー表示マスタ: 支援ツール(M003-05) を確保 ===
  console.log(`=== メニュー表示マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
  const menuIds = new Set(menus.map((r) => getField(r, "メニューID").trim()));
  if (menuIds.has(SUPPORT_MENU.id)) {
    console.log(`  ✓ ${SUPPORT_MENU.id} 「${SUPPORT_MENU.name}」 既存 → スキップ`);
  } else {
    console.log(`  + ${SUPPORT_MENU.id} 「${SUPPORT_MENU.name}」 (L${SUPPORT_MENU.level}, 親=${SUPPORT_MENU.parent}) を登録...`);
    if (!dryRun) {
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_MENU_DISPLAY },
        data: {
          fields: {
            "メニューID": SUPPORT_MENU.id,
            "メニュー名": SUPPORT_MENU.name,
            "階層レベル": SUPPORT_MENU.level,
            "親メニューID": SUPPORT_MENU.parent,
            "表示順": SUPPORT_MENU.sort,
            "有効フラグ": true,
          },
        },
      });
      if (res.code !== 0) throw new Error(`Menu create failed (${SUPPORT_MENU.id}): ${res.msg}`);
    }
  }

  // === 機能配置マスタ: PGM自動採番してガントチャートを追加 ===
  console.log(`\n=== 機能配置マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);

  const existing = programs.find(
    (r) => getField(r, "URLパス").trim() === NEW_PROGRAM.url || getField(r, "プログラム名称").trim() === NEW_PROGRAM.name
  );
  if (existing) {
    console.log(`  ✓ 「${NEW_PROGRAM.name}」(${getField(existing, "プログラムID")}) は既存 → スキップ`);
    console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
    return;
  }

  let maxNum = 0;
  for (const r of programs) {
    const m = getField(r, "プログラムID").trim().match(/^PGM(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const newId = `PGM${String(maxNum + 1).padStart(3, "0")}`;
  console.log(`  既存PGM最大: PGM${String(maxNum).padStart(3, "0")} → 新規採番: ${newId}`);
  console.log(`  + ${newId} 「${NEW_PROGRAM.name}」 → ${NEW_PROGRAM.url} (配置=${NEW_PROGRAM.menu_id}, 表示順=${NEW_PROGRAM.sort})`);

  if (!dryRun) {
    const res: any = await client.bitable.appTableRecord.create({
      path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
      data: {
        fields: {
          "プログラムID": newId,
          "プログラム名称": NEW_PROGRAM.name,
          "配置メニューID": NEW_PROGRAM.menu_id,
          "URLパス": NEW_PROGRAM.url,
          "表示順": NEW_PROGRAM.sort,
          "有効フラグ": true,
        },
      },
    });
    if (res.code !== 0) throw new Error(`Program create failed (${newId}): ${res.msg}`);
    console.log(`  → 登録完了: ${newId}`);
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
  console.log(`注意: ユーザに表示するには グループ権限マスタ / 個別権限マスタ で許可設定が必要です。`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
