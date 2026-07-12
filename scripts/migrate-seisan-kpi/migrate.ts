/**
 * 生産本部KPI 初期データ移行(#57)
 *
 * Excel(50期生産本部KPIマスタ)から生成した JSON(build-data.py 出力)を
 * Lark Base に投入する。**既定は dry-run**(書込なし・件数とサンプル表示)。
 *
 * 使い方:
 *   npx tsx scripts/migrate-seisan-kpi/migrate.ts            # dry-run(全テーブル)
 *   npx tsx scripts/migrate-seisan-kpi/migrate.ts --apply    # 実書込
 *   npx tsx scripts/migrate-seisan-kpi/migrate.ts --only=master --apply
 *
 * 対象: 期マスタ / KPIマスタ / グループ+所属 / 過去実績
 * (実績・会計・中計は別パス)
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").replace("--only=", "");
const BASE = process.env.LARK_BASE_TOKEN || "";
const DATA = path.join(__dirname, "data");

const TBL = {
  period: process.env.LARK_TABLE_SEISAN_KPI_PERIOD || "tblseheBISHZKGnh",
  master: process.env.LARK_TABLE_SEISAN_KPI_MASTER || "tblCiDxUsOEM05Tc",
  group: process.env.LARK_TABLE_SEISAN_KPI_GROUP || "tbleQOhwn9RkOXcK",
  member: process.env.LARK_TABLE_SEISAN_KPI_GROUP_MEMBER || "tblRQcbFM1fxP5Wa",
  history: process.env.LARK_TABLE_SEISAN_KPI_HISTORY || "tblWjZkAUGXaZVH0",
  actuals: process.env.LARK_TABLE_SEISAN_KPI_ACTUAL || "tbl3X8Xe8r1BoXnU",
};

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const ms = (d: string) => new Date(d + "T00:00:00+09:00").getTime();
const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Lark Contact 部門ツリー → 部署名→open_department_id */
async function deptNameToId(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    let pt: string | undefined;
    do {
      const r: any = await client.contact.department.list({
        params: { department_id_type: "open_department_id", parent_department_id: "0", fetch_child: true, page_size: 50, page_token: pt },
      });
      for (const d of r.data?.items || []) map.set(String(d.name || "").trim(), d.open_department_id);
      pt = r.data?.has_more ? r.data?.page_token : undefined;
    } while (pt);
  } catch (e: any) {
    console.warn("  [warn] 部門ツリー取得失敗(部署コードは空で続行):", e?.message || e);
  }
  return map;
}

async function migrate(label: string, tableId: string, records: Record<string, any>[]) {
  if (ONLY && ONLY !== label) return;
  console.log(`\n=== ${label}  (${records.length}件) → ${tableId} ===`);
  console.log("  sample:", JSON.stringify(records[0]?.fields ?? records[0]).slice(0, 200));
  if (!APPLY) {
    console.log(`  [dry-run] 書込なし。--apply で実投入`);
    return;
  }
  let ok = 0;
  for (const part of chunk(records, 500)) {
    const r: any = await client.bitable.appTableRecord.batchCreate({
      path: { app_token: BASE, table_id: tableId },
      data: { records: part.map((f) => ({ fields: f })) },
    });
    ok += r.data?.records?.length || 0;
  }
  console.log(`  ✅ 書込 ${ok}件`);
}

(async () => {
  console.log(`生産本部KPI 初期データ移行 — ${APPLY ? "★APPLY(実書込)" : "dry-run"}${ONLY ? ` only=${ONLY}` : ""}`);
  console.log(`Base: ${BASE}`);

  const dmap = await deptNameToId();
  console.log(`Lark部門マッチ: ${dmap.size}件`);

  // 1) 期マスタ
  const period = readJson("period.json").map((p: any) => ({
    ...p, 期間開始日: ms(p["期間開始日"]), 期間終了日: ms(p["期間終了日"]),
  }));
  await migrate("period", TBL.period, period);

  // 2) KPIマスタ(部署→部署コード解決)
  const master = readJson("kpi-master.json").map((k: any) => ({
    ...k, 部署コード: dmap.get(String(k["部署"]).trim()) || "",
  }));
  await migrate("master", TBL.master, master);

  // 3) グループ + 所属
  const g = readJson("groups.json");
  await migrate("group", TBL.group, g.groups);
  const members = g.members.map((m: any) => ({ ...m, 部署コード: dmap.get(String(m["部署"]).trim()) || "" }));
  await migrate("member", TBL.member, members);

  // 4) 過去実績
  await migrate("history", TBL.history, readJson("history.json"));

  // 5) 50期 月次実績(縦持ち) ※actuals.json がある場合のみ
  try {
    await migrate("actuals", TBL.actuals, readJson("actuals.json"));
  } catch { /* actuals.json 無ければスキップ */ }

  console.log(`\n${APPLY ? "完了(実書込)" : "dry-run完了。問題なければ --apply"}`);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
