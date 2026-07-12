/**
 * 生産本部メニュー再編(Option A)
 *
 * 1) メニュー表示マスタ:
 *    - M006「生産管理部」→ 名称「生産本部」へ改名(L1のまま)
 *    - 配下に L2 を追加: M006-01 共通(順1) / M006-02 製造部(順2) / M006-03 生産管理部(順3)
 *    - 旧 M015系(M015,M015-01,M015-02,M015-03)を削除
 * 2) 機能配置マスタ: KPI 8プログラムを 配置=M006-01 へ移設(順・名称を指定)
 * 3) グループ権限: DX推進室に menu:M006-01 を追加 / 孤立する M015系 menu権限を削除
 *
 * 既定は DRY-RUN(変更なし)。実行は --execute を付与。
 *   npx tsx scripts/migrate-seisan-honbu-menu.ts            # プレビュー
 *   npx tsx scripts/migrate-seisan-honbu-menu.ts --execute  # 反映
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "";
const T_MENU = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GROUP = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const NEW_PARENT = "M006";
const COMMON_MENU = "M006-01";

// 追加する L2 メニュー
const NEW_MENUS = [
  { id: "M006-01", name: "共通", sort: 1 },
  { id: "M006-02", name: "製造部", sort: 2 },
  { id: "M006-03", name: "生産管理部", sort: 3 },
];

// 削除する旧メニュー
const DELETE_MENUS = ["M015", "M015-01", "M015-02", "M015-03"];

// 共通配下へ移設するプログラム(順=表示順, name=新名称)
const PROG_MOVES = [
  { id: "PGM039", sort: 1, name: "★達成評価" },
  { id: "PGM036", sort: 2, name: "KPIダッシュボード" },
  { id: "PGM041", sort: 3, name: "KPI過去実績参照" },
  { id: "PGM037", sort: 4, name: "KPI実績入力" },
  { id: "PGM038", sort: 5, name: "KPI施策管理 (重点施策PDCA)" },
  { id: "PGM040", sort: 6, name: "KPIマスタ / グループマスタ管理" },
  { id: "PGM042", sort: 7, name: "データエクスポート" },
  { id: "PGM043", sort: 8, name: "ヘルプ ― 運用ガイド" },
];

const GRANT_GROUP = "DX推進室";

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

async function fetchAll(c: lark.Client, table: string): Promise<any[]> {
  const items: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: table },
      params: { page_size: 500, page_token: pt },
    });
    if (r.code !== 0) throw new Error(`fetch ${table}: ${r.msg}`);
    items.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);
  return items;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const tag = execute ? "" : " (DRY-RUN)";
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const [menus, programs, groupPerms] = await Promise.all([
    fetchAll(c, T_MENU),
    fetchAll(c, T_PROG),
    fetchAll(c, T_GROUP),
  ]);
  const menuBy = (id: string) => menus.find((r) => val(r.fields?.["メニューID"]).trim() === id);
  const progBy = (id: string) => programs.find((r) => val(r.fields?.["プログラムID"]).trim() === id);

  // ---- 1) メニュー: M006 改名 ----
  console.log(`=== メニュー${tag} ===`);
  const m006 = menuBy("M006");
  if (!m006) throw new Error("M006 が見つかりません");
  if (val(m006.fields?.["メニュー名"]) === "生産本部") {
    console.log("  ✓ M006 既に「生産本部」");
  } else {
    console.log(`  ~ M006 名称 「${val(m006.fields?.["メニュー名"])}」 → 「生産本部」`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.update({
        path: { app_token: BASE, table_id: T_MENU, record_id: m006.record_id },
        data: { fields: { "メニュー名": "生産本部" } },
      });
      if (r.code !== 0) throw new Error(`M006 update: ${r.msg}`);
    }
  }

  // ---- 1) メニュー: L2 追加 ----
  for (const m of NEW_MENUS) {
    if (menuBy(m.id)) {
      console.log(`  ✓ ${m.id}「${m.name}」既存 → スキップ`);
      continue;
    }
    console.log(`  + ${m.id}「${m.name}」(L2, parent=${NEW_PARENT}, 順=${m.sort})`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.create({
        path: { app_token: BASE, table_id: T_MENU },
        data: {
          fields: {
            "メニューID": m.id,
            "メニュー名": m.name,
            "階層レベル": 2,
            "親メニューID": NEW_PARENT,
            "表示順": m.sort,
            "有効フラグ": true,
          },
        },
      });
      if (r.code !== 0) throw new Error(`create ${m.id}: ${r.msg}`);
    }
  }

  // ---- 2) プログラム: 移設 ----
  console.log(`\n=== 機能配置マスタ${tag} ===`);
  for (const p of PROG_MOVES) {
    const rec = progBy(p.id);
    if (!rec) {
      console.log(`  ! ${p.id} が見つかりません(スキップ)`);
      continue;
    }
    const curMenu = val(rec.fields?.["配置メニューID"]);
    const curName = val(rec.fields?.["プログラム名称"]);
    const curSort = Number(rec.fields?.["表示順"]) || 0;
    const same = curMenu === COMMON_MENU && curName === p.name && curSort === p.sort;
    if (same) {
      console.log(`  ✓ ${p.id} 既に最新 → スキップ`);
      continue;
    }
    console.log(`  ~ ${p.id} 配置 ${curMenu}→${COMMON_MENU} 順 ${curSort}→${p.sort} 名「${curName}」→「${p.name}」`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.update({
        path: { app_token: BASE, table_id: T_PROG, record_id: rec.record_id },
        data: { fields: { "配置メニューID": COMMON_MENU, "表示順": p.sort, "プログラム名称": p.name } },
      });
      if (r.code !== 0) throw new Error(`update ${p.id}: ${r.msg}`);
    }
  }

  // ---- 1) メニュー: 旧 M015系 削除 (プログラム移設後) ----
  console.log(`\n=== 旧メニュー削除${tag} ===`);
  for (const id of DELETE_MENUS) {
    const rec = menuBy(id);
    if (!rec) {
      console.log(`  ✓ ${id} 無し → スキップ`);
      continue;
    }
    console.log(`  - ${id}「${val(rec.fields?.["メニュー名"])}」を削除`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.delete({
        path: { app_token: BASE, table_id: T_MENU, record_id: rec.record_id },
      });
      if (r.code !== 0) throw new Error(`delete ${id}: ${r.msg}`);
    }
  }

  // ---- 3) 権限: DX推進室に menu:M006-01 追加 ----
  console.log(`\n=== 権限${tag} ===`);
  const hasGrant = groupPerms.some(
    (r) =>
      val(r.fields?.["グループ名"]) === GRANT_GROUP &&
      val(r.fields?.["対象種別"]) === "menu" &&
      val(r.fields?.["対象ID"]) === COMMON_MENU
  );
  if (hasGrant) {
    console.log(`  ✓ ${GRANT_GROUP} menu:${COMMON_MENU} 既存 → スキップ`);
  } else {
    console.log(`  + ${GRANT_GROUP} menu:${COMMON_MENU} を許可`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.create({
        path: { app_token: BASE, table_id: T_GROUP },
        data: {
          fields: { "グループ名": GRANT_GROUP, "対象種別": "menu", "対象ID": COMMON_MENU, "許可フラグ": true },
        },
      });
      if (r.code !== 0) throw new Error(`grant ${COMMON_MENU}: ${r.msg}`);
    }
  }

  // ---- 3) 権限: 孤立する M015系 menu権限を削除 ----
  const orphan = groupPerms.filter(
    (r) => val(r.fields?.["対象種別"]) === "menu" && DELETE_MENUS.includes(val(r.fields?.["対象ID"]))
  );
  console.log(`  孤立 M015系 menu権限: ${orphan.length}件`);
  for (const r of orphan) {
    console.log(`  - [${val(r.fields?.["グループ名"])}] menu:${val(r.fields?.["対象ID"])} 削除`);
    if (execute) {
      const d: any = await c.bitable.appTableRecord.delete({
        path: { app_token: BASE, table_id: T_GROUP, record_id: r.record_id },
      });
      if (d.code !== 0) throw new Error(`delete perm: ${d.msg}`);
    }
  }

  console.log(`\n=== ${execute ? "反映完了" : "DRY-RUN 完了(変更なし)。--execute で反映"} ===`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
