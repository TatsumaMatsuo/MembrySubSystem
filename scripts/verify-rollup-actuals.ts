/**
 * 積み上げ(rollup)整合性チェック
 *
 * 目的: 生産本部KPIで「親(集約)KPI」が SEISAN_KPI_ACTUAL に月別実績を保持しているか、
 *       また保持している場合、子(課)からの積み上げ値と一致しているかを照合する。
 *
 * 親KPI = 他のKPIから rollup_target(積み上げ先KPI) として参照されているKPI。
 * 集計: 親が「平均」型なら子の月別値の平均、それ以外(累計等)なら合算。「直近月値」型は積み上げ対象外。
 *
 * 実行: npx tsx scripts/verify-rollup-actuals.ts [period]
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN || "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const T_MASTER = process.env.LARK_TABLE_SEISAN_KPI_MASTER || "tblCiDxUsOEM05Tc";
const T_PERIOD = process.env.LARK_TABLE_SEISAN_KPI_PERIOD || "tblseheBISHZKGnh";
const T_ACTUAL = process.env.LARK_TABLE_SEISAN_KPI_ACTUAL || "tbl3X8Xe8r1BoXnU";

// 手入力維持(積み上げ対象外)の親 — services/seisan-kpi.service.ts の ROLLUP_MANUAL_PARENTS と一致させること
const ROLLUP_MANUAL_PARENTS = new Set<string>(["M-14", "M-15"]);
const MF = { kpi_id: "KPIコード", period: "期", level: "階層", department: "部署", kpi_name: "KPI名称", unit: "単位", agg_type: "集計タイプ", direction: "良い方向", rollup_target: "積み上げ先KPI" };
const PF = { period: "期", is_current: "当期フラグ" };
const AF = { period: "期", kpi_id: "KPIコード", fiscal_month: "会計月序", value: "実績値" };

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? String(v.value ?? "");
  return String(v);
}
function asNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(asText(v));
  return Number.isFinite(n) ? n : null;
}

async function fetchAll(client: lark.Client, tableId: string, filter?: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: tableId },
      params: { page_size: 500, page_token: pageToken, ...(filter ? { filter } : {}) },
    });
    if (res.code !== 0) { console.error(`fetch ${tableId} error:`, res.msg); break; }
    items.push(...(res.data?.items || []));
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // 期の決定
  let period = Number(process.argv[2]);
  if (!period) {
    const periods = await fetchAll(client, T_PERIOD);
    const cur = periods.find((p) => p.fields?.[PF.is_current] === true || p.fields?.[PF.is_current] === 1);
    period = asNum(cur?.fields?.[PF.period]) ?? asNum(periods[0]?.fields?.[PF.period]) ?? 50;
  }
  console.log(`\n=== 積み上げ整合性チェック (period=${period}) ===\n`);

  const master = (await fetchAll(client, T_MASTER, `CurrentValue.[${MF.period}] = ${period}`)).map((r) => ({
    kpiId: asText(r.fields?.[MF.kpi_id]),
    level: asText(r.fields?.[MF.level]),
    department: asText(r.fields?.[MF.department]),
    name: asText(r.fields?.[MF.kpi_name]),
    unit: asText(r.fields?.[MF.unit]),
    aggType: asText(r.fields?.[MF.agg_type]) || "累計",
    rollupTarget: asText(r.fields?.[MF.rollup_target]).trim(),
  }));
  const byId = new Map(master.map((m) => [m.kpiId, m]));

  // 親 → 子
  const childrenByParent = new Map<string, typeof master>();
  for (const m of master) {
    if (m.rollupTarget) {
      if (!childrenByParent.has(m.rollupTarget)) childrenByParent.set(m.rollupTarget, [] as any);
      childrenByParent.get(m.rollupTarget)!.push(m);
    }
  }

  // 実績: kpiId -> (fm -> value)
  const actuals = new Map<string, Map<number, number | null>>();
  const actualRecords = await fetchAll(client, T_ACTUAL, `CurrentValue.[${AF.period}] = ${period}`);
  for (const r of actualRecords) {
    const kpiId = asText(r.fields?.[AF.kpi_id]);
    const fm = asNum(r.fields?.[AF.fiscal_month]);
    if (!kpiId || !fm) continue;
    if (!actuals.has(kpiId)) actuals.set(kpiId, new Map());
    actuals.get(kpiId)!.set(fm, asNum(r.fields?.[AF.value]));
  }

  const parents = [...childrenByParent.keys()].filter((id) => byId.has(id));
  if (parents.length === 0) {
    console.log("rollup_target で参照される親KPIがありません(積み上げ未設定)。\n");
    return;
  }

  console.log(`親(集約)KPI: ${parents.length}件\n`);
  let storedCount = 0, emptyCount = 0, mismatchCount = 0;

  for (const pid of parents.sort()) {
    const p = byId.get(pid)!;
    const children = childrenByParent.get(pid)!;
    const skip = p.aggType === "直近月値" || ROLLUP_MANUAL_PARENTS.has(pid);
    const own = actuals.get(pid) ?? new Map<number, number | null>();
    const ownMonths = [...own.entries()].filter(([, v]) => v != null).map(([fm]) => fm).sort((a, b) => a - b);
    const hasStored = ownMonths.length > 0;
    if (hasStored) storedCount++; else emptyCount++;

    // 子から積み上げ(各月)
    const diffs: string[] = [];
    for (let fm = 1; fm <= 12; fm++) {
      const vs = children.map((c) => actuals.get(c.kpiId)?.get(fm)).filter((v): v is number => v != null);
      const computed = vs.length === 0 ? null : (p.aggType === "平均" ? vs.reduce((s, v) => s + v, 0) / vs.length : vs.reduce((s, v) => s + v, 0));
      const stored = own.get(fm) ?? null;
      const c2 = computed == null ? null : Math.round(computed * 100) / 100;
      const s2 = stored == null ? null : Math.round(stored * 100) / 100;
      if (!skip && c2 != null && c2 !== s2) diffs.push(`  月${fm}: 保存=${s2 ?? "—"} / 積上=${c2}`);
    }
    if (diffs.length) mismatchCount++;

    const tag = skip ? "[手入力=対象外]" : hasStored ? (diffs.length ? "⚠ 不一致" : "✓ 一致") : "✗ 保存なし";
    console.log(`${tag}  ${pid}  L${p.level || "-"}  ${p.department}/${p.name}  子${children.length}件  保存月[${ownMonths.join(",") || "なし"}]`);
    if (diffs.length) diffs.slice(0, 12).forEach((d) => console.log(d));
  }

  console.log(`\n--- サマリ ---`);
  console.log(`親KPI ${parents.length}件 : 保存あり=${storedCount} / 保存なし=${emptyCount} / 積上と不一致=${mismatchCount}`);
  console.log(`(「保存なし」または「不一致」の親は、ダッシュボードで0/空または誤値になり得ます)\n`);
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });
