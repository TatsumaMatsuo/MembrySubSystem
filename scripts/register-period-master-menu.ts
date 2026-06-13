/**
 * 期マスタ管理(PGM044)のメニュー登録 + 権限付与
 *
 * - 機能配置マスタに PGM044「期マスタ管理」(/keiei/periods, 経営 M014-01) を登録(冪等)
 * - グループ権限マスタで PGM034(会計) または PGM035(中計) を許可しているグループに
 *   PGM044 の許可行を追加(冪等)。= 経営マスタ管理者と同じ範囲に期マスタ編集権限を付与。
 *
 * 使い方:
 *   npx tsx scripts/register-period-master-menu.ts --dry-run   # 変更内容の確認のみ
 *   npx tsx scripts/register-period-master-menu.ts             # 実行
 *
 * 注: PGM041〜PGM043 は既存(過去実績参照/エクスポート/ヘルプ)のため、期マスタは PGM044。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const PGM = { id: "PGM044", name: "期マスタ管理", menu_id: "M014-01", url: "/keiei/periods", sort: 5 };
const SOURCE_PROGRAMS = ["PGM034", "PGM035"]; // この許可を持つグループへ PGM044 を付与

function f(rec: any, name: string): string {
  const v = rec?.fields?.[name];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

async function fetchAll(client: lark.Client, tableId: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: tableId },
      params: { page_size: 100, page_token: pageToken },
    });
    if (res.code !== 0) throw new Error(`Fetch failed (${tableId}): ${res.msg}`);
    items.push(...(res.data?.items || []));
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === 1) 機能配置マスタに PGM044 を登録 ===
  console.log(`=== 機能配置マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);
  const progIds = new Set(programs.map((r) => f(r, "プログラムID").trim()));
  if (progIds.has(PGM.id)) {
    console.log(`  ✓ ${PGM.id}「${PGM.name}」既存 → スキップ`);
  } else {
    console.log(`  + ${PGM.id}「${PGM.name}」→ ${PGM.url} (配置=${PGM.menu_id})`);
    if (!dryRun) {
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT },
        data: { fields: { "プログラムID": PGM.id, "プログラム名称": PGM.name, "配置メニューID": PGM.menu_id, "URLパス": PGM.url, "表示順": PGM.sort, "有効フラグ": true } },
      });
      if (res.code !== 0) throw new Error(`Program create failed: ${res.msg}`);
    }
  }

  // === 2) グループ権限マスタ: PGM034/035 を持つグループに PGM044 を付与 ===
  console.log(`\n=== グループ権限マスタ${dryRun ? " (DRY-RUN)" : ""} ===`);
  const perms = await fetchAll(client, TABLE_GROUP_PERMISSION);
  // PGM044 を既に持つグループ
  const alreadyGranted = new Set(
    perms.filter((r) => f(r, "対象種別") === "program" && f(r, "対象ID").trim() === PGM.id).map((r) => f(r, "グループ名").trim())
  );
  // PGM034/035 を持つグループ(グループ名→グループID)
  const targetGroups = new Map<string, string>();
  for (const r of perms) {
    if (f(r, "対象種別") === "program" && SOURCE_PROGRAMS.includes(f(r, "対象ID").trim())) {
      const name = f(r, "グループ名").trim();
      if (name) targetGroups.set(name, f(r, "グループID").trim());
    }
  }
  if (targetGroups.size === 0) {
    console.log("  ⚠ PGM034/PGM035 を許可しているグループが見つかりません(個別権限運用の可能性)。手動付与が必要です。");
  }
  let granted = 0;
  for (const [name, gid] of targetGroups) {
    if (alreadyGranted.has(name)) { console.log(`  ✓ グループ「${name}」既に PGM044 付与済み → スキップ`); continue; }
    console.log(`  + グループ「${name}」(${gid}) に PGM044 を付与`);
    if (!dryRun) {
      const res: any = await client.bitable.appTableRecord.create({
        path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
        data: { fields: { "グループID": gid, "グループ名": name, "対象種別": "program", "対象ID": PGM.id, "許可フラグ": true } },
      });
      if (res.code !== 0) throw new Error(`Grant create failed (${name}): ${res.msg}`);
      granted++;
    }
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
  console.log(`  対象グループ ${targetGroups.size} 件 / 新規付与 ${dryRun ? "(dry-run)" : granted} 件`);
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });
