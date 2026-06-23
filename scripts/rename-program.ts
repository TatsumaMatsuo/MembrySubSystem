/**
 * プログラム名称を変更。
 *   npx tsx scripts/rename-program.ts PGM010 "納期変更"            # プレビュー
 *   npx tsx scripts/rename-program.ts PGM010 "納期変更" --execute  # 反映
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

(async () => {
  const pid = process.argv[2];
  const newName = process.argv[3];
  const execute = process.argv.includes("--execute");
  if (!pid || !newName) throw new Error("usage: rename-program.ts <PGMID> <新名称> [--execute]");

  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const items: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: T_PROG },
      params: { page_size: 500, page_token: pt },
    });
    items.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);

  const rec = items.find((r) => val(r.fields?.["プログラムID"]).trim() === pid);
  if (!rec) throw new Error(`${pid} が見つかりません`);
  const cur = val(rec.fields?.["プログラム名称"]);
  console.log(`${pid}: 「${cur}」 → 「${newName}」${execute ? "" : " (DRY-RUN)"}`);
  if (cur === newName) {
    console.log("  既に一致 → スキップ");
    return;
  }
  if (execute) {
    const r: any = await c.bitable.appTableRecord.update({
      path: { app_token: BASE, table_id: T_PROG, record_id: rec.record_id },
      data: { fields: { "プログラム名称": newName } },
    });
    if (r.code !== 0) throw new Error(`update failed: ${r.msg}`);
    console.log("  反映完了");
  }
})().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
