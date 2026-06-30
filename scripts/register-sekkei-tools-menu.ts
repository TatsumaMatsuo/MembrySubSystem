/**
 * 設計部メニュー(M004)配下に「支援ツール」を新設し、基準風速積雪検索・参考図台帳検索を配置する。
 *
 * プログラム(機能配置マスタ)は1つの配置メニューしか持てないため、営業部(M003-05)の PGM045/PGM046 とは
 * 別に、設計部用の新規プログラムを採番して M004-01 に配置する。設計部の権限を新メニュー/プログラムへ付与し、
 * 旧来の営業部経由の権限(M003, M003-05, PGM045, PGM046)は設計部から除去する(設計部配下に一本化)。
 *
 *   L1 M004 設計部（既存）
 *     └ L2 M004-01 支援ツール（新規）
 *         PGM0xx 基準風速積雪検索 /eigyo/kijun-fusoku
 *         PGM0yy 参考図台帳検索   /eigyo/sankou-zu
 *
 * 冪等。実行: npx tsx scripts/register-sekkei-tools-menu.ts [--dry-run]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_MENU = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GPERM = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const GROUP = "設計部";
const NEW_MENU = { id: "M004-01", name: "支援ツール", level: 2, parent: "M004", sort: 1 };
// 設計部用に新設するプログラム(URLは既存と同じページを指す)
const NEW_PROGRAMS = [
  { name: "基準風速積雪検索", url: "/eigyo/kijun-fusoku", menu: "M004-01", sort: 1 },
  // 設計部は登録/編集を有効化するため ?register=1 を付与(営業部 PGM046 は付与しない=閲覧のみ)
  { name: "参考図台帳検索", url: "/eigyo/sankou-zu?register=1", menu: "M004-01", sort: 2 },
];
// 設計部から外す営業部経由の権限
const REMOVE_GRANTS: { type: string; id: string }[] = [
  { type: "menu", id: "M003" },
  { type: "menu", id: "M003-05" },
  { type: "program", id: "PGM045" },
  { type: "program", id: "PGM046" },
];

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}
async function fetchAll(c: lark.Client, t: string) {
  const o: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({ path: { app_token: BASE, table_id: t }, params: { page_size: 500, page_token: pt } });
    if (r.code !== 0) throw new Error(`fetch失敗 ${t}: ${r.msg}`);
    o.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);
  return o;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });
  const create = async (t: string, fields: any) => {
    if (dry) return;
    const r: any = await c.bitable.appTableRecord.create({ path: { app_token: BASE, table_id: t }, data: { fields } });
    if (r.code !== 0) throw new Error(`create失敗 ${t}: ${r.msg}`);
  };

  console.log(`=== 設計部 支援ツール 配置${dry ? " (DRY-RUN)" : ""} ===`);

  // 1) メニュー M004-01
  const menus = await fetchAll(c, T_MENU);
  const menuIds = new Set(menus.map((m) => val(m.fields?.["メニューID"]).trim()));
  if (menuIds.has(NEW_MENU.id)) {
    console.log(`  ✓ メニュー ${NEW_MENU.id}「${NEW_MENU.name}」既存`);
  } else {
    console.log(`  + メニュー ${NEW_MENU.id}「${NEW_MENU.name}」(L${NEW_MENU.level}, 親=${NEW_MENU.parent})`);
    await create(T_MENU, { "メニューID": NEW_MENU.id, "メニュー名": NEW_MENU.name, "階層レベル": NEW_MENU.level, "親メニューID": NEW_MENU.parent, "表示順": NEW_MENU.sort, "有効フラグ": true });
  }

  // 2) プログラム(URL+配置で冪等。新規は最大PGM+1で採番)
  const progs = await fetchAll(c, T_PROG);
  let maxNum = 0;
  for (const p of progs) { const m = val(p.fields?.["プログラムID"]).trim().match(/^PGM(\d+)$/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
  const grantProgramIds: string[] = [];
  for (const np of NEW_PROGRAMS) {
    const exist = progs.find((p) => val(p.fields?.["URLパス"]).trim() === np.url && val(p.fields?.["配置メニューID"]).trim() === np.menu);
    if (exist) {
      const id = val(exist.fields?.["プログラムID"]).trim();
      console.log(`  ✓ プログラム ${id}「${np.name}」既存(${np.menu})`);
      grantProgramIds.push(id);
      continue;
    }
    const newId = `PGM${String(++maxNum).padStart(3, "0")}`;
    console.log(`  + プログラム ${newId}「${np.name}」→ ${np.url} (配置=${np.menu})`);
    await create(T_PROG, { "プログラムID": newId, "プログラム名称": np.name, "配置メニューID": np.menu, "URLパス": np.url, "表示順": np.sort, "有効フラグ": true });
    grantProgramIds.push(newId);
  }

  // 3) 設計部の権限: M004(既存想定)/M004-01 + 新プログラム を付与
  const gperm = await fetchAll(c, T_GPERM);
  const myPerms = gperm.filter((r) => val(r.fields?.["グループ名"]).trim() === GROUP);
  const hasPerm = (type: string, id: string) => myPerms.some((r) => val(r.fields?.["対象種別"]) === type && val(r.fields?.["対象ID"]) === id);
  const grants: { type: "menu" | "program"; id: string }[] = [
    { type: "menu", id: "M004" }, { type: "menu", id: NEW_MENU.id },
    ...grantProgramIds.map((id) => ({ type: "program" as const, id })),
  ];
  for (const g of grants) {
    if (hasPerm(g.type, g.id)) { console.log(`  ✓ 権限 ${g.type}:${g.id} 既存`); continue; }
    console.log(`  + 権限付与 ${g.type}:${g.id}`);
    await create(T_GPERM, { "グループ名": GROUP, "対象種別": g.type, "対象ID": g.id, "許可フラグ": true });
  }

  // 4) 旧 営業部経由の権限を設計部から除去
  for (const rm of REMOVE_GRANTS) {
    const rows = myPerms.filter((r) => val(r.fields?.["対象種別"]) === rm.type && val(r.fields?.["対象ID"]) === rm.id);
    for (const row of rows) {
      console.log(`  - 権限除去 ${rm.type}:${rm.id} (record ${row.record_id})`);
      if (!dry) {
        const r: any = await c.bitable.appTableRecord.delete({ path: { app_token: BASE, table_id: T_GPERM, record_id: row.record_id } });
        if (r.code !== 0) throw new Error(`delete失敗: ${r.msg}`);
      }
    }
    if (rows.length === 0) console.log(`  ・除去対象なし ${rm.type}:${rm.id}`);
  }

  console.log(`\n=== 完了${dry ? " (DRY-RUN: 変更なし)" : ""} ===`);
}

main().catch((e) => { console.error("[fatal]", e?.response?.data || e); process.exit(1); });
