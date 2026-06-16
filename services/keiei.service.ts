/**
 * 経営レイヤー(L0/L1) サービス層
 * 設計: docs/kpi-system/07_kpi-layering.md / 04_api-design.md
 *
 * #45 全社KPI: 年度目標(既存 COMPANY_KPI) × 会計実績(KAIKEI_ACTUAL) を突合。
 * 会計実績は粒度(月/四半期/半期)を年度累計に正規化(lib/kpi normalizeKaikei)。
 */
import {
  getBaseRecords,
  getLarkBaseToken,
  createBaseRecord,
  updateBaseRecord,
  batchCreateBaseRecords,
  batchUpdateBaseRecords,
} from "@/lib/lark-client";
import { midtermTrajectory } from "@/lib/kpi";
import {
  getLarkTables,
  COMPANY_KPI_FIELDS as CK,
  KAIKEI_ACTUAL_FIELDS as KA,
  KEIEI_MIDTERM_PLAN_HEADER_FIELDS as MH,
  KEIEI_MIDTERM_PLAN_FIELDS as MD,
} from "@/lib/lark-tables";
import {
  normalizeKaikei,
  fiscalMonthOf,
  attainmentRate,
  judgeByRate,
  proratedTarget,
  type Judgment,
  type Granularity,
  type KaikeiRow,
} from "@/lib/kpi";
import { getPeriods } from "@/services/seisan-kpi.service";
import { writeKpiAudit, writeKpiAuditBatch, type KpiAuditEntry } from "@/lib/kpi-audit";

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

/** ストック科目(時点の数)。合算せず直近期の値を採用する。フロー科目(売上等)は累計合算。 */
const STOCK_ACCOUNTS = new Set(["人員数", "総資産"]);
/** 期間ラベル → その期間の終了会計月(8月=1..翌7月=12) */
function endFiscalMonth(granularity: Granularity, span: string): number {
  if (granularity === "四半期") return ({ Q1: 3, Q2: 6, Q3: 9, Q4: 12 } as Record<string, number>)[span] ?? 12;
  if (granularity === "半期") return span === "下期" ? 12 : 6;
  return fiscalMonthOf(span); // 月(YYYY-MM)
}
/** ストック科目: 直近期(終了会計月が最も後)の値を返す(合算しない) */
function latestKaikeiValue(rows: KaikeiRow[]): number {
  let bestMonth = -1;
  let val = 0;
  for (const r of rows) {
    const m = endFiscalMonth(r.granularity, r.period);
    if (m >= bestMonth) { bestMonth = m; val = r.value; }
  }
  return val;
}

/** KAIKEI_ACTUAL を勘定科目ごとに年度累計へ正規化(百万円)。ストック科目は直近値。 */
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
  for (const [account, rows] of byAccount)
    cum.set(account, STOCK_ACCOUNTS.has(account) ? latestKaikeiValue(rows) : normalizeKaikei(rows));
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
  currentPeriod: number;
  selectablePeriods: number[];
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
  const cur = periods.find((p) => p.isCurrent) ?? periods[0];
  const currentPeriod = cur?.period ?? period;
  // 過去期は満了(12ヶ月)で年換算(期マスタに値があれば優先)。当期は走行中の経過月数。
  const masterElapsed = periods.find((p) => p.period === period)?.elapsedMonths ?? 0;
  const elapsed = period < currentPeriod ? (masterElapsed || 12) : masterElapsed;
  // 選択可能な期(開始済み=当期以下)
  const selectablePeriods = periods.map((p) => p.period).filter((p) => p <= currentPeriod).sort((a, b) => a - b);
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

  // 率・その他(目標 × 実績を突合)。実績は会計データから算出:
  //   限界利益 = 売上高 − 変動費 / 固定費 = 限界利益 − 営業利益
  //   製造原価率 = 製造原価 ÷ 売上高 / 外注発注率 = 外注費 ÷ 製造原価 / 人員 = 人員数
  const opIncomeA = actOku("営業利益");
  const variableA = actOku("変動費");
  const outsourcingA = actOku("外注費");
  const marginalA = salesA != null && variableA != null ? salesA - variableA : null;
  const fixedA = marginalA != null && opIncomeA != null ? marginalA - opIncomeA : null;
  const mfgRateA = salesA != null && salesA !== 0 && costA != null ? (costA / salesA) * 100 : null;
  const outsourceRateA = costA != null && costA !== 0 && outsourcingA != null ? (outsourcingA / costA) * 100 : null;
  const headcountA = kaikei.has("人員数") ? kaikei.get("人員数")! : null;

  // 判定: 金額(累計)は PL と同じ達成率、率(目標との直接比)は直近月値型で評価
  const judgeAmt = (actualOku: number | null, targetOku: number, dir: Dir): Judgment | null =>
    actualOku == null || elapsed <= 0 || !targetOku
      ? null
      : judgeByRate(attainmentRate({ aggType: "累計", direction: dir === "高" ? "高い方が良い" : "少ない方が良い", annualTarget: targetOku }, actualOku, elapsed));
  const judgeRate = (actualPct: number | null, targetPct: number, dir: Dir): Judgment | null =>
    actualPct == null || !targetPct
      ? null
      : judgeByRate(attainmentRate({ aggType: "直近月値", direction: dir === "高" ? "高い方が良い" : "少ない方が良い", annualTarget: targetPct }, actualPct, elapsed));

  const marginalT = senToOku(targets.marginal_profit ?? 0);
  const fixedT = senToOku(targets.fixed_cost ?? 0);
  const mfgRateT = targets.manufacturing_cost_rate ?? 0;
  const outsourceRateT = targets.outsourcing_rate ?? 0;
  const headcountT = targets.headcount_plan ?? 0;
  const oku1 = (v: number | null) => (v == null ? "―" : `${v.toFixed(1)}億`);
  const pct1 = (v: number | null) => (v == null ? "―" : `${v.toFixed(1)}%`);
  const otherRows = [
    { name: "限界利益", target: oku1(marginalT), actual: oku1(marginalA), judgment: judgeAmt(marginalA, marginalT, "高") },
    { name: "固定費", target: oku1(fixedT), actual: oku1(fixedA), judgment: judgeAmt(fixedA, fixedT, "少") },
    { name: "製造原価率", target: pct1(mfgRateT), actual: pct1(mfgRateA), judgment: judgeRate(mfgRateA, mfgRateT, "少") },
    { name: "外注発注率", target: pct1(outsourceRateT), actual: pct1(outsourceRateA), judgment: judgeRate(outsourceRateA, outsourceRateT, "少") },
    { name: "人員計画", target: headcountT ? `${headcountT} 人` : "―", actual: headcountA != null ? `${Math.round(headcountA)} 人` : "―", judgment: null },
  ];

  void proratedTarget; // (将来: 月割合算表示で使用)
  return { period, currentPeriod, selectablePeriods, elapsedMonths: elapsed, hasActuals, plRows, otherRows };
}

/* =========================================================================
 * #46 会計データ入力
 * ========================================================================= */

/** 会計勘定科目(KAIKEI_ACTUAL 単一選択と一致) */
export const KAIKEI_ACCOUNTS: { account: string; unit: string }[] = [
  { account: "売上高", unit: "百万円" },
  { account: "製造原価", unit: "百万円" },
  { account: "販管費", unit: "百万円" },
  { account: "営業利益", unit: "百万円" },
  { account: "経常利益", unit: "百万円" },
  { account: "総資産", unit: "百万円" },
  { account: "材料金額", unit: "百万円" },
  { account: "外注費", unit: "百万円" },
  { account: "変動費", unit: "百万円" },
  { account: "人員数", unit: "人" },
  { account: "人件費", unit: "百万円" },
  { account: "賃借料", unit: "百万円" },
  { account: "租税公課", unit: "百万円" },
  { account: "純金融費用", unit: "百万円" },
  { account: "減価償却費", unit: "百万円" },
];

export interface KaikeiAccountInput {
  account: string;
  unit: string;
  granularity: Granularity;
  /** 期間ラベル → 値(文字列) */
  values: Record<string, string>;
}

/** 会計入力用: 既存の KAIKEI_ACTUAL を科目×期間で整理 */
export async function getKaikeiInput(period: number): Promise<{
  period: number;
  startYear: number;
  accounts: KaikeiAccountInput[];
}> {
  const t = getLarkTables();
  const periods = await getPeriods();
  const startYear = Number((periods.find((p) => p.period === period)?.startDate ?? "").slice(0, 4)) || 2025;

  const r = await getBaseRecords(t.KAIKEI_ACTUAL, {
    baseToken: base(),
    filter: `CurrentValue.[${KA.period}] = ${period}`,
    pageSize: 500,
  });
  const items = (r.data?.items ?? []) as any[];
  // account → { granularity, values }
  const map = new Map<string, { granularity: Granularity; values: Record<string, string> }>();
  for (const it of items) {
    const account = asText(it.fields[KA.account]);
    if (!account) continue;
    const gran = (asText(it.fields[KA.granularity]) || "月") as Granularity;
    const span = asText(it.fields[KA.span]);
    if (!map.has(account)) map.set(account, { granularity: gran, values: {} });
    const e = map.get(account)!;
    e.granularity = gran;
    e.values[span] = String(asNum(it.fields[KA.value]));
  }

  const accounts: KaikeiAccountInput[] = KAIKEI_ACCOUNTS.map((a) => ({
    account: a.account,
    unit: a.unit,
    granularity: map.get(a.account)?.granularity ?? "月",
    values: map.get(a.account)?.values ?? {},
  }));
  return { period, startYear, accounts };
}

/** 期間ラベル/粒度 → 会計月序(範囲開始月) */
function spanToFiscalMonth(granularity: Granularity, span: string): number {
  if (granularity === "月") {
    const m = Number(span.split("-")[1]);
    return ((m - 8 + 12) % 12) + 1;
  }
  if (granularity === "四半期") return ({ Q1: 1, Q2: 4, Q3: 7, Q4: 10 } as Record<string, number>)[span] ?? 1;
  return span === "下期" ? 7 : 1; // 半期
}

/** 会計データ入力状況(科目ごとに、どの粒度でどこまで確定済みか) */
export interface KaikeiInputStatus { account: string; unit: string; granularity: Granularity; label: string; ok: boolean }
const FISCAL_MONTH_LABELS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
export async function getKaikeiInputStatus(period: number): Promise<KaikeiInputStatus[]> {
  const [{ accounts }, periods] = await Promise.all([getKaikeiInput(period), getPeriods()]);
  const cur = periods.find((p) => p.isCurrent) ?? periods[0];
  const currentPeriod = cur?.period ?? period;
  const masterElapsed = periods.find((p) => p.period === period)?.elapsedMonths ?? 0;
  const elapsed = period < currentPeriod ? (masterElapsed || 12) : masterElapsed;

  return accounts.map((a) => {
    const filled = Object.entries(a.values)
      .filter(([, v]) => v != null && String(v).trim() !== "" && !Number.isNaN(Number(v)))
      .map(([k]) => k);
    if (filled.length === 0) return { account: a.account, unit: a.unit, granularity: a.granularity, label: "未入力", ok: false };
    const len = a.granularity === "月" ? 1 : a.granularity === "四半期" ? 3 : 6;
    const endOf = (span: string) => spanToFiscalMonth(a.granularity, span) + len - 1; // 会計月(1=8月..12=7月)での終了
    const maxEnd = Math.min(12, Math.max(...filled.map(endOf)));
    let label: string;
    if (a.granularity === "月") {
      label = `〜${FISCAL_MONTH_LABELS[maxEnd - 1]} 確定`;
    } else if (a.granularity === "四半期") {
      const lastQ = ["Q1", "Q2", "Q3", "Q4"].filter((q) => filled.includes(q)).pop();
      label = lastQ ? `${lastQ}まで確定` : `〜${FISCAL_MONTH_LABELS[maxEnd - 1]} 確定`;
    } else {
      const up = filled.includes("上期"), down = filled.includes("下期");
      label = up && down ? "上期・下期 確定" : up ? "上期のみ・下期待ち" : "下期のみ";
    }
    return { account: a.account, unit: a.unit, granularity: a.granularity, label, ok: maxEnd >= elapsed };
  });
}

/** 会計データの upsert(科目×期間で一意) */
export async function upsertKaikeiActual(
  items: { period: number; account: string; granularity: Granularity; span: string; value: number | null; inputBy?: string }[]
): Promise<{ saved: number }> {
  if (items.length === 0) return { saved: 0 };
  const t = getLarkTables();
  const bt = base();

  // 同一 actual_id の重複は最後の入力を採用(同一ペイロード内での二重作成を防ぐ)
  const byId = new Map<string, (typeof items)[number]>();
  for (const it of items) byId.set(`${it.period}-${it.account}-${it.span.replace(/-/g, "")}`, it);

  // 対象期の既存レコードを一括取得し actual_id → record_id/fields を引けるようにする
  const periods = [...new Set([...byId.values()].map((it) => it.period))];
  const filter =
    periods.length === 1
      ? `CurrentValue.[${KA.period}] = ${periods[0]}`
      : `OR(${periods.map((p) => `CurrentValue.[${KA.period}] = ${p}`).join(", ")})`;
  const found = await getBaseRecords(t.KAIKEI_ACTUAL, { baseToken: bt, filter, pageSize: 500 });
  const existing = new Map<string, { recordId: string; fields: Record<string, any> }>();
  for (const rec of (found.data?.items ?? []) as any[]) {
    const id = asText(rec.fields[KA.actual_id]);
    if (id) existing.set(id, { recordId: rec.record_id, fields: rec.fields });
  }

  const toCreate: Record<string, any>[] = [];
  const toUpdate: { record_id: string; fields: Record<string, any> }[] = [];
  const audits: KpiAuditEntry[] = [];
  for (const [actualId, it] of byId) {
    const fields: Record<string, any> = {
      [KA.actual_id]: actualId,
      [KA.period]: it.period,
      [KA.granularity]: it.granularity,
      [KA.span]: it.span,
      [KA.fiscal_month]: spanToFiscalMonth(it.granularity, it.span),
      [KA.account]: it.account,
      [KA.value]: it.value,
      [KA.input_by]: it.inputBy ?? "",
      [KA.input_at]: Date.now(),
    };
    const exist = existing.get(actualId);
    if (exist) {
      toUpdate.push({ record_id: exist.recordId, fields });
      audits.push({ table: "KAIKEI_ACTUAL", recordId: actualId, operation: "更新", before: exist.fields, after: fields, operator: it.inputBy ?? "" });
    } else {
      toCreate.push(fields);
      audits.push({ table: "KAIKEI_ACTUAL", recordId: actualId, operation: "作成", after: fields, operator: it.inputBy ?? "" });
    }
  }

  // 逐次ループを避け batch_create/batch_update に集約(Amplify 28秒タイムアウト対策)
  if (toCreate.length) await batchCreateBaseRecords(t.KAIKEI_ACTUAL, toCreate, { baseToken: bt });
  if (toUpdate.length) await batchUpdateBaseRecords(t.KAIKEI_ACTUAL, toUpdate, { baseToken: bt });
  await writeKpiAuditBatch(audits);

  return { saved: byId.size };
}

/* =========================================================================
 * #44 中期経営計画ダッシュボード
 * ========================================================================= */

export interface MidtermKgi {
  indicator: string;
  unit: string;
  /** 期→年度目標(線形補間値)。プラン開始前(履歴期)は target=null */
  trajectory: { period: number; target: number | null }[];
  finalTarget: number;
  finalPeriod: number;
  /** 各期の年換算実績(開始期〜基準期。会計データから・未入力は null) */
  actuals: { period: number; actual: number | null }[];
  /** 基準期の年換算実績(会計データから・未入力は null) */
  currentActual: number | null;
  /** 到達度 = 基準期実績 ÷ 最終目標 */
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

/** 会計累計マップ(百万円)+経過月 から KGI の年換算実績を算出(純粋関数) */
function kgiActualFromKaikei(indicator: string, kaikei: Map<string, number>, elapsed: number): number | null {
  if (elapsed <= 0) return null;
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

/** KGIの現在実績(会計データから年換算) */
async function currentKgiActual(indicator: string, period: number, elapsed: number): Promise<number | null> {
  if (elapsed <= 0) return null;
  return kgiActualFromKaikei(indicator, await getKaikeiCumByAccount(period), elapsed);
}

/** 中計ダッシュボード構築(現行中計 or 指定planId / 基準期を指定可) */
export async function buildMidtermDashboard(planId?: string, basePeriodArg?: number): Promise<{
  header: MidtermHeader | null;
  currentPeriod: number;
  basePeriod: number;
  elapsedMonths: number;
  selectablePeriods: number[];
  kgis: MidtermKgi[];
  companyKpi: CompanyKpiRow[];
  inputStatus: KaikeiInputStatus[];
  registered: boolean;
}> {
  const [headers, periods] = await Promise.all([getMidtermHeaders(), getPeriods()]);
  const cur = periods.find((p) => p.isCurrent) ?? periods[0];
  const currentPeriod = cur?.period ?? 50;
  const periodMap = new Map(periods.map((p) => [p.period, p]));

  const header = planId
    ? headers.find((h) => h.planId === planId) ?? null
    : headers.find((h) => h.status === "現行") ?? headers[0] ?? null;

  if (!header) {
    return { header: null, currentPeriod, basePeriod: currentPeriod, elapsedMonths: cur?.elapsedMonths ?? 0, selectablePeriods: [], kgis: [], companyKpi: [], inputStatus: [], registered: false };
  }

  const seq = (a: number, b: number) => { const r: number[] = []; for (let p = a; p <= b; p++) r.push(p); return r; };
  // 基準期: 指定があれば採用、なければ当期。終了/当期でクランプ。
  const maxSel = Math.min(header.endPeriod, currentPeriod);
  let basePeriod = basePeriodArg ?? currentPeriod;
  if (basePeriod > maxSel) basePeriod = maxSel;
  // 経過月数: 当期は走行中の月数、過去期は満了(12)を既定とする(期マスタに値があれば優先)
  const elapsedFor = (p: number) => (p === currentPeriod ? (cur?.elapsedMonths ?? 0) : (periodMap.get(p)?.elapsedMonths || 12));

  // プラン開始前でも会計データのある期は履歴として表示対象にする(進捗グラフを過去まで伸ばす)
  const prePlan = periods.map((p) => p.period).filter((p) => p < header.startPeriod && p <= currentPeriod).sort((a, b) => a - b);
  // 表示候補(履歴+プラン期間)の会計データを一括取得し、データのある履歴期を判定
  const kaikeiByPeriod = new Map<number, Map<string, number>>();
  await Promise.all([...new Set([...prePlan, ...seq(header.startPeriod, maxSel)])].map(async (p) => { kaikeiByPeriod.set(p, await getKaikeiCumByAccount(p)); }));
  const prePlanWithData = prePlan.filter((p) => (kaikeiByPeriod.get(p)?.size ?? 0) > 0);
  const historyStart = prePlanWithData.length ? prePlanWithData[0] : header.startPeriod;

  // 基準期は履歴開始以上にクランプ(プラン開始前の履歴期も選択可能にする)
  if (basePeriod < historyStart) basePeriod = historyStart;
  const baseElapsed = elapsedFor(basePeriod);

  // 選択可能な期(履歴開始〜min(終了,当期))
  const selectablePeriods: number[] = seq(historyStart, maxSel);

  const details = await getMidtermDetails(header.planId);
  // 指標ごとに集約
  const byIndicator = new Map<string, { unit: string; finalTarget: number; finalPeriod: number; points: { period: number; target: number }[] }>();
  for (const d of details) {
    if (!byIndicator.has(d.indicator)) byIndicator.set(d.indicator, { unit: d.unit, finalTarget: d.finalTarget, finalPeriod: header.endPeriod, points: [] });
    const e = byIndicator.get(d.indicator)!;
    e.points.push({ period: d.period, target: d.target });
    if (d.finalTarget) e.finalTarget = d.finalTarget;
  }

  // 実績: 履歴開始〜基準期(プラン開始前の履歴を含む)。会計データは上で一括取得済み。
  const actualPeriods: number[] = seq(historyStart, basePeriod);
  // プラン開始前の期は target=null で前置してX軸(グラフ横軸)を履歴まで延長する
  const historyPrefix = seq(historyStart, header.startPeriod - 1).map((p) => ({ period: p, target: null as number | null }));

  const kgis: MidtermKgi[] = [];
  for (const [indicator, e] of byIndicator) {
    e.points.sort((a, b) => a.period - b.period);
    const actuals = actualPeriods.map((p) => ({
      period: p,
      actual: kgiActualFromKaikei(indicator, kaikeiByPeriod.get(p) ?? new Map(), elapsedFor(p)),
    }));
    const currentActual = actuals.find((a) => a.period === basePeriod)?.actual ?? null;
    const finalTarget = e.finalTarget || (e.points.length ? e.points[e.points.length - 1].target ?? 0 : 0);
    kgis.push({
      indicator,
      unit: e.unit,
      trajectory: [...historyPrefix, ...e.points],
      actuals,
      finalTarget,
      finalPeriod: e.finalPeriod,
      currentActual,
      attainment: currentActual != null && finalTarget ? currentActual / finalTarget : null,
    });
  }

  // 全社KPI(年度計画vs実績累計)と会計入力状況も基準期で並列取得
  const [companyKpi, inputStatus] = await Promise.all([
    buildCompanyKpi(basePeriod).then((r) => r.plRows).catch(() => [] as CompanyKpiRow[]),
    getKaikeiInputStatus(basePeriod).catch(() => [] as KaikeiInputStatus[]),
  ]);

  return { header, currentPeriod, basePeriod, elapsedMonths: baseElapsed, selectablePeriods, kgis, companyKpi, inputStatus, registered: true };
}

/* =========================================================================
 * #47 中計マスタ管理(編集・保存)
 * ========================================================================= */

export interface MidtermKgiEdit {
  indicator: string;
  unit: string;
  /** 期→年度目標 */
  values: { period: number; target: number }[];
  finalTarget: number;
}
export interface MidtermPlanEdit {
  planId: string;
  name: string;
  startPeriod: number;
  endPeriod: number;
  status: string;
  kgis: MidtermKgiEdit[];
}

/** 編集用: ヘッダ + KGI明細(期×目標) */
export async function getMidtermForEdit(planId: string): Promise<MidtermPlanEdit | null> {
  const headers = await getMidtermHeaders();
  const h = headers.find((x) => x.planId === planId);
  if (!h) return null;
  const details = await getMidtermDetails(planId);
  const byInd = new Map<string, MidtermKgiEdit>();
  for (const d of details) {
    if (!byInd.has(d.indicator)) byInd.set(d.indicator, { indicator: d.indicator, unit: d.unit, values: [], finalTarget: d.finalTarget });
    const e = byInd.get(d.indicator)!;
    e.values.push({ period: d.period, target: d.target });
    if (d.finalTarget) e.finalTarget = d.finalTarget;
  }
  for (const e of byInd.values()) e.values.sort((a, b) => a.period - b.period);
  return { planId: h.planId, name: h.name, startPeriod: h.startPeriod, endPeriod: h.endPeriod, status: h.status, kgis: [...byInd.values()] };
}

/** 線形補間で期×目標を生成(起点→最終)。overrides で個別上書き */
export function generateTrajectory(
  startPeriod: number,
  endPeriod: number,
  startValue: number,
  finalTarget: number,
  overrides?: Record<number, number>
): { period: number; target: number }[] {
  const traj = midtermTrajectory(startPeriod, startValue, endPeriod, finalTarget);
  return Object.entries(traj).map(([p, v]) => {
    const period = Number(p);
    const ov = overrides?.[period];
    return { period, target: ov != null ? ov : Math.round(v * 100) / 100 };
  });
}

/** 中計の保存(ヘッダ + 明細を upsert) */
export async function upsertMidtermPlan(input: MidtermPlanEdit, operator = ""): Promise<{ planId: string }> {
  const t = getLarkTables();
  const bt = base();

  // --- ヘッダ ---
  const headerFields: Record<string, any> = {
    [MH.plan_id]: input.planId,
    [MH.name]: input.name,
    [MH.start_period]: input.startPeriod,
    [MH.end_period]: input.endPeriod,
    [MH.status]: input.status,
    [MH.kgi_set]: input.kgis.map((k) => k.indicator),
    [MH.interpolation]: "線形補間",
  };
  const foundH = await getBaseRecords(t.KEIEI_MIDTERM_PLAN_HEADER, {
    baseToken: bt,
    filter: `CurrentValue.[${MH.plan_id}] = "${input.planId}"`,
    pageSize: 1,
  });
  const existH = (foundH.data?.items ?? [])[0] as any;
  if (existH) {
    await updateBaseRecord(t.KEIEI_MIDTERM_PLAN_HEADER, existH.record_id, headerFields, { baseToken: bt });
    await writeKpiAudit({ table: "KEIEI_MIDTERM_PLAN_HEADER", recordId: input.planId, operation: "更新", before: existH.fields, after: headerFields, operator });
  } else {
    await createBaseRecord(t.KEIEI_MIDTERM_PLAN_HEADER, headerFields, { baseToken: bt });
    await writeKpiAudit({ table: "KEIEI_MIDTERM_PLAN_HEADER", recordId: input.planId, operation: "作成", after: headerFields, operator });
  }

  // --- 明細(指標×期) ---
  // 既存明細を中計コードで一括取得し、明細コード→record_id の対応表を作る。
  // (旧実装は明細1件ごとに getBaseRecords+create/update を逐次実行しており、
  //  件数に比例して時間が伸び 28秒の関数タイムアウトに達していた #midterm-save-timeout)
  const existingDetails = await getBaseRecords(t.KEIEI_MIDTERM_PLAN, {
    baseToken: bt,
    filter: `CurrentValue.[${MD.plan_id}] = "${input.planId}"`,
    pageSize: 500,
  });
  const recordIdByDetailId = new Map<string, string>();
  for (const it of (existingDetails.data?.items ?? []) as any[]) {
    const did = asText(it.fields?.[MD.detail_id]);
    if (did) recordIdByDetailId.set(did, it.record_id);
  }

  const toCreate: Record<string, any>[] = [];
  const toUpdate: { record_id: string; fields: Record<string, any> }[] = [];
  for (const kgi of input.kgis) {
    for (const v of kgi.values) {
      const detailId = `${input.planId}-${kgi.indicator}-${v.period}`;
      const fields: Record<string, any> = {
        [MD.detail_id]: detailId,
        [MD.plan_id]: input.planId,
        [MD.indicator]: kgi.indicator,
        [MD.unit]: kgi.unit,
        [MD.period]: v.period,
        [MD.annual_target]: v.target,
        [MD.final_target]: kgi.finalTarget,
        [MD.method]: "線形補間",
      };
      const rid = recordIdByDetailId.get(detailId);
      if (rid) toUpdate.push({ record_id: rid, fields });
      else toCreate.push(fields);
    }
  }
  // バッチ書込(逐次N回 → 数回のAPI呼び出しに集約)
  if (toCreate.length) await batchCreateBaseRecords(t.KEIEI_MIDTERM_PLAN, toCreate, { baseToken: bt });
  if (toUpdate.length) await batchUpdateBaseRecords(t.KEIEI_MIDTERM_PLAN, toUpdate, { baseToken: bt });

  return { planId: input.planId };
}
