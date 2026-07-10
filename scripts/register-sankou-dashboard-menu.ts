/**
 * 参考図台帳 利用状況ダッシュボード(/eigyo/sankou-zu/dashboard)をメニュー登録する。
 * 設計(M004-01)「支援ツール」に配置し、設計部へ権限付与する。
 * （営業 M003-05 配下には不要のため配置しない。撤去は scripts/remove-sankou-dashboard-eigyo.ts）
 * プログラムは1配置メニューのみのため部署ごとに別PGMを採番(URLは同一)。冪等(URL+配置で判定)。
 *
 * 実行: npx tsx scripts/register-sankou-dashboard-menu.ts [--dry-run]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GPERM = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const URL_PATH = "/eigyo/sankou-zu/dashboard";
const NAME = "参考図利用状況";
// 配置先メニューと、その配置を見せるグループ
const PLACEMENTS = [
  { menu: "M004-01", sort: 3, groups: ["設計部"] },
];

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}
async function fetchAll(c: lark.Client, t: string) {
  const o: any[] = []; let pt: string | undefined;
  do { const r: any = await c.bitable.appTableRecord.list({ path: { app_token: BASE, table_id: t }, params: { page_size: 500, page_token: pt } }); if (r.code !== 0) throw new Error(`fetch ${t}: ${r.msg}`); o.push(...(r.data?.items || [])); pt = r.data?.has_more ? r.data?.page_token : undefined; } while (pt);
  return o;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });
  const create = async (t: string, fields: any) => { if (dry) return; const r: any = await c.bitable.appTableRecord.create({ path: { app_token: BASE, table_id: t }, data: { fields } }); if (r.code !== 0) throw new Error(`create ${t}: ${r.msg}`); };

  console.log(`=== 参考図利用状況 ダッシュボード配置${dry ? " (DRY-RUN)" : ""} ===`);
  const progs = await fetchAll(c, T_PROG);
  let maxNum = 0;
  for (const p of progs) { const m = val(p.fields?.["プログラムID"]).trim().match(/^PGM(\d+)$/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
  const gperm = await fetchAll(c, T_GPERM);

  for (const pl of PLACEMENTS) {
    // プログラム(URL+配置で冪等)
    let pgmId = "";
    const exist = progs.find((p) => val(p.fields?.["URLパス"]).trim() === URL_PATH && val(p.fields?.["配置メニューID"]).trim() === pl.menu);
    if (exist) { pgmId = val(exist.fields?.["プログラムID"]).trim(); console.log(`  ✓ ${pgmId}「${NAME}」既存 (${pl.menu})`); }
    else {
      pgmId = `PGM${String(++maxNum).padStart(3, "0")}`;
      console.log(`  + ${pgmId}「${NAME}」→ ${URL_PATH} (配置=${pl.menu})`);
      await create(T_PROG, { "プログラムID": pgmId, "プログラム名称": NAME, "配置メニューID": pl.menu, "URLパス": URL_PATH, "表示順": pl.sort, "有効フラグ": true });
    }
    // 権限付与
    for (const g of pl.groups) {
      const has = gperm.some((r) => val(r.fields?.["グループ名"]).trim() === g && val(r.fields?.["対象種別"]) === "program" && val(r.fields?.["対象ID"]) === pgmId);
      if (has) { console.log(`  ✓ 権限 ${g} program:${pgmId} 既存`); continue; }
      console.log(`  + 権限付与 ${g} program:${pgmId}`);
      await create(T_GPERM, { "グループ名": g, "対象種別": "program", "対象ID": pgmId, "許可フラグ": true });
    }
  }
  console.log(`\n=== 完了${dry ? " (DRY-RUN)" : ""} ===`);
}

main().catch((e) => { console.error("[fatal]", e?.response?.data || e); process.exit(1); });
