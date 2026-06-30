/**
 * TOPカスタムリンク(tblup7d4meehzX92)の既存レコードの「ユーザーID」を全て "ALL"(共通=全ユーザー表示)に変更する。
 *
 * 実行:
 *   既定 dry-run:  npx tsx scripts/migrate-top-custom-links-to-all.ts
 *   実書込:        npx tsx scripts/migrate-top-custom-links-to-all.ts --execute
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN || "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const TABLE = process.env.LARK_TABLE_TOP_CUSTOM_LINKS || "tblup7d4meehzX92";
const USER_ID_FIELD = "ユーザーID";
const COMMON = "ALL";

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

async function main() {
  const exec = process.argv.includes("--execute");
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  console.log(`=== TOPカスタムリンク ユーザーID→${COMMON} 移行${exec ? "" : " (DRY-RUN)"} ===`);
  console.log(`base=${BASE} table=${TABLE}`);

  // 全件取得
  const items: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({ path: { app_token: BASE, table_id: TABLE }, params: { page_size: 500, page_token: pt } });
    if (r.code !== 0) throw new Error(`list: ${r.msg}`);
    items.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);
  console.log(`総レコード数: ${items.length}`);

  let changed = 0, already = 0, failed = 0;
  for (const it of items) {
    const cur = val(it.fields?.[USER_ID_FIELD]).trim();
    const name = val(it.fields?.["表示名"]);
    if (cur === COMMON) { already++; continue; }
    console.log(`  [FIX] "${cur}" -> ${COMMON}  「${name}」 record=${it.record_id}`);
    changed++;
    if (exec) {
      const u: any = await c.bitable.appTableRecord.update({
        path: { app_token: BASE, table_id: TABLE, record_id: it.record_id },
        data: { fields: { [USER_ID_FIELD]: COMMON } },
      });
      if (u.code !== 0) { console.error(`    更新失敗 code=${u.code} msg=${u.msg}`); failed++; changed--; }
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`  既に ${COMMON}: ${already}`);
  console.log(`  ${exec ? "更新" : "更新予定"}: ${changed}`);
  if (failed) console.log(`  失敗: ${failed}`);
  if (!exec && changed) console.log(`\n--execute を付けて実書込してください。`);
}

main().catch((e) => { console.error("[fatal]", e?.response?.data || e); process.exit(1); });
