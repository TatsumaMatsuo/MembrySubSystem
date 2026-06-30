/**
 * 参考図利用状況ダッシュボード(/eigyo/sankou-zu/dashboard)を
 * 営業(M003-05)「支援ツール」配下から撤去する。設計(M004-01)配下は残す。
 *
 * - 機能配置マスタ: URL=対象 かつ 配置メニューID=M003-05 のプログラムを削除
 * - グループ権限   : そのプログラムIDに対する program 権限行を削除
 *
 * 実行: npx tsx scripts/remove-sankou-dashboard-eigyo.ts [--execute]
 *   既定 dry-run（削除対象の表示のみ）。--execute で実削除。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GPERM = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const URL_PATH = "/eigyo/sankou-zu/dashboard";
const TARGET_MENU = "M003-05"; // 営業 支援ツール

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
  const exec = process.argv.includes("--execute");
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });
  const del = async (t: string, recId: string) => { if (!exec) return; const r: any = await c.bitable.appTableRecord.delete({ path: { app_token: BASE, table_id: t, record_id: recId } }); if (r.code !== 0) throw new Error(`delete ${t}/${recId}: ${r.msg}`); };

  console.log(`=== 参考図利用状況 営業(${TARGET_MENU})撤去${exec ? "" : " (DRY-RUN)"} ===`);

  // 1) 機能配置（営業配置のプログラム）
  const progs = await fetchAll(c, T_PROG);
  const targets = progs.filter((p) => val(p.fields?.["URLパス"]).trim() === URL_PATH && val(p.fields?.["配置メニューID"]).trim() === TARGET_MENU);
  if (targets.length === 0) { console.log(`  (該当プログラムなし: URL=${URL_PATH} 配置=${TARGET_MENU})`); }
  const pgmIds = targets.map((p) => val(p.fields?.["プログラムID"]).trim()).filter(Boolean);
  for (const p of targets) {
    console.log(`  - 配置削除 ${val(p.fields?.["プログラムID"])}「${val(p.fields?.["プログラム名称"])}」(${TARGET_MENU})  record=${p.record_id}`);
    await del(T_PROG, p.record_id);
  }

  // 2) グループ権限（撤去するPGMに紐づく program 権限）
  const gperm = await fetchAll(c, T_GPERM);
  const permTargets = gperm.filter((r) => val(r.fields?.["対象種別"]) === "program" && pgmIds.includes(val(r.fields?.["対象ID"]).trim()));
  for (const r of permTargets) {
    console.log(`  - 権限削除 ${val(r.fields?.["グループ名"])} program:${val(r.fields?.["対象ID"])}  record=${r.record_id}`);
    await del(T_GPERM, r.record_id);
  }

  console.log(`\n配置削除=${targets.length} / 権限削除=${permTargets.length}`);
  if (!exec && (targets.length || permTargets.length)) console.log(`\n--execute を付けて実削除してください。`);
  console.log(`=== 完了${exec ? "" : " (DRY-RUN)"} ===`);
}

main().catch((e) => { console.error("[fatal]", e?.response?.data || e); process.exit(1); });
