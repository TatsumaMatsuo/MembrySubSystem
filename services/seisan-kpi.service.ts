/**
 * 生産本部KPI サービス層(Lark Base アクセス + lib/kpi 算出)
 * 設計: docs/kpi-system/02_data-model.md / 04_api-design.md
 */
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  getLarkBaseToken,
} from "@/lib/lark-client";
import {
  getLarkTables,
  SEISAN_KPI_MASTER_FIELDS as MF,
  SEISAN_KPI_PERIOD_FIELDS as PF,
  SEISAN_KPI_ACTUAL_FIELDS as AF,
} from "@/lib/lark-tables";
import {
  aggregate,
  attainmentRate,
  judge,
  type AggType,
  type Direction,
  type Judgment,
  type MonthlyActual,
} from "@/lib/kpi";

// ---- Lark フィールド値の抽出ヘルパ(テキスト/数値の揺れを吸収) ----
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => (x?.text ?? x)).join("");
  if (typeof v === "object" && (v as any).text != null) return String((v as any).text);
  return String(v);
}
function asNum(v: unknown): number | null {
  const t = asText(v).trim();
  if (t === "") return v == null ? null : typeof v === "number" ? v : null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function asBool(v: unknown): boolean {
  return v === true || v === 1 || asText(v) === "true";
}

export interface PeriodInfo {
  period: number;
  startDate: string;
  endDate: string;
  elapsedMonths: number;
  isCurrent: boolean;
}

export interface KpiMasterRow {
  kpiId: string;
  level: string;
  departmentDiv: string;
  department: string;
  category: string;
  kpiName: string;
  unit: string;
  aggType: AggType;
  direction: Direction;
  annualTarget: number;
  monthlyTarget: number;
  sortOrder: number;
}

export interface KpiInputRow extends KpiMasterRow {
  /** 12ヶ月の実績(会計月序 1..12) + recordId */
  months: { fiscalMonth: number; value: number | null; recordId?: string }[];
  current: number;
  attainment: number;
  judgment: Judgment;
}

const base = () => getLarkBaseToken();

/** 全件取得(ページネーション)。Lark の1ページ上限500件を跨いで全て取得 */
async function getAllRecords(tableId: string, filter?: string): Promise<any[]> {
  const items: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const r: any = await getBaseRecords(tableId, {
      baseToken: base(),
      filter,
      pageSize: 500,
      pageToken,
    });
    items.push(...(r.data?.items ?? []));
    pageToken = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

/** 期マスタ取得 */
export async function getPeriods(): Promise<PeriodInfo[]> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.SEISAN_KPI_PERIOD, { baseToken: base(), pageSize: 100 });
  const items = (r.data?.items ?? []) as any[];
  return items
    .map((it) => ({
      period: asNum(it.fields[PF.period]) ?? 0,
      startDate: asText(it.fields[PF.start_date]),
      endDate: asText(it.fields[PF.end_date]),
      elapsedMonths: asNum(it.fields[PF.elapsed_months]) ?? 0,
      isCurrent: asBool(it.fields[PF.is_current]),
    }))
    .sort((a, b) => b.period - a.period);
}

export async function getCurrentPeriod(): Promise<PeriodInfo | null> {
  const ps = await getPeriods();
  return ps.find((p) => p.isCurrent) ?? ps[0] ?? null;
}

/** KPIマスタ取得(期で絞込) */
export async function getKpiMaster(period: number): Promise<KpiMasterRow[]> {
  const t = getLarkTables();
  const r = await getBaseRecords(t.SEISAN_KPI_MASTER, {
    baseToken: base(),
    filter: `CurrentValue.[${MF.period}] = ${period}`,
    pageSize: 500,
  });
  const items = (r.data?.items ?? []) as any[];
  return items
    .map((it) => {
      const f = it.fields;
      return {
        kpiId: asText(f[MF.kpi_id]),
        level: asText(f[MF.level]),
        departmentDiv: asText(f[MF.department_div]),
        department: asText(f[MF.department]),
        category: asText(f[MF.category]),
        kpiName: asText(f[MF.kpi_name]),
        unit: asText(f[MF.unit]),
        aggType: (asText(f[MF.agg_type]) || "累計") as AggType,
        direction: (asText(f[MF.direction]) || "少ない方が良い") as Direction,
        annualTarget: asNum(f[MF.annual_target]) ?? 0,
        monthlyTarget: asNum(f[MF.monthly_target]) ?? 0,
        sortOrder: asNum(f[MF.sort_order]) ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 期内の月次実績を全取得し KPI_ID → 月配列 に整理 */
async function getActualsByKpi(
  period: number
): Promise<Map<string, Map<number, { value: number | null; recordId: string }>>> {
  const t = getLarkTables();
  const items = await getAllRecords(t.SEISAN_KPI_ACTUAL, `CurrentValue.[${AF.period}] = ${period}`);
  const map = new Map<string, Map<number, { value: number | null; recordId: string }>>();
  for (const it of items) {
    const kpiId = asText(it.fields[AF.kpi_id]);
    const fm = asNum(it.fields[AF.fiscal_month]) ?? 0;
    if (!kpiId || fm < 1) continue;
    if (!map.has(kpiId)) map.set(kpiId, new Map());
    map.get(kpiId)!.set(fm, { value: asNum(it.fields[AF.value]), recordId: it.record_id });
  }
  return map;
}

/** 入力画面用: KPIマスタ + 月次実績 + 算出(現在値/達成率/判定) */
export async function getInputRows(period: number, department?: string): Promise<{
  period: number;
  elapsedMonths: number;
  rows: KpiInputRow[];
}> {
  const [periods, master, actuals] = await Promise.all([
    getPeriods(),
    getKpiMaster(period),
    getActualsByKpi(period),
  ]);
  const pinfo = periods.find((p) => p.period === period);
  const elapsed = pinfo?.elapsedMonths ?? 0;

  const filtered = department
    ? master.filter((m) => m.department === department)
    : master;

  const rows: KpiInputRow[] = filtered
    .filter((m) => m.aggType !== "基礎データ算出") // 算出KPIは会計データ画面で扱う
    .map((m) => {
      const am = actuals.get(m.kpiId) ?? new Map();
      const months = Array.from({ length: 12 }, (_, i) => {
        const fm = i + 1;
        const rec = am.get(fm);
        return { fiscalMonth: fm, value: rec?.value ?? null, recordId: rec?.recordId };
      });
      const ma: MonthlyActual[] = months.map((x) => ({ fiscalMonth: x.fiscalMonth, value: x.value }));
      const current = aggregate(m.aggType, ma, elapsed);
      const attainment = attainmentRate(m, current, elapsed);
      const judgment = judge(
        { aggType: m.aggType, direction: m.direction, annualTarget: m.annualTarget },
        current,
        elapsed
      );
      return { ...m, months, current, attainment, judgment };
    });

  return { period, elapsedMonths: elapsed, rows };
}

/** 部署一覧(マスタから・集約部署除く) */
export async function getDepartments(period: number): Promise<string[]> {
  const master = await getKpiMaster(period);
  return [...new Set(master.map((m) => m.department))];
}

/* =========================================================================
 * #48 生産本部ダッシュボード(集約)
 * ========================================================================= */

export interface DashboardSignal {
  kpiId: string;
  name: string;
  unit: string;
  current: number;
  target: number;
  judgment: Judgment;
}
export interface DeptStarRank {
  department: string;
  stars: number;
}

/** Lv2経営KPI信号盤 + 要対応件数 + 部署別★ランキング を集約 */
export async function getDashboard(period: number): Promise<{
  period: number;
  elapsedMonths: number;
  signals: DashboardSignal[];
  alert: { red: number; amber: number };
  manufacturingRank: DeptStarRank[];
  managementRank: DeptStarRank[];
}> {
  const [periods, master, actuals] = await Promise.all([
    getPeriods(),
    getKpiMaster(period),
    getActualsByKpi(period),
  ]);
  const elapsed = periods.find((p) => p.period === period)?.elapsedMonths ?? 0;

  const monthsOf = (kpiId: string): MonthlyActual[] => {
    const am = actuals.get(kpiId) ?? new Map();
    return Array.from({ length: 12 }, (_, i) => ({ fiscalMonth: i + 1, value: am.get(i + 1)?.value ?? null }));
  };
  const calc = (m: KpiMasterRow) => {
    if (m.aggType === "基礎データ算出") return null; // 会計データ依存(別途)
    const current = aggregate(m.aggType, monthsOf(m.kpiId), elapsed);
    const judgment = judge({ aggType: m.aggType, direction: m.direction, annualTarget: m.annualTarget }, current, elapsed);
    return { current, judgment };
  };

  // 信号盤: Lv2(生産本部全体)
  const lv2 = master.filter((m) => m.level === "Lv2" && m.aggType !== "基礎データ算出");
  const signals: DashboardSignal[] = lv2.map((m) => {
    const c = calc(m)!;
    return { kpiId: m.kpiId, name: m.kpiName, unit: m.unit, current: Math.round(c.current * 100) / 100, target: m.annualTarget, judgment: c.judgment };
  });

  // 要対応: 全KPI(算出除く)の赤/黄件数
  let red = 0, amber = 0;
  for (const m of master) {
    const c = calc(m);
    if (!c) continue;
    if (c.judgment === "赤") red++;
    else if (c.judgment === "黄") amber++;
  }

  // 部署別★(Lv4): 各課のKPI(月次目標あり)で月間達成数を合算
  const deptStars = (dept: string): number => {
    const items = master.filter((m) => m.department === dept && m.aggType !== "基礎データ算出");
    let stars = 0;
    for (const m of items) {
      const months = monthsOf(m.kpiId);
      for (let fm = 1; fm <= elapsed; fm++) {
        const v = months.find((x) => x.fiscalMonth === fm)?.value;
        if (v == null) continue;
        const ok = m.direction === "高い方が良い" ? v >= m.monthlyTarget : v <= m.monthlyTarget;
        if (ok) stars++;
      }
    }
    return stars;
  };
  const MANUF = ["本社鉄工課", "第2工場鉄工課", "北関東鉄工課", "本社縫製課", "北多久縫製課", "北関東縫製課"];
  const MANAGE = ["調達課", "生産管理課", "検査課"];
  const allDepts = new Set(master.map((m) => m.department));
  const rank = (list: string[]): DeptStarRank[] =>
    list.filter((d) => allDepts.has(d)).map((d) => ({ department: d, stars: deptStars(d) })).sort((a, b) => b.stars - a.stars);

  return {
    period,
    elapsedMonths: elapsed,
    signals,
    alert: { red, amber },
    manufacturingRank: rank(MANUF),
    managementRank: rank(MANAGE),
  };
}

/** 会計月序 → 対象年月(YYYY-MM)。期開始年から算出(8月=1) */
function fiscalMonthToYm(startDate: string, fiscalMonth: number): string {
  const startYear = Number(startDate.slice(0, 4)) || new Date().getFullYear();
  // 8月=1..12月=5 は startYear、1月=6..7月=12 は startYear+1
  const monthNum = ((fiscalMonth - 1 + 7) % 12) + 1; // 1→8, 6→1, 12→7
  const year = fiscalMonth <= 5 ? startYear : startYear + 1;
  return `${year}-${String(monthNum).padStart(2, "0")}`;
}

/**
 * 月次実績の upsert(なければ作成・あれば更新)
 */
export async function upsertActual(input: {
  period: number;
  kpiId: string;
  fiscalMonth: number;
  value: number | null;
  inputBy?: string;
}): Promise<{ recordId: string; created: boolean }> {
  const t = getLarkTables();
  const periods = await getPeriods();
  const pinfo = periods.find((p) => p.period === input.period);
  const ym = fiscalMonthToYm(pinfo?.startDate ?? "", input.fiscalMonth);
  const actualId = `${input.period}-${input.kpiId.replace(/-/g, "")}-${ym.replace("-", "")}`;

  // 既存検索(実績コードで一意)
  const found = await getBaseRecords(t.SEISAN_KPI_ACTUAL, {
    baseToken: base(),
    filter: `CurrentValue.[${AF.actual_id}] = "${actualId}"`,
    pageSize: 1,
  });
  const existing = (found.data?.items ?? [])[0] as any;

  const fields: Record<string, any> = {
    [AF.actual_id]: actualId,
    [AF.period]: input.period,
    [AF.kpi_id]: input.kpiId,
    [AF.target_ym]: ym,
    [AF.fiscal_month]: input.fiscalMonth,
    [AF.value]: input.value,
    [AF.input_by]: input.inputBy ?? "",
    [AF.input_at]: Date.now(),
  };

  if (existing) {
    await updateBaseRecord(t.SEISAN_KPI_ACTUAL, existing.record_id, fields, { baseToken: base() });
    return { recordId: existing.record_id, created: false };
  }
  const r: any = await createBaseRecord(t.SEISAN_KPI_ACTUAL, fields, { baseToken: base() });
  return { recordId: r?.data?.record?.record_id ?? "", created: true };
}
