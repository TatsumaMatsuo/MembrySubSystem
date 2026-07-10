/**
 * 経営メニュー(M014)を「共通(M001)」と「総務部(M002)」の間に移動。
 * L1メニューの表示順を再採番(整数連番)。生産本部KPI(M015)は末尾のまま。
 *
 *   npx tsx scripts/reorder-keiei-menu.ts --dry-run   # 確認のみ
 *   npx tsx scripts/reorder-keiei-menu.ts             # 実行
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const T = (v: any) => (v == null ? "" : typeof v === "string" ? v : Array.isArray(v) ? v.map((x: any) => x?.text ?? x).join("") : v.text ?? String(v));

// 望ましいL1並び(この順で 1..N を採番)
const DESIRED_ORDER = ["M001", "M014", "M002", "M003", "M004", "M005", "M006", "M007", "M008", "M009", "M010", "M011", "M012", "M013", "M015"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const c = new lark.Client({ appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c", appSecret: process.env.LARK_APP_SECRET || "", appType: lark.AppType.SelfBuild, domain: process.env.LARK_DOMAIN || "https://open.larksuite.com" });

  const items: any[] = []; let pt: string | undefined;
  do { const r: any = await c.bitable.appTableRecord.list({ path: { app_token: BASE, table_id: TABLE }, params: { page_size: 200, page_token: pt } }); items.push(...(r.data?.items || [])); pt = r.data?.has_more ? r.data?.page_token : undefined; } while (pt);

  const byId = new Map<string, any>();
  for (const it of items) {
    const id = T(it.fields["メニューID"]).trim();
    const parent = T(it.fields["親メニューID"]).trim();
    const lvl = String(it.fields["階層レベル"] ?? "");
    if (lvl === "1" || parent === "") byId.set(id, it);
  }

  console.log(`=== 経営メニュー並べ替え${dryRun ? " (DRY-RUN)" : ""} ===`);
  let n = 0, changed = 0;
  for (const id of DESIRED_ORDER) {
    const it = byId.get(id);
    if (!it) { console.log(`  ⚠ ${id} が見つかりません(スキップ)`); continue; }
    n += 1;
    const cur = Number(it.fields["表示順"]);
    if (cur === n) { console.log(`  ✓ 順${n} ${id}「${T(it.fields["メニュー名"])}」 変更なし`); continue; }
    console.log(`  + 順${cur} → ${n}  ${id}「${T(it.fields["メニュー名"])}」`);
    if (!dryRun) {
      const res: any = await c.bitable.appTableRecord.update({ path: { app_token: BASE, table_id: TABLE, record_id: it.record_id }, data: { fields: { "表示順": n } } });
      if (res.code !== 0) throw new Error(`update failed (${id}): ${res.msg}`);
    }
    changed += 1;
  }
  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} === 対象 ${n} 件 / 更新 ${dryRun ? "(dry-run)" : changed} 件`);
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });
