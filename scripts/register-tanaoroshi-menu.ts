/**
 * 棚卸入力Webアプリのメニュー登録。
 *
 *   npx tsx scripts/register-tanaoroshi-menu.ts --dry-run
 *   npx tsx scripts/register-tanaoroshi-menu.ts
 *
 *   L1 M001 共通（既存）
 *     └ L2 M001-08 棚卸           ← 今回追加
 *         PGMnnn 棚卸入力  /tanaoroshi
 *   L1 M006 生産本部（既存）
 *     └ L2 M006-03 生産管理部（既存）
 *         PGMnnn 棚卸管理  /seizou/tanaoroshi
 *
 * program_id は機能配置マスタの既存最大値から自動採番(max+1)。既存の同一URL/名称はスキップ(冪等)。
 *
 * ⚠ 実行タイミング: 画面が存在しない状態で登録するとメニューから404へ飛べてしまう。
 *    Phase 1 で /tanaoroshi、Phase 3 で /seizou/tanaoroshi が動くようになってから実行すること。
 *    --only=input / --only=admin で片方ずつ登録できる。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

/** 共通(M001)配下に新設する L2 メニュー */
const TANAOROSHI_MENU = { id: "M001-08", name: "棚卸", level: 2, parent: "M001", sort: 9, icon: "ClipboardList" };

const PROGRAMS = [
  { key: "input", name: "棚卸入力", menu_id: "M001-08", url: "/tanaoroshi", sort: 1 },
  { key: "admin", name: "棚卸管理", menu_id: "M006-03", url: "/seizou/tanaoroshi", sort: 2 },
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
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;
  const targets = only ? PROGRAMS.filter((p) => p.key === only) : PROGRAMS;
  if (!targets.length) throw new Error(`--only=${only} に一致するプログラムがありません`);

  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === メニュー表示マスタ: 棚卸(M001-08) を確保（入力側を登録するときのみ） ===
  if (targets.some((t) => t.menu_id === TANAOROSHI_MENU.id)) {
    console.log(`=== メニュー表示マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
    const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
    const menuIds = new Set(menus.map((r) => getField(r, "メニューID").trim()));
    if (menuIds.has(TANAOROSHI_MENU.id)) {
      console.log(`  ✓ ${TANAOROSHI_MENU.id} 「${TANAOROSHI_MENU.name}」 既存 → スキップ`);
    } else {
      console.log(`  + ${TANAOROSHI_MENU.id} 「${TANAOROSHI_MENU.name}」 (L${TANAOROSHI_MENU.level}, 親=${TANAOROSHI_MENU.parent})`);
      if (!dryRun) {
        const res: any = await client.bitable.appTableRecord.create({
          path: { app_token: BASE_TOKEN, table_id: TABLE_MENU_DISPLAY },
          data: {
            fields: {
              "メニューID": TANAOROSHI_MENU.id,
              "メニュー名": TANAOROSHI_MENU.name,
              "階層レベル": TANAOROSHI_MENU.level,
              "親メニューID": TANAOROSHI_MENU.parent,
              "表示順": TANAOROSHI_MENU.sort,
              "アイコン": TANAOROSHI_MENU.icon,
              "有効フラグ": true,
            },
          },
        });
        if (res.code !== 0) throw new Error(`Menu create failed: ${res.msg}`);
      }
    }
  }

  // === 機能配置マスタ ===
  console.log(`\n=== 機能配置マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);

  let maxNum = 0;
  for (const r of programs) {
    const m = getField(r, "プログラムID").trim().match(/^PGM(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  console.log(`  既存PGM最大: PGM${String(maxNum).padStart(3, "0")}`);

  const assigned: { name: string; id: string; url: string }[] = [];
  for (const p of targets) {
    const existing = programs.find(
      (r) => getField(r, "URLパス").trim() === p.url || getField(r, "プログラム名称").trim() === p.name
    );
    if (existing) {
      console.log(`  ✓ 「${p.name}」(${getField(existing, "プログラムID")}) は既存 → スキップ`);
      assigned.push({ name: p.name, id: getField(existing, "プログラムID"), url: p.url });
      continue;
    }

    maxNum += 1;
    const newId = `PGM${String(maxNum).padStart(3, "0")}`;
    console.log(`  + ${newId} 「${p.name}」 → ${p.url} (配置=${p.menu_id}, 表示順=${p.sort})`);
    assigned.push({ name: p.name, id: newId, url: p.url });

    if (!dryRun) {
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
        data: {
          fields: {
            "プログラムID": newId,
            "プログラム名称": p.name,
            "配置メニューID": p.menu_id,
            "URLパス": p.url,
            "表示順": p.sort,
            "有効フラグ": true,
          },
        },
      });
      if (res.code !== 0) throw new Error(`Program create failed (${newId}): ${res.msg}`);
      console.log(`    → 登録完了`);
    }
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
  assigned.forEach((a) => console.log(`  ${a.id}  ${a.name}  ${a.url}`));
  console.log(`\n注意:`);
  console.log(`  - ユーザに表示するには グループ権限マスタ / 個別権限マスタ での許可が別途必要です。`);
  console.log(`  - 「棚卸管理」(/seizou/tanaoroshi) は生産管理部グループにのみ付与してください。`);
  console.log(`    差分リスト発行・基幹出力・初期化の権限判定はこのPGMの許可で表現します。`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
