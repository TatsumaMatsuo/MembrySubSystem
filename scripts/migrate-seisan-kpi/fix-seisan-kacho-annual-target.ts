/**
 * 課レベル 生産量(補助KPI) の「年間目標」誤登録を修正する。
 *
 * 症状: M-33/43/53/63/73/83 の 年間目標 に“月次目標と同じ値(月平均)”が入っており、
 *       累計実績と基準が合わず進捗率が1000%前後になる。正しい年間目標 = 月次目標 × 12。
 *       (親 M-16=1505 / M-17=447058 に各課の月次×12の合計がほぼ一致することで裏付け)
 *
 * 実行:
 *   dry-run(既定・変更予定のみ表示): npx tsx scripts/migrate-seisan-kpi/fix-seisan-kacho-annual-target.ts [期]
 *   実書込:                          npx tsx scripts/migrate-seisan-kpi/fix-seisan-kacho-annual-target.ts [期] --execute
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getBaseRecords, updateBaseRecord, getLarkBaseToken } from "../../lib/lark-client";
import { getLarkTables, SEISAN_KPI_MASTER_FIELDS as MF } from "../../lib/lark-tables";

const TARGET_KPIS = ["M-33", "M-43", "M-53", "M-63", "M-73", "M-83"];
const EXECUTE = process.argv.includes("--execute");

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}
function asNum(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(asText(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const argPeriod = Number(process.argv.find((a) => /^\d+$/.test(a)));
  const period = Number.isFinite(argPeriod) && argPeriod > 0 ? argPeriod : 50;
  const t = getLarkTables();
  const baseToken = getLarkBaseToken();
  console.log(`期=${period} mode=${EXECUTE ? "EXECUTE(実書込)" : "dry-run"}`);

  const r: any = await getBaseRecords(t.SEISAN_KPI_MASTER, {
    baseToken,
    filter: `CurrentValue.[${MF.period}] = ${period}`,
    pageSize: 500,
  });
  const items = (r.data?.items ?? []) as any[];

  let changed = 0, skipped = 0;
  for (const kpiId of TARGET_KPIS) {
    const it = items.find((x) => asText(x.fields[MF.kpi_id]) === kpiId);
    if (!it) { console.log(`  [SKIP] ${kpiId}: マスタに無し(期${period})`); skipped++; continue; }
    const dept = asText(it.fields[MF.department]);
    const annual = asNum(it.fields[MF.annual_target]) ?? 0;
    const monthly = asNum(it.fields[MF.monthly_target]) ?? 0;
    const correct = round1(monthly * 12);

    // 安全ガード: 既に年間≒月次×12 なら修正不要 / 月次≒年間(誤登録)のときのみ修正
    const alreadyOk = Math.abs(annual - correct) / Math.max(1, correct) < 0.02;
    const misEntered = Math.abs(monthly - annual) / Math.max(1, annual) < 0.02;
    if (alreadyOk) { console.log(`  [OK  ] ${kpiId} ${dept}: 年間=${annual} は既に正常`); skipped++; continue; }
    if (!misEntered) { console.log(`  [WARN] ${kpiId} ${dept}: 年間=${annual} 月次=${monthly} は誤登録パターンに一致せず → 手動確認`); skipped++; continue; }

    console.log(`  [FIX ] ${kpiId} ${dept}: 年間目標 ${annual} -> ${correct}  (月次=${monthly}×12)`);
    changed++;
    if (EXECUTE) {
      const up: any = await updateBaseRecord(t.SEISAN_KPI_MASTER, it.record_id, { [MF.annual_target]: correct }, { baseToken });
      if (up.code !== 0) console.error(`    更新失敗 code=${up.code} msg=${up.msg}`);
    }
  }

  console.log(`\n=== 結果 === ${EXECUTE ? "更新" : "更新予定"}=${changed} / skip=${skipped}`);
  if (!EXECUTE && changed) console.log("--execute を付けて実書込してください。");
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });
