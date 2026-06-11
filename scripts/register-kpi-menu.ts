/**
 * 生産本部KPIシステム メニュー投入(#59)
 *
 * 新トップメニュー2系統を メニュー表示マスタ / 機能配置マスタ に登録する。
 *   L1 M014 経営          (icon=BarChart3, 順14)
 *     └ L2 M014-01 経営計画
 *         PGM032 中期経営計画ダッシュボード /keiei/dashboard
 *         PGM033 全社KPI(年度計画 vs 実績)  /keiei/company-kpi
 *         PGM034 会計データ入力             /keiei/kaikei-input
 *         PGM035 中計マスタ管理(管理者)     /keiei/midterm
 *   L1 M015 生産本部KPI    (icon=Factory, 順15)
 *     └ L2 M015-01 KPIレビュー
 *         PGM036 ダッシュボード   /seisan-kpi/dashboard
 *         PGM037 KPI実績入力      /seisan-kpi/input
 *         PGM038 施策管理(PDCA)   /seisan-kpi/measures
 *         PGM039 ★達成評価       /seisan-kpi/stars
 *         PGM041 過去実績参照     /seisan-kpi/history
 *     └ L2 M015-02 KPI管理(管理者)
 *         PGM040 マスタ管理       /seisan-kpi/master
 *         PGM042 データエクスポート /seisan-kpi/export
 *     └ L2 M015-03 共通
 *         PGM043 ヘルプ(運用ガイド) /seisan-kpi/help
 *
 * 既存の同一IDがあればスキップ(冪等)。program_id は PGM031 まで使用済み → PGM032 起点。
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
  // L1
  { id: "M014", name: "経営", level: 1, parent: "", sort: 14, icon: "BarChart3" },
  { id: "M015", name: "生産本部KPI", level: 1, parent: "", sort: 15, icon: "Factory" },
  // L2: 経営
  { id: "M014-01", name: "経営計画", level: 2, parent: "M014", sort: 1 },
  // L2: 生産本部KPI
  { id: "M015-01", name: "KPIレビュー", level: 2, parent: "M015", sort: 1 },
  { id: "M015-02", name: "KPI管理(管理者)", level: 2, parent: "M015", sort: 2 },
  { id: "M015-03", name: "共通", level: 2, parent: "M015", sort: 3 },
];

const PROGRAMS: ProgDef[] = [
  // 経営計画
  { id: "PGM032", name: "中期経営計画ダッシュボード", menu_id: "M014-01", url: "/keiei/dashboard", sort: 1 },
  { id: "PGM033", name: "全社KPI(年度計画 vs 実績)", menu_id: "M014-01", url: "/keiei/company-kpi", sort: 2 },
  { id: "PGM034", name: "会計データ入力", menu_id: "M014-01", url: "/keiei/kaikei-input", sort: 3 },
  { id: "PGM035", name: "中計マスタ管理", menu_id: "M014-01", url: "/keiei/midterm", sort: 4 },
  // KPIレビュー
  { id: "PGM036", name: "ダッシュボード", menu_id: "M015-01", url: "/seisan-kpi/dashboard", sort: 1 },
  { id: "PGM037", name: "KPI実績入力", menu_id: "M015-01", url: "/seisan-kpi/input", sort: 2 },
  { id: "PGM038", name: "施策管理(PDCA)", menu_id: "M015-01", url: "/seisan-kpi/measures", sort: 3 },
  { id: "PGM039", name: "★達成評価", menu_id: "M015-01", url: "/seisan-kpi/stars", sort: 4 },
  { id: "PGM041", name: "過去実績参照", menu_id: "M015-01", url: "/seisan-kpi/history", sort: 5 },
  // KPI管理(管理者)
  { id: "PGM040", name: "マスタ管理(KPI/グループ)", menu_id: "M015-02", url: "/seisan-kpi/master", sort: 1 },
  { id: "PGM042", name: "データエクスポート", menu_id: "M015-02", url: "/seisan-kpi/export", sort: 2 },
  // 共通
  { id: "PGM043", name: "ヘルプ(運用ガイド)", menu_id: "M015-03", url: "/seisan-kpi/help", sort: 1 },
];

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
  const dryRun = process.argv.includes("--dry-run");
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === メニュー表示マスタ ===
  console.log(`=== メニュー表示マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
  const menuIds = new Set(menus.map((r) => getField(r, "メニューID").trim()));
  let createdMenus = 0;
  for (const m of MENUS) {
    if (menuIds.has(m.id)) {
      console.log(`  ✓ ${m.id} 「${m.name}」 既存 → スキップ`);
      continue;
    }
    console.log(`  + ${m.id} 「${m.name}」 (L${m.level}) を登録...`);
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
  console.log(`\n注意: ユーザに表示するには グループ権限マスタ / 個別権限マスタ で許可設定が必要です(#59 権限マッピング)。`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
