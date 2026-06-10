/**
 * 経営レイヤー(L0/L1) サービス層
 * 設計: docs/kpi-system/07_kpi-layering.md / 04_api-design.md
 *
 * #45 全社KPI: 年度目標(既存 COMPANY_KPI) × 会計実績(KAIKEI_ACTUAL) を突合。
 * 会計実績は粒度(月/四半期/半期)を年度累計に正規化(lib/kpi normalizeKaikei)。
 */
import { getBaseRecords, getLarkBaseToken } from "@/lib/lark-client";
import {
  getLarkTables,
  COMPANY_KPI_FIELDS as CK,
  KAIKEI_ACTUAL_FIELDS as KA,
  KEIEI_MIDTERM_PLAN_HEADER_FIELDS as MH,
  KEIEI_MIDTERM_PLAN_FIELDS as MD,
} from "@/lib/lark-tables";
import {
  normalizeKaikei,
  attainmentRate,
  judgeByRate,
  proratedTarget,
  type Judgment,
  type Granularity,
  type KaikeiRow,
} from "@/lib/kpi";
import { getPeriods } from "@/services/seisan-kpi.service";

const base = () => getLarkBaseToken();

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text ?? x).join("");
  if (typeof v === "object" && (v as any).text != null) return String((v as any).text);
  return String(v);
}
function asNum(v: unknown): number {
  const t = asText(v).trim();
  if (t === "") return typeof v === "number" ? v : 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** COMPANY_KPI(全社年度計画)を期で取得 */
async function getCompanyTargets(period: number): Promise<Record<string, number>> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.COMPANY_KPI, {
    baseToken: base(),
    filter: `CurrentValue.[${CK.period}] = ${period}`,
    pageSize: 10,
  });
  const it = (r.data?.items ?? [])[0] as any;
  if (!it) return {};
  const f = it.fields;
  const out: Record<string, number> = {};
  for (const [k, field] of Object.entries(CK)) out[k] = asNum(f[field as string]);
  return out;
}

/** KAIKEI_ACTUAL を勘定科目ごとに年度累計へ正規化(百万円) */
async function getKaikeiCumByAccount(period: number): Promise<Map<string, number>> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.KAIKEI_ACTUAL, {
    baseToken: base(),
    filter: `CurrentValue.[${KA.period}] = ${period}`,
    pageSize: 500,
  });
  const items = (r.data?.items ?? []) as any[];
  const byAccount = new Map<string, KaikeiRow[]>();
  for (const it of items) {
    const account = asText(it.fields[KA.account]);
    if (!account) continue;
    const row: KaikeiRow = {
      granularity: (asText(it.fields[KA.granularity]) || "月") as Granularity,
      period: asText(it.fields[KA.span]),
      value: asNum(it.fields[KA.value]),
    };
    if (!byAccount.has(account)) byAccount.set(account, []);
    byAccount.get(account)!.push(row);
  }
  const cum = new Map<string, number>();
  for (const [account, rows] of byAccount) cum.set(account, normalizeKaikei(rows));
  return cum;
}

export type Dir = "高" | "少";

export interface CompanyKpiRow {
  name: string;
  /** 年度目標(億) */
  target: number;
  /** 月次目標(億・任意) */
  monthlyTarget: number | null;
  /** 実績累計(億・未入力は null) */
  actual: number | null;
  /** 進捗率(ペース) */
  pace: number | null;
  /** 着地見込(億) */
  landing: number | null;
  judgment: Judgment | null;
  major: boolean;
  dir: Dir;
}

// 千円 → 億(÷100,000) / 百万円 → 億(÷100)
const senToOku = (v: number) => v / 100000;
const millionToOku = (v: number) => v / 100;

/** #45 全社KPI: PL行を構築 */
export async function buildCompanyKpi(period: number): Promise<{
  period: number;
  elapsedMonths: number;
  hasActuals: boolean;
  plRows: CompanyKpiRow[];
  otherRows: { name: string; target: string; actual: string; judgment: Judgment | null }[];
}> {
  const [periods, targets, kaikei] = await Promise.all([
    getPeriods(),
    getCompanyTargets(period),
    getKaikeiCumByAccount(period),
  ]);
  const elapsed = periods.find((p) => p.period === period)?.elapsedMonths ?? 0;
  const hasActuals = kaikei.size > 0;

  // 会計実績(億)を勘定科目で引く
  const actOku = (account: string): number | null =>
    kaikei.has(account) ? millionToOku(kaikei.get(account)!) : null;

  type Def = {
    name: string;
    target: number; // 億
    monthlyTarget?: number | null;
    actual: number | null; // 億
    dir: Dir;
    major?: boolean;
  };
  const salesT = senToOku(targets.sales_target ?? 0);
  const costT = senToOku(targets.cost_of_sales ?? 0);
  const salesA = actOku("売上高");
  const costA = actOku("製造原価");
  const grossA = salesA != null && costA != null ? salesA - costA : null;

  const defs: Def[] = [
    { name: "売上高", target: salesT, monthlyTarget: senToOku(targets.monthly_sales_target ?? 0), actual: salesA, dir: "高", major: true },
    { name: "売上原価(製造原価)", target: costT, actual: costA, dir: "少" },
    { name: "売上総利益(粗利)", target: salesT - costT, actual: grossA, dir: "高", major: true },
    { name: "販管費", target: senToOku(targets.sga_expenses ?? 0), actual: actOku("販管費"), dir: "少" },
    { name: "営業利益", target: senToOku(targets.operating_income ?? 0), actual: actOku("営業利益"), dir: "高", major: true },
    { name: "経常利益", target: senToOku(targets.ordinary_income ?? 0), actual: actOku("経常利益"), dir: "高", major: true },
  ];

  const plRows: CompanyKpiRow[] = defs.map((d) => {
    let pace: number | null = null;
    let judgment: Judgment | null = null;
    let landing: number | null = null;
    if (d.actual != null && elapsed > 0) {
      pace = attainmentRate(
        { aggType: "累計", direction: d.dir === "高" ? "高い方が良い" : "少ない方が良い", annualTarget: d.target },
        d.actual,
        elapsed
      );
      judgment = judgeByRate(pace);
      landing = (d.actual / elapsed) * 12;
    }
    return {
      name: d.name,
      target: d.target,
      monthlyTarget: d.monthlyTarget ?? null,
      actual: d.actual,
      pace,
      landing,
      judgment,
      major: d.major ?? false,
      dir: d.dir,
    };
  });

  // 率・その他(目標表示中心)
  const otherRows = [
    { name: "限界利益", target: `${senToOku(targets.marginal_profit ?? 0).toFixed(1)}億`, actual: "―", judgment: null },
    { name: "固定費", target: `${senToOku(targets.fixed_cost ?? 0).toFixed(1)}億`, actual: "―", judgment: null },
    { name: "製造原価率(目標)", target: `${targets.manufacturing_cost_rate ?? 0}%`, actual: "―", judgment: null },
    { name: "外注発注率(目標)", target: `${targets.outsourcing_rate ?? 0}%`, actual: "―", judgment: null },
    { name: "人員計画", target: `${targets.headcount_plan ?? 0} 人`, actual: "―", judgment: null },
  ];

  void proratedTarget; // (将来: 月割合算表示で使用)
  return { period, elapsedMonths: elapsed, hasActuals, plRows, otherRows };
}

/* =========================================================================
 * #44 中期経営計画ダッシュボード
 * ========================================================================= */

export interface MidtermKgi {
  indicator: string;
  unit: string;
  /** 期→年度目標(線形補間値) */
  trajectory: { period: number; target: number }[];
  finalTarget: number;
  finalPeriod: number;
  /** 現在(当期)の年換算実績(会計データから・未入力は null) */
  currentActual: number | null;
  /** 到達度 = 現在 ÷ 最終目標 */
  attainment: number | null;
}

export interface MidtermHeader {
  planId: string;
  name: string;
  startPeriod: number;
  endPeriod: number;
  status: string;
  kgiSet: string[];
}

/** 中計ヘッダ(現行優先)を取得 */
export async function getMidtermHeaders(): Promise<MidtermHeader[]> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.KEIEI_MIDTERM_PLAN_HEADER, { baseToken: base(), pageSize: 100 });
  const items = (r.data?.items ?? []) as any[];
  return items.map((it) => {
    const f = it.fields;
    const kgi = f[MH.kgi_set];
    return {
      planId: asText(f[MH.plan_id]),
      name: asText(f[MH.name]),
      startPeriod: asNum(f[MH.start_period]),
      endPeriod: asNum(f[MH.end_period]),
      status: asText(f[MH.status]),
      kgiSet: Array.isArray(kgi) ? kgi.map((x: any) => asText(x?.text ?? x)) : asText(kgi) ? [asText(kgi)] : [],
    };
  });
}

/** 中計明細(指標×対象期)を取得 */
async function getMidtermDetails(planId: string): Promise<{ indicator: string; unit: string; period: number; target: number; finalTarget: number }[]> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.KEIEI_MIDTERM_PLAN, {
    baseToken: base(),
    filter: `CurrentValue.[${MD.plan_id}] = "${planId}"`,
    pageSize: 500,
  });
  const items = (r.data?.items ?? []) as any[];
  return items.map((it) => {
    const f = it.fields;
    return {
      indicator: asText(f[MD.indicator]),
      unit: asText(f[MD.unit]),
      period: asNum(f[MD.period]),
      target: asNum(f[MD.annual_target]),
      finalTarget: asNum(f[MD.final_target]),
    };
  });
}

/** KGIの現在実績(会計データから年換算) */
async function currentKgiActual(indicator: string, period: number, elapsed: number): Promise<number | null> {
  if (elapsed <= 0) return null;
  const kaikei = await getKaikeiCumByAccount(period);
  const ann = (account: string) => (kaikei.has(account) ? (kaikei.get(account)! / elapsed) * 12 : null); // 百万円・年換算
  if (indicator === "売上高") {
    const v = ann("売上高");
    return v == null ? null : millionToOku(v); // 億
  }
  if (indicator === "ROA") {
    const profit = ann("経常利益"); // 百万円
    const assets = kaikei.has("総資産") ? kaikei.get("総資産")! : null; // 直近(正規化)百万円
    if (profit == null || !assets) return null;
    return (profit / assets) * 100; // %
  }
  if (indicator === "労働生産性") {
    // 控除法付加価値(年換算) ÷ 人員。付加価値 = 経常利益+人件費+賃借料+租税公課+純金融費用+減価償却費
    const parts = ["経常利益", "人件費", "賃借料", "租税公課", "純金融費用", "減価償却費"];
    let va = 0; let any = false;
    for (const p of parts) { const v = ann(p); if (v != null) { va += v; any = true; } }
    const headcount = kaikei.has("人員数") ? kaikei.get("人員数")! : null;
    if (!any || !headcount) return null;
    return va / headcount; // 百万円/人
  }
  return null;
}

/** 中計ダッシュボード構築(現行中計 or 指定planId) */
export async function buildMidtermDashboard(planId?: string): Promise<{
  header: MidtermHeader | null;
  currentPeriod: number;
  elapsedMonths: number;
  kgis: MidtermKgi[];
  registered: boolean;
}> {
  const [headers, periods] = await Promise.all([getMidtermHeaders(), getPeriods()]);
  const cur = periods.find((p) => p.isCurrent) ?? periods[0];
  const currentPeriod = cur?.period ?? 50;
  const elapsed = cur?.elapsedMonths ?? 0;

  const header = planId
    ? headers.find((h) => h.planId === planId) ?? null
    : headers.find((h) => h.status === "現行") ?? headers[0] ?? null;

  if (!header) {
    return { header: null, currentPeriod, elapsedMonths: elapsed, kgis: [], registered: false };
  }

  const details = await getMidtermDetails(header.planId);
  // 指標ごとに集約
  const byIndicator = new Map<string, { unit: string; finalTarget: number; finalPeriod: number; points: { period: number; target: number }[] }>();
  for (const d of details) {
    if (!byIndicator.has(d.indicator)) byIndicator.set(d.indicator, { unit: d.unit, finalTarget: d.finalTarget, finalPeriod: header.endPeriod, points: [] });
    const e = byIndicator.get(d.indicator)!;
    e.points.push({ period: d.period, target: d.target });
    if (d.finalTarget) e.finalTarget = d.finalTarget;
  }

  const kgis: MidtermKgi[] = [];
  for (const [indicator, e] of byIndicator) {
    e.points.sort((a, b) => a.period - b.period);
    const currentActual = await currentKgiActual(indicator, currentPeriod, elapsed);
    const finalTarget = e.finalTarget || (e.points.length ? e.points[e.points.length - 1].target : 0);
    kgis.push({
      indicator,
      unit: e.unit,
      trajectory: e.points,
      finalTarget,
      finalPeriod: e.finalPeriod,
      currentActual,
      attainment: currentActual != null && finalTarget ? currentActual / finalTarget : null,
    });
  }

  return { header, currentPeriod, elapsedMonths: elapsed, kgis, registered: true };
}
