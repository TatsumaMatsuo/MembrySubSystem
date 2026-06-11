/**
 * 生産本部KPI サービス層(Lark Base アクセス + lib/kpi 算出)
 * 設計: docs/kpi-system/02_data-model.md / 04_api-design.md
 */
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  deleteBaseRecord,
  getLarkBaseToken,
} from "@/lib/lark-client";
import {
  getLarkTables,
  SEISAN_KPI_MASTER_FIELDS as MF,
  SEISAN_KPI_PERIOD_FIELDS as PF,
  SEISAN_KPI_ACTUAL_FIELDS as AF,
  SEISAN_KPI_GROUP_FIELDS as GF,
  SEISAN_KPI_GROUP_MEMBER_FIELDS as GMF,
  SEISAN_KPI_MEASURE_FIELDS as XF,
  SEISAN_KPI_PDCA_FIELDS as DF,
  SEISAN_KPI_STAR_ADJ_FIELDS as SF,
  SEISAN_KPI_AUDIT_FIELDS as UF,
} from "@/lib/lark-tables";
import {
  aggregate,
  attainmentRate,
  autoEffect,
  judge,
  monthlyStar,
  yearEndBonus,
  type AggType,
  type Direction,
  type Effect,
  type Judgment,
  type MonthlyActual,
  type StarItem,
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

/* =========================================================================
 * #50 施策管理(PDCA) — グループ単位の重点施策と月次PDCA
 * 設計: docs/kpi-system/02_data-model.md §2.5/2.6 / 04_api-design.md §2.7/2.8
 * ========================================================================= */

export interface GroupInfo {
  groupId: string;
  groupName: string;
  groupType: string;
  sortOrder: number;
  members: string[]; // 所属部署名(M:N。重複所属あり)
}

export interface GroupKpi {
  kpiId: string;
  department: string;
  kpiName: string;
  unit: string;
  current: number;
  target: number;
  judgment: Judgment;
}

export interface PdcaRow {
  recordId: string;
  pdcaId: string;
  fiscalMonth: number;
  targetYm: string;
  plan: string;
  do: string;
  kpiActual: number | null; // 対象KPI実績(当月)。空なら ACTUAL から自動取込
  effectAuto: Effect | null; // システム自動判定(目安)
  effect: Effect | "" ; // 責任者が確定した効果
  effectMemo: string;
  directorComment: string;
  nextAction: string; // 継続/強化/見直し/完了
  writer: string;
}

export interface MeasureRow {
  recordId: string;
  measureId: string;
  no: number;
  measureName: string;
  groupId: string;
  targetKpiId: string;
  targetKpiName: string;
  unit: string;
  status: string; // 下書き/実施中/完了/中止
  startMonth: number | null;
  endMonth: number | null;
  baseValue: number | null;
  goalValue: number | null;
  current: number; // 対象KPIの現在値(自動)
  judgment: Judgment;
  direction: Direction;
  pdca: PdcaRow[];
}

/** グループマスタ + 所属部署(M:N)を取得 */
export async function getGroups(period: number): Promise<GroupInfo[]> {
  const t = getLarkTables();
  const [groupItems, memberItems] = await Promise.all([
    getAllRecords(t.SEISAN_KPI_GROUP, `CurrentValue.[${GF.period}] = ${period}`),
    getAllRecords(t.SEISAN_KPI_GROUP_MEMBER, `CurrentValue.[${GMF.period}] = ${period}`),
  ]);
  const membersByGroup = new Map<string, { dept: string; sort: number }[]>();
  for (const it of memberItems) {
    const gid = asText(it.fields[GMF.group_id]);
    const dept = asText(it.fields[GMF.department]);
    if (!gid || !dept) continue;
    if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
    membersByGroup.get(gid)!.push({ dept, sort: asNum(it.fields[GMF.sort_order]) ?? 0 });
  }
  return groupItems
    .filter((it) => asBool(it.fields[GF.is_active]) || it.fields[GF.is_active] == null)
    .map((it) => {
      const gid = asText(it.fields[GF.group_id]);
      return {
        groupId: gid,
        groupName: asText(it.fields[GF.group_name]),
        groupType: asText(it.fields[GF.group_type]),
        sortOrder: asNum(it.fields[GF.sort_order]) ?? 0,
        members: (membersByGroup.get(gid) ?? [])
          .sort((a, b) => a.sort - b.sort)
          .map((m) => m.dept),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 月配列(1..12)を組み立てる小ヘルパ */
function monthsFromMap(
  am: Map<number, { value: number | null; recordId: string }> | undefined
): MonthlyActual[] {
  return Array.from({ length: 12 }, (_, i) => ({
    fiscalMonth: i + 1,
    value: am?.get(i + 1)?.value ?? null,
  }));
}

/**
 * 施策管理画面の集約データ。
 * グループ一覧 + 選択グループの所属部署/主要KPI/重点施策(PDCA含む)を返す。
 */
export async function getMeasuresScreen(
  period: number,
  groupId?: string
): Promise<{
  period: number;
  elapsedMonths: number;
  groups: GroupInfo[];
  selectedGroupId: string | null;
  members: string[];
  kpis: GroupKpi[];
  measures: MeasureRow[];
}> {
  const t = getLarkTables();
  const [periods, groups, master, actuals] = await Promise.all([
    getPeriods(),
    getGroups(period),
    getKpiMaster(period),
    getActualsByKpi(period),
  ]);
  const elapsed = periods.find((p) => p.period === period)?.elapsedMonths ?? 0;
  const selected = groups.find((g) => g.groupId === groupId) ?? groups[0] ?? null;
  const members = selected?.members ?? [];

  const masterById = new Map(master.map((m) => [m.kpiId, m]));
  const calc = (m: KpiMasterRow) => {
    const months = monthsFromMap(actuals.get(m.kpiId));
    const current = m.aggType === "基礎データ算出" ? 0 : aggregate(m.aggType, months, elapsed);
    const judgment = judge(
      { aggType: m.aggType, direction: m.direction, annualTarget: m.annualTarget },
      current,
      elapsed
    );
    return { current, judgment };
  };

  // 選択グループの主要KPI = 所属部署のKPI(算出KPIは除く)
  const memberSet = new Set(members);
  const kpis: GroupKpi[] = master
    .filter((m) => memberSet.has(m.department) && m.aggType !== "基礎データ算出")
    .map((m) => {
      const c = calc(m);
      return {
        kpiId: m.kpiId,
        department: m.department,
        kpiName: m.kpiName,
        unit: m.unit,
        current: Math.round(c.current * 100) / 100,
        target: m.annualTarget,
        judgment: c.judgment,
      };
    });

  // 選択グループの重点施策 + PDCA
  let measures: MeasureRow[] = [];
  if (selected) {
    const measureItems = await getAllRecords(
      t.SEISAN_KPI_MEASURE,
      `AND(CurrentValue.[${XF.period}] = ${period}, CurrentValue.[${XF.group_id}] = "${selected.groupId}")`
    );
    const measureIds = measureItems.map((it) => asText(it.fields[XF.measure_id]));
    // PDCA は期で一括取得し、施策IDで突合(OR フィルタ制約回避)
    const pdcaItems = measureIds.length
      ? await getAllRecords(t.SEISAN_KPI_PDCA, `CurrentValue.[${DF.period}] = ${period}`)
      : [];
    const pdcaByMeasure = new Map<string, any[]>();
    for (const it of pdcaItems) {
      const mid = asText(it.fields[DF.measure_id]);
      if (!mid) continue;
      if (!pdcaByMeasure.has(mid)) pdcaByMeasure.set(mid, []);
      pdcaByMeasure.get(mid)!.push(it);
    }

    measures = measureItems
      .map((it) => {
        const f = it.fields;
        const measureId = asText(f[XF.measure_id]);
        const targetKpiId = asText(f[XF.target_kpi_id]);
        const km = masterById.get(targetKpiId);
        const direction: Direction = km?.direction ?? "少ない方が良い";
        const c = km ? calc(km) : { current: 0, judgment: "黄" as Judgment };
        const baseValue = asNum(f[XF.base_value]);
        const kpiActualMap = actuals.get(targetKpiId);

        const pdca: PdcaRow[] = (pdcaByMeasure.get(measureId) ?? [])
          .map((p) => {
            const pf = p.fields;
            const fm = asNum(pf[DF.fiscal_month]) ?? 0;
            // 対象KPI実績: 入力済みを優先、なければ ACTUAL から自動取込
            const stored = asNum(pf[DF.kpi_actual]);
            const kpiActual = stored ?? kpiActualMap?.get(fm)?.value ?? null;
            // 効果の自動判定(基準値→当月)
            let effectAuto: Effect | null = null;
            if (baseValue != null && kpiActual != null) {
              effectAuto = autoEffect({ direction, baseValue, monthValue: kpiActual });
            }
            return {
              recordId: p.record_id,
              pdcaId: asText(pf[DF.pdca_id]),
              fiscalMonth: fm,
              targetYm: asText(pf[DF.target_ym]),
              plan: asText(pf[DF.plan]),
              do: asText(pf[DF.do]),
              kpiActual,
              effectAuto,
              effect: (asText(pf[DF.effect]) || "") as Effect | "",
              effectMemo: asText(pf[DF.effect_memo]),
              directorComment: asText(pf[DF.director_comment]),
              nextAction: asText(pf[DF.next_action]),
              writer: asText(pf[DF.writer]),
            };
          })
          .sort((a, b) => a.fiscalMonth - b.fiscalMonth);

        return {
          recordId: it.record_id,
          measureId,
          no: asNum(f[XF.no]) ?? 0,
          measureName: asText(f[XF.measure_name]),
          groupId: asText(f[XF.group_id]),
          targetKpiId,
          targetKpiName: km ? km.kpiName : asText(f[XF.target_kpi_id]),
          unit: km?.unit ?? "",
          status: asText(f[XF.status]) || "下書き",
          startMonth: asNum(f[XF.start_month]),
          endMonth: asNum(f[XF.end_month]),
          baseValue,
          goalValue: asNum(f[XF.goal_value]),
          current: Math.round(c.current * 100) / 100,
          judgment: c.judgment,
          direction,
          pdca,
        };
      })
      .sort((a, b) => a.no - b.no);
  }

  return {
    period,
    elapsedMonths: elapsed,
    groups,
    selectedGroupId: selected?.groupId ?? null,
    members,
    kpis,
    measures,
  };
}

/** AUDIT(操作履歴)へ記録。失敗しても本処理は止めない */
async function writeAudit(input: {
  table: string;
  recordId: string;
  operation: "作成" | "更新" | "削除";
  before?: unknown;
  after?: unknown;
  operator: string;
}): Promise<void> {
  try {
    const t = getLarkTables();
    await createBaseRecord(
      t.SEISAN_KPI_AUDIT,
      {
        [UF.history_id]: `${input.table}-${input.recordId}-${Date.now()}`,
        [UF.target_table]: input.table,
        [UF.target_record_id]: input.recordId,
        [UF.operation]: input.operation,
        [UF.before]: input.before == null ? "" : JSON.stringify(input.before),
        [UF.after]: input.after == null ? "" : JSON.stringify(input.after),
        [UF.operator]: input.operator,
        [UF.operated_at]: Date.now(),
      },
      { baseToken: base() }
    );
  } catch (e) {
    console.error("[seisan-kpi] writeAudit failed:", e);
  }
}

/** 施策(ヘッダ)の作成・更新。施策コードで一意 upsert */
export async function upsertMeasure(input: {
  period: number;
  groupId: string;
  measureId?: string; // 既存更新時
  no?: number;
  measureName: string;
  targetKpiId: string;
  status: string;
  startMonth?: number | null;
  endMonth?: number | null;
  baseValue?: number | null;
  goalValue?: number | null;
  operator?: string;
}): Promise<{ recordId: string; measureId: string; created: boolean }> {
  const t = getLarkTables();

  // 新規時の施策コード採番: 50-<グループ>-<連番>
  let measureId = input.measureId;
  let no = input.no ?? 0;
  if (!measureId) {
    const existing = await getAllRecords(
      t.SEISAN_KPI_MEASURE,
      `AND(CurrentValue.[${XF.period}] = ${input.period}, CurrentValue.[${XF.group_id}] = "${input.groupId}")`
    );
    no = input.no ?? existing.length + 1;
    measureId = `${input.period}-${input.groupId}-${no}`;
  }

  const fields: Record<string, any> = {
    [XF.measure_id]: measureId,
    [XF.period]: input.period,
    [XF.group_id]: input.groupId,
    [XF.no]: no,
    [XF.measure_name]: input.measureName,
    [XF.target_kpi_id]: input.targetKpiId,
    [XF.status]: input.status,
    [XF.start_month]: input.startMonth ?? null,
    [XF.end_month]: input.endMonth ?? null,
    [XF.base_value]: input.baseValue ?? null,
    [XF.goal_value]: input.goalValue ?? null,
    [XF.updated_at]: Date.now(),
  };

  const found = await getBaseRecords(t.SEISAN_KPI_MEASURE, {
    baseToken: base(),
    filter: `CurrentValue.[${XF.measure_id}] = "${measureId}"`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;
  const operator = input.operator ?? "";

  if (existingRec) {
    await updateBaseRecord(t.SEISAN_KPI_MEASURE, existingRec.record_id, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_MEASURE", recordId: measureId, operation: "更新", before: existingRec.fields, after: fields, operator });
    return { recordId: existingRec.record_id, measureId, created: false };
  }
  if (!fields[XF.created_by]) fields[XF.created_by] = operator;
  const r: any = await createBaseRecord(t.SEISAN_KPI_MEASURE, fields, { baseToken: base() });
  await writeAudit({ table: "SEISAN_KPI_MEASURE", recordId: measureId, operation: "作成", after: fields, operator });
  return { recordId: r?.data?.record?.record_id ?? "", measureId, created: true };
}

/** 施策の月次PDCAログ upsert(施策ID×対象月で一意) */
export async function upsertPdca(input: {
  period: number;
  measureId: string;
  fiscalMonth: number;
  plan?: string;
  do?: string;
  kpiActual?: number | null;
  effect?: string; // 責任者確定の効果
  effectMemo?: string;
  directorComment?: string;
  nextAction?: string;
  writer?: string;
}): Promise<{ recordId: string; pdcaId: string; created: boolean }> {
  const t = getLarkTables();
  const periods = await getPeriods();
  const pinfo = periods.find((p) => p.period === input.period);
  const ym = fiscalMonthToYm(pinfo?.startDate ?? "", input.fiscalMonth);
  const pdcaId = `${input.measureId}-${ym.replace("-", "")}`;

  const fields: Record<string, any> = {
    [DF.pdca_id]: pdcaId,
    [DF.measure_id]: input.measureId,
    [DF.period]: input.period,
    [DF.target_ym]: ym,
    [DF.fiscal_month]: input.fiscalMonth,
    [DF.updated_at]: Date.now(),
  };
  // 任意項目は指定されたもののみ更新(部分更新)
  if (input.plan !== undefined) fields[DF.plan] = input.plan;
  if (input.do !== undefined) fields[DF.do] = input.do;
  if (input.kpiActual !== undefined) fields[DF.kpi_actual] = input.kpiActual;
  if (input.effect !== undefined) fields[DF.effect] = input.effect;
  if (input.effectMemo !== undefined) fields[DF.effect_memo] = input.effectMemo;
  if (input.directorComment !== undefined) fields[DF.director_comment] = input.directorComment;
  if (input.nextAction !== undefined) fields[DF.next_action] = input.nextAction;
  if (input.writer !== undefined) fields[DF.writer] = input.writer;

  const found = await getBaseRecords(t.SEISAN_KPI_PDCA, {
    baseToken: base(),
    filter: `CurrentValue.[${DF.pdca_id}] = "${pdcaId}"`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;
  const operator = input.writer ?? "";

  if (existingRec) {
    await updateBaseRecord(t.SEISAN_KPI_PDCA, existingRec.record_id, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_PDCA", recordId: pdcaId, operation: "更新", before: existingRec.fields, after: fields, operator });
    return { recordId: existingRec.record_id, pdcaId, created: false };
  }
  const r: any = await createBaseRecord(t.SEISAN_KPI_PDCA, fields, { baseToken: base() });
  await writeAudit({ table: "SEISAN_KPI_PDCA", recordId: pdcaId, operation: "作成", after: fields, operator });
  return { recordId: r?.data?.record?.record_id ?? "", pdcaId, created: true };
}

/* =========================================================================
 * #51 ★達成評価(部署ごと) — Excel 04/05 相当
 * 設計: docs/kpi-system/03_screens-and-features.md ④ / 04_api-design.md §2.6
 *  - 月間目標達成で★1個(部署×項目×月)。lib/kpi/monthlyStar で判定。
 *  - 5S大賞・労災は手入力(STAR_ADJ)。総合計★=自動★+期末ボーナス+手入力調整。
 *  - 製造6課 / 間接3課。間接は経過月内の空欄も達成扱い。
 * ========================================================================= */

/** 製造部6課(★ランキング・グリッド順) */
const STAR_MANUFACTURING = [
  "本社鉄工課", "第2工場鉄工課", "北関東鉄工課", "本社縫製課", "北多久縫製課", "北関東縫製課",
];
/** 間接部門3課 */
const STAR_INDIRECT = ["調達課", "生産管理課", "検査課"];
/** 手入力(STAR_ADJ)の常設行。種別はこの順で表示 */
const STAR_MANUAL_TYPES = ["5S大賞", "労災"];

export interface StarCell {
  fiscalMonth: number;
  value: number | null;
  star: boolean;
  future: boolean; // 経過月数より先(未到来)
}
export interface StarItemRow {
  kpiId: string;
  category: string;
  name: string;
  unit: string;
  monthlyTarget: number;
  direction: Direction;
  cells: StarCell[];
  total: number;
}
export interface ManualStarRow {
  type: string; // 5S大賞 / 労災 / その他
  months: (number | null)[]; // 12要素(8月=index0)。値はその月の★増減合計
  total: number;
}
export interface DeptStars {
  department: string;
  items: StarItemRow[];
  monthlySubtotal: number[]; // 12要素: 各月の自動★合計
  autoTotal: number;
  manualRows: ManualStarRow[];
  yearEndBonus: number;
  grandTotal: number;
}

/** ★対象項目か(安全=労災は手入力行に、補助KPI・基礎データ算出は除外) */
function isStarItem(m: KpiMasterRow): boolean {
  if (m.aggType === "基礎データ算出") return false;
  if (m.category === "安全") return false; // 労働災害は手入力(STAR_ADJ)
  if (m.kpiName.includes("補助KPI")) return false;
  return true;
}

/** 会計月序(1..12, 8月=1)→ index(0..11) */
function ymToFiscalMonth(ym: string): number {
  const mn = Number(ym.slice(5, 7)) || 0;
  return mn >= 8 ? mn - 7 : mn + 5;
}

/** 部署別★達成評価を集約 */
export async function getStars(period: number): Promise<{
  period: number;
  elapsedMonths: number;
  isPeriodClosed: boolean;
  manufacturing: DeptStars[];
  indirect: DeptStars[];
}> {
  const t = getLarkTables();
  const [periods, master, actuals, adjItems] = await Promise.all([
    getPeriods(),
    getKpiMaster(period),
    getActualsByKpi(period),
    getAllRecords(t.SEISAN_KPI_STAR_ADJ, `CurrentValue.[${SF.period}] = ${period}`),
  ]);
  const pinfo = periods.find((p) => p.period === period);
  const elapsed = pinfo?.elapsedMonths ?? 0;
  const isPeriodClosed = elapsed >= 12;

  // STAR_ADJ を 部署→種別→月配列 に整理
  const adjByDept = new Map<string, Map<string, (number | null)[]>>();
  for (const it of adjItems) {
    const dept = asText(it.fields[SF.department]);
    const type = asText(it.fields[SF.type]) || "その他";
    const ym = asText(it.fields[SF.target_ym]);
    const delta = asNum(it.fields[SF.delta]);
    if (!dept || !ym) continue;
    const fm = ymToFiscalMonth(ym);
    if (fm < 1 || fm > 12) continue;
    if (!adjByDept.has(dept)) adjByDept.set(dept, new Map());
    const byType = adjByDept.get(dept)!;
    if (!byType.has(type)) byType.set(type, Array(12).fill(null));
    const arr = byType.get(type)!;
    arr[fm - 1] = (arr[fm - 1] ?? 0) + (delta ?? 0);
  }

  const monthsOf = (kpiId: string): MonthlyActual[] => {
    const am = actuals.get(kpiId);
    return Array.from({ length: 12 }, (_, i) => ({ fiscalMonth: i + 1, value: am?.get(i + 1)?.value ?? null }));
  };

  const buildDept = (department: string, indirectBlankAsAchieved: boolean): DeptStars => {
    const items = master.filter((m) => m.department === department && isStarItem(m));
    const monthlySubtotal = Array(12).fill(0);

    const itemRows: StarItemRow[] = items.map((m) => {
      const months = monthsOf(m.kpiId);
      const cells: StarCell[] = months.map((mo) => {
        const future = mo.fiscalMonth > elapsed;
        const star = !future && monthlyStar(
          { monthlyTarget: m.monthlyTarget, direction: m.direction },
          mo.value,
          indirectBlankAsAchieved
        );
        if (star) monthlySubtotal[mo.fiscalMonth - 1] += 1;
        return { fiscalMonth: mo.fiscalMonth, value: mo.value, star, future };
      });
      return {
        kpiId: m.kpiId, category: m.category, name: m.kpiName, unit: m.unit,
        monthlyTarget: m.monthlyTarget, direction: m.direction,
        cells, total: cells.filter((c) => c.star).length,
      };
    });
    const autoTotal = itemRows.reduce((s, it) => s + it.total, 0);

    // 期末ボーナス(年間目標を期末累計で達成した項目ごと +3)。期末のみ。
    const bonus = isPeriodClosed
      ? yearEndBonus(items.map<StarItem>((m) => ({
          monthlyTarget: m.monthlyTarget,
          direction: m.direction,
          months: monthsOf(m.kpiId),
          annualTarget: m.annualTarget,
        })))
      : 0;

    // 手入力行: 常設種別 + 実データにある追加種別
    const byType = adjByDept.get(department) ?? new Map<string, (number | null)[]>();
    const types = [...STAR_MANUAL_TYPES, ...[...byType.keys()].filter((k) => !STAR_MANUAL_TYPES.includes(k))];
    const manualRows: ManualStarRow[] = types.map((type) => {
      const months = byType.get(type) ?? Array(12).fill(null);
      const total = months.reduce((s: number, v) => s + (v ?? 0), 0);
      return { type, months, total };
    });
    const manualTotal = manualRows.reduce((s, r) => s + r.total, 0);

    return {
      department, items: itemRows, monthlySubtotal, autoTotal,
      manualRows, yearEndBonus: bonus,
      grandTotal: autoTotal + bonus + manualTotal,
    };
  };

  const present = new Set(master.map((m) => m.department));
  const manufacturing = STAR_MANUFACTURING.filter((d) => present.has(d)).map((d) => buildDept(d, false));
  const indirect = STAR_INDIRECT.filter((d) => present.has(d)).map((d) => buildDept(d, true));

  return { period, elapsedMonths: elapsed, isPeriodClosed, manufacturing, indirect };
}

/** 5S大賞・労災 等の手入力★調整 upsert(部署×種別×対象月で一意) */
export async function upsertStarAdj(input: {
  period: number;
  department: string;
  departmentId?: string;
  fiscalMonth: number;
  type: string; // 5S大賞/労災/その他
  delta: number | null;
  reason?: string;
  operator?: string;
}): Promise<{ recordId: string; adjId: string; created: boolean }> {
  const t = getLarkTables();
  const periods = await getPeriods();
  const pinfo = periods.find((p) => p.period === input.period);
  const ym = fiscalMonthToYm(pinfo?.startDate ?? "", input.fiscalMonth);
  const adjId = `${input.period}-${input.department}-${input.type}-${ym.replace("-", "")}`;

  const fields: Record<string, any> = {
    [SF.adj_id]: adjId,
    [SF.period]: input.period,
    [SF.department]: input.department,
    [SF.department_id]: input.departmentId ?? "",
    [SF.target_ym]: ym,
    [SF.type]: input.type,
    [SF.delta]: input.delta,
    [SF.reason]: input.reason ?? "",
    [SF.registered_by]: input.operator ?? "",
  };

  const found = await getBaseRecords(t.SEISAN_KPI_STAR_ADJ, {
    baseToken: base(),
    filter: `CurrentValue.[${SF.adj_id}] = "${adjId}"`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;
  const operator = input.operator ?? "";

  if (existingRec) {
    await updateBaseRecord(t.SEISAN_KPI_STAR_ADJ, existingRec.record_id, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_STAR_ADJ", recordId: adjId, operation: "更新", before: existingRec.fields, after: fields, operator });
    return { recordId: existingRec.record_id, adjId, created: false };
  }
  const r: any = await createBaseRecord(t.SEISAN_KPI_STAR_ADJ, fields, { baseToken: base() });
  await writeAudit({ table: "SEISAN_KPI_STAR_ADJ", recordId: adjId, operation: "作成", after: fields, operator });
  return { recordId: r?.data?.record?.record_id ?? "", adjId, created: true };
}

/* =========================================================================
 * #52 マスタ管理(KPIマスタ / グループマスタ) — 管理者専用
 * 設計: docs/kpi-system/03_screens-and-features.md ⑤ / 02_data-model.md §2.1/2.2
 * ========================================================================= */

export interface KpiMasterFullRow {
  recordId: string;
  kpiId: string;
  period: number;
  level: string;
  departmentDiv: string;
  department: string;
  departmentId: string;
  category: string;
  kpiName: string;
  unit: string;
  aggType: AggType;
  direction: Direction;
  annualTarget: number;
  monthlyTarget: number;
  owner: string;
  dataSource: string;
  inputTiming: string;
  sortOrder: number;
  isActive: boolean;
  notes: string;
}

/** KPIマスタ全項目を取得(管理画面用。recordId 付き) */
export async function getKpiMasterFull(period: number): Promise<KpiMasterFullRow[]> {
  const t = getLarkTables();
  const items = await getAllRecords(t.SEISAN_KPI_MASTER, `CurrentValue.[${MF.period}] = ${period}`);
  return items
    .map((it) => {
      const f = it.fields;
      return {
        recordId: it.record_id,
        kpiId: asText(f[MF.kpi_id]),
        period: asNum(f[MF.period]) ?? period,
        level: asText(f[MF.level]),
        departmentDiv: asText(f[MF.department_div]),
        department: asText(f[MF.department]),
        departmentId: asText(f[MF.department_id]),
        category: asText(f[MF.category]),
        kpiName: asText(f[MF.kpi_name]),
        unit: asText(f[MF.unit]),
        aggType: (asText(f[MF.agg_type]) || "累計") as AggType,
        direction: (asText(f[MF.direction]) || "少ない方が良い") as Direction,
        annualTarget: asNum(f[MF.annual_target]) ?? 0,
        monthlyTarget: asNum(f[MF.monthly_target]) ?? 0,
        owner: asText(f[MF.owner]),
        dataSource: asText(f[MF.data_source]),
        inputTiming: asText(f[MF.input_timing]),
        sortOrder: asNum(f[MF.sort_order]) ?? 0,
        isActive: f[MF.is_active] == null ? true : asBool(f[MF.is_active]),
        notes: asText(f[MF.notes]),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** KPIマスタの作成・更新(KPIコード×期で一意)。全変更AUDIT記録 */
export async function upsertKpiMaster(input: Partial<KpiMasterFullRow> & {
  period: number;
  kpiId: string;
  operator?: string;
}): Promise<{ recordId: string; kpiId: string; created: boolean }> {
  const t = getLarkTables();
  const operator = input.operator ?? "";

  // 既存検索(同一期×KPIコード)
  const found = await getBaseRecords(t.SEISAN_KPI_MASTER, {
    baseToken: base(),
    filter: `AND(CurrentValue.[${MF.period}] = ${input.period}, CurrentValue.[${MF.kpi_id}] = "${input.kpiId}")`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;

  // 部分更新: 指定された項目のみ反映
  const set = (field: string, val: unknown) => { if (val !== undefined) fields[field] = val; };
  const fields: Record<string, any> = {
    [MF.kpi_id]: input.kpiId,
    [MF.period]: input.period,
  };
  set(MF.level, input.level);
  set(MF.department_div, input.departmentDiv);
  set(MF.department, input.department);
  set(MF.department_id, input.departmentId);
  set(MF.category, input.category);
  set(MF.kpi_name, input.kpiName);
  set(MF.unit, input.unit);
  set(MF.agg_type, input.aggType);
  set(MF.direction, input.direction);
  set(MF.annual_target, input.annualTarget);
  set(MF.monthly_target, input.monthlyTarget);
  set(MF.owner, input.owner);
  set(MF.data_source, input.dataSource);
  set(MF.input_timing, input.inputTiming);
  set(MF.sort_order, input.sortOrder);
  set(MF.is_active, input.isActive);
  set(MF.notes, input.notes);

  if (existingRec) {
    await updateBaseRecord(t.SEISAN_KPI_MASTER, existingRec.record_id, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_MASTER", recordId: input.kpiId, operation: "更新", before: existingRec.fields, after: fields, operator });
    return { recordId: existingRec.record_id, kpiId: input.kpiId, created: false };
  }
  const r: any = await createBaseRecord(t.SEISAN_KPI_MASTER, fields, { baseToken: base() });
  await writeAudit({ table: "SEISAN_KPI_MASTER", recordId: input.kpiId, operation: "作成", after: fields, operator });
  return { recordId: r?.data?.record?.record_id ?? "", kpiId: input.kpiId, created: true };
}

export interface GroupMatrixGroup {
  recordId: string;
  groupId: string;
  groupName: string;
  groupType: string;
  sortOrder: number;
  isActive: boolean;
}
export interface GroupMatrix {
  period: number;
  departments: string[];
  groups: GroupMatrixGroup[];
  /** membership[department][groupId] = 所属レコードID(なければ未所属) */
  membership: Record<string, Record<string, string>>;
}

/** グループ管理用: グループ一覧 + 所属マトリクス(行=部署×列=グループ) */
export async function getGroupMatrix(period: number): Promise<GroupMatrix> {
  const t = getLarkTables();
  const [groupItems, memberItems, master] = await Promise.all([
    getAllRecords(t.SEISAN_KPI_GROUP, `CurrentValue.[${GF.period}] = ${period}`),
    getAllRecords(t.SEISAN_KPI_GROUP_MEMBER, `CurrentValue.[${GMF.period}] = ${period}`),
    getKpiMaster(period),
  ]);
  // 部署 = Lv4(課)の部署名。並び順は master の sortOrder 準拠
  const seen = new Set<string>();
  const departments: string[] = [];
  for (const m of master) {
    if (m.level === "Lv4" && m.department && !seen.has(m.department)) {
      seen.add(m.department);
      departments.push(m.department);
    }
  }
  const groups: GroupMatrixGroup[] = groupItems
    .map((it) => ({
      recordId: it.record_id,
      groupId: asText(it.fields[GF.group_id]),
      groupName: asText(it.fields[GF.group_name]),
      groupType: asText(it.fields[GF.group_type]),
      sortOrder: asNum(it.fields[GF.sort_order]) ?? 0,
      isActive: it.fields[GF.is_active] == null ? true : asBool(it.fields[GF.is_active]),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const membership: Record<string, Record<string, string>> = {};
  for (const d of departments) membership[d] = {};
  for (const it of memberItems) {
    const dept = asText(it.fields[GMF.department]);
    const gid = asText(it.fields[GMF.group_id]);
    if (!dept || !gid) continue;
    if (!membership[dept]) membership[dept] = {};
    membership[dept][gid] = it.record_id;
  }
  return { period, departments, groups, membership };
}

/** グループの作成・更新(グループコード×期で一意) */
export async function upsertGroup(input: {
  period: number;
  groupId?: string;
  groupName: string;
  groupType?: string;
  sortOrder?: number;
  isActive?: boolean;
  operator?: string;
}): Promise<{ recordId: string; groupId: string; created: boolean }> {
  const t = getLarkTables();
  const operator = input.operator ?? "";
  // 新規時のグループコード採番: G-<連番>(名称から作れないため期内連番)
  let groupId = input.groupId;
  if (!groupId) {
    const existing = await getAllRecords(t.SEISAN_KPI_GROUP, `CurrentValue.[${GF.period}] = ${input.period}`);
    groupId = `G-${input.period}-${existing.length + 1}`;
  }
  const fields: Record<string, any> = {
    [GF.group_id]: groupId,
    [GF.group_name]: input.groupName,
    [GF.period]: input.period,
  };
  if (input.groupType !== undefined) fields[GF.group_type] = input.groupType;
  if (input.sortOrder !== undefined) fields[GF.sort_order] = input.sortOrder;
  if (input.isActive !== undefined) fields[GF.is_active] = input.isActive;

  const found = await getBaseRecords(t.SEISAN_KPI_GROUP, {
    baseToken: base(),
    filter: `AND(CurrentValue.[${GF.period}] = ${input.period}, CurrentValue.[${GF.group_id}] = "${groupId}")`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;
  if (existingRec) {
    await updateBaseRecord(t.SEISAN_KPI_GROUP, existingRec.record_id, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_GROUP", recordId: groupId, operation: "更新", before: existingRec.fields, after: fields, operator });
    return { recordId: existingRec.record_id, groupId, created: false };
  }
  const r: any = await createBaseRecord(t.SEISAN_KPI_GROUP, fields, { baseToken: base() });
  await writeAudit({ table: "SEISAN_KPI_GROUP", recordId: groupId, operation: "作成", after: fields, operator });
  return { recordId: r?.data?.record?.record_id ?? "", groupId, created: true };
}

/** 所属マトリクスのトグル: member=true で所属追加、false で解除 */
export async function setGroupMember(input: {
  period: number;
  groupId: string;
  department: string;
  departmentId?: string;
  member: boolean;
  operator?: string;
}): Promise<{ member: boolean }> {
  const t = getLarkTables();
  const operator = input.operator ?? "";
  const memberId = `${input.groupId}-${input.department}`;
  const found = await getBaseRecords(t.SEISAN_KPI_GROUP_MEMBER, {
    baseToken: base(),
    filter: `CurrentValue.[${GMF.member_id}] = "${memberId}"`,
    pageSize: 1,
  });
  const existingRec = (found.data?.items ?? [])[0] as any;

  if (input.member) {
    if (existingRec) return { member: true };
    const fields: Record<string, any> = {
      [GMF.member_id]: memberId,
      [GMF.group_id]: input.groupId,
      [GMF.department]: input.department,
      [GMF.department_id]: input.departmentId ?? "",
      [GMF.period]: input.period,
    };
    await createBaseRecord(t.SEISAN_KPI_GROUP_MEMBER, fields, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_GROUP_MEMBER", recordId: memberId, operation: "作成", after: fields, operator });
    return { member: true };
  }
  // 解除
  if (existingRec) {
    await deleteBaseRecord(t.SEISAN_KPI_GROUP_MEMBER, existingRec.record_id, { baseToken: base() });
    await writeAudit({ table: "SEISAN_KPI_GROUP_MEMBER", recordId: memberId, operation: "削除", before: existingRec.fields, operator });
  }
  return { member: false };
}

/**
 * 期切替(新期作成): fromPeriod の KPIマスタ・グループ・所属を toPeriod に複製。
 * 実績/PDCA/★等のトランザクションデータは複製しない(定義のみ)。
 * 既に toPeriod のマスタが存在する場合は中断(誤上書き防止)。
 */
export async function clonePeriod(input: {
  fromPeriod: number;
  toPeriod: number;
  startDate?: string;
  endDate?: string;
  operator?: string;
}): Promise<{ cloned: { master: number; groups: number; members: number }; periodCreated: boolean }> {
  const t = getLarkTables();
  const operator = input.operator ?? "";

  const existingMaster = await getBaseRecords(t.SEISAN_KPI_MASTER, {
    baseToken: base(),
    filter: `CurrentValue.[${MF.period}] = ${input.toPeriod}`,
    pageSize: 1,
  });
  if ((existingMaster.data?.items ?? []).length > 0) {
    throw new Error(`${input.toPeriod}期のマスタが既に存在します。複製を中止しました。`);
  }

  // 期マスタを作成(なければ)
  let periodCreated = false;
  const foundPeriod = await getBaseRecords(t.SEISAN_KPI_PERIOD, {
    baseToken: base(),
    filter: `CurrentValue.[${PF.period}] = ${input.toPeriod}`,
    pageSize: 1,
  });
  if ((foundPeriod.data?.items ?? []).length === 0) {
    await createBaseRecord(t.SEISAN_KPI_PERIOD, {
      [PF.period]: input.toPeriod,
      [PF.start_date]: input.startDate ?? "",
      [PF.end_date]: input.endDate ?? "",
      [PF.elapsed_months]: 0,
      [PF.is_current]: false,
    }, { baseToken: base() });
    periodCreated = true;
  }

  // KPIマスタ複製
  const masterItems = await getAllRecords(t.SEISAN_KPI_MASTER, `CurrentValue.[${MF.period}] = ${input.fromPeriod}`);
  for (const it of masterItems) {
    const f = { ...it.fields, [MF.period]: input.toPeriod };
    await createBaseRecord(t.SEISAN_KPI_MASTER, f, { baseToken: base() });
  }
  // グループ複製
  const groupItems = await getAllRecords(t.SEISAN_KPI_GROUP, `CurrentValue.[${GF.period}] = ${input.fromPeriod}`);
  for (const it of groupItems) {
    const f = { ...it.fields, [GF.period]: input.toPeriod };
    await createBaseRecord(t.SEISAN_KPI_GROUP, f, { baseToken: base() });
  }
  // 所属複製
  const memberItems = await getAllRecords(t.SEISAN_KPI_GROUP_MEMBER, `CurrentValue.[${GMF.period}] = ${input.fromPeriod}`);
  for (const it of memberItems) {
    const f = { ...it.fields, [GMF.period]: input.toPeriod };
    await createBaseRecord(t.SEISAN_KPI_GROUP_MEMBER, f, { baseToken: base() });
  }

  await writeAudit({
    table: "SEISAN_KPI_PERIOD", recordId: `clone-${input.fromPeriod}->${input.toPeriod}`, operation: "作成",
    after: { master: masterItems.length, groups: groupItems.length, members: memberItems.length }, operator,
  });
  return {
    cloned: { master: masterItems.length, groups: groupItems.length, members: memberItems.length },
    periodCreated,
  };
}
