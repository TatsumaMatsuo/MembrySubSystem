import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import {
  getOfficeInfo,
  getOfficeOrderIndex,
  REASON_TO_CATEGORY,
  RESPONSIBILITY_REASONS,
  OFFICE_ORDER,
  OFFICE_REGION_MAP,
} from "@/lib/office-mapping";

export const dynamic = "force-dynamic";

// 納期変更データのテーブル情報
const BASE_TOKEN = "VWNGbLiaZa2JursrxTMjENXap9b";
const TABLE_ID = "tblkBgZnxOaYmKXh";

// 月次受注残スナップショットテーブル
const SNAPSHOT_TABLE_ID = process.env.LARK_TABLE_ORDER_SNAPSHOT || "";

// キャッシュ
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15分

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// 期から日付範囲を計算（期初は8月）
function getPeriodDateRange(period: number): { start: string; end: string } {
  const startYear = period + 1975;
  const endYear = startYear + 1;
  return {
    start: `${startYear}/08/01`,
    end: `${endYear}/07/31`,
  };
}

// 現在の期を計算
function getCurrentPeriod(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? year - 1975 : year - 1976;
}

// 月名を取得（8月始まり）
function getFiscalMonthName(monthIndex: number): string {
  const months = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
  return months[monthIndex];
}

// テキスト値を抽出
function extractTextValue(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.text) return first.text;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.text) return value.text;
  return String(value);
}

// Excelシリアル日付をDateに変換
function excelDateToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  return new Date(utcValue);
}

// 日付をフォーマット
function formatDate(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// 日付文字列をDateに変換
function parseDate(dateStr: string | number): Date | null {
  if (!dateStr) return null;
  if (typeof dateStr === "number") {
    if (dateStr > 1000000000000) return new Date(dateStr);
    return excelDateToDate(dateStr);
  }
  const cleaned = String(dateStr).trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

// ユーザーオブジェクトから名前を抽出
function extractUserName(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.name) return first.name;
  }
  if (typeof value === "object" && value?.name) return value.name;
  return "";
}

// 日数差を計算
function daysDiff(date1: Date | null, date2: Date | null): number | null {
  if (!date1 || !date2) return null;
  const diff = date2.getTime() - date1.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// 責任区分からカテゴリを判定
function getResponsibilityCategory(responsibility: string): string {
  if (!responsibility) return "";
  return REASON_TO_CATEGORY[responsibility] || responsibility;
}

// 責任区分から要因を判定（カテゴリと同じ値の場合は空にする）
function getChangeReason(responsibility: string, reason: string): string {
  if (reason) return reason;
  // responsibilityが詳細値（施主要望 etc.）の場合はそれが要因
  if (REASON_TO_CATEGORY[responsibility] && responsibility !== REASON_TO_CATEGORY[responsibility]) {
    return responsibility;
  }
  return "";
}

// --- 型定義 ---

interface DeliveryChangeRecord {
  recordId: string;
  tantousha: string;
  office: string;
  region: string;
  orderNumber: string;
  orderName: string;
  orderDate: string;
  constructionStartDate: string;
  daysDiff: number | null;
  beforeDate: string;
  beforeStatus: string;
  afterDate: string;
  afterStatus: string;
  applicationDate: string;
  applicationMonth: string;
  isCounted: boolean;
  responsibility: string;    // カテゴリ: 社外/自社/納期確定
  changeReason: string;      // 詳細要因: 施主要望, 営業対応, etc.
  judgment1: boolean | null;  // 第1判定: (変更前施工日 - 申請日) <= 30日
  judgment2: boolean | null;  // 第2判定: 第1判定○ AND (変更後施工日 - 変更前施工日) >= 7日
}

interface MonthlySummary {
  month: string;
  monthIndex: number;
  yearMonth: string;
  changeCount: number;
  backlogCount: number;
  changeRate: number;
}

interface TantoushaSummary {
  name: string;
  office: string;
  region: string;
  totalChangeCount: number;
  totalBacklogCount: number;
  changeRate: number;
  monthlyData: MonthlySummary[];
}

interface OfficeSummary {
  name: string;
  region: string;
  totalChangeCount: number;
  totalBacklogCount: number;
  changeRate: number;
  tantoushaList: TantoushaSummary[];
  monthlyData: MonthlySummary[];
}

interface ResponsibilityItem {
  category: string;
  reason: string;
  monthlyCounts: Record<string, number>;
  total: number;
}

interface JudgmentByCategory {
  category: string;
  j1Yes: number;
  j1No: number;
  j2Yes: number;
  j2No: number;
}

interface PeriodData {
  period: number;
  dateRange: { start: string; end: string };
  totalChangeCount: number;
  totalBacklogCount: number;
  overallChangeRate: number;
  monthlyData: MonthlySummary[];
  byRegion: {
    name: string;
    changeCount: number;
    backlogCount: number;
    changeRate: number;
    monthlyData: MonthlySummary[];
  }[];
  byOffice: OfficeSummary[];
  byTantousha: TantoushaSummary[];
  records: DeliveryChangeRecord[];
  snapshotUsed: boolean;
  responsibilityData: {
    items: ResponsibilityItem[];
    monthlyTotals: Record<string, number>;
    grandTotal: number;
  };
  judgmentData: {
    byResponsibility: JudgmentByCategory[];
    totals: { j1Yes: number; j1No: number; j2Yes: number; j2No: number };
  };
}

// --- スナップショット ---

interface SnapshotEntry {
  yearMonth: string;
  tantousha: string;
  count: number;
}

async function fetchSnapshotData(client: any): Promise<SnapshotEntry[]> {
  if (!SNAPSHOT_TABLE_ID) return [];
  const baseToken = getLarkBaseToken();
  const entries: SnapshotEntry[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const response = await client.bitable.appTableRecord.list({
        path: { app_token: baseToken, table_id: SNAPSHOT_TABLE_ID },
        params: { page_size: 500, page_token: pageToken },
      });
      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;
          let countValue = fields?.["受注残件数"];
          if (Array.isArray(countValue)) countValue = countValue[0];
          if (typeof countValue === "object" && countValue !== null) {
            countValue = countValue.value || countValue.text || 0;
          }
          entries.push({
            yearMonth: fields?.["年月"] || "",
            tantousha: fields?.["担当者"] || "",
            count: typeof countValue === "number" ? countValue : parseInt(String(countValue), 10) || 0,
          });
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);
    console.log(`[delivery-change] Fetched ${entries.length} snapshot entries`);
  } catch (e: any) {
    console.warn("[delivery-change] Failed to fetch snapshot data:", e.message);
  }
  return entries;
}

function indexSnapshots(entries: SnapshotEntry[]) {
  const byMonth = new Map<string, number>();
  const byTantoushaMonth = new Map<string, number>();
  for (const entry of entries) {
    byMonth.set(entry.yearMonth, (byMonth.get(entry.yearMonth) || 0) + entry.count);
    const key = `${entry.tantousha}:${entry.yearMonth}`;
    byTantoushaMonth.set(key, (byTantoushaMonth.get(key) || 0) + entry.count);
  }
  return { byMonth, byTantoushaMonth };
}

// --- API Handler ---

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || String(getCurrentPeriod()), 10);
  const refresh = searchParams.get("refresh") === "true";

  const cacheKey = `delivery-change:${period}`;
  if (!refresh) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
  }

  console.log("[delivery-change] Fetching data for period:", period);
  const startTime = Date.now();

  try {
    const dateRange = getPeriodDateRange(period);

    // Larkテーブルからデータ取得 + スナップショットを並列取得
    const fetchRecords = async () => {
      let allRecords: any[] = [];
      let pageToken: string | undefined;
      do {
        const response = await client.bitable.appTableRecord.list({
          path: { app_token: BASE_TOKEN, table_id: TABLE_ID },
          params: { page_size: 500, page_token: pageToken },
        });
        if (response.data?.items) {
          allRecords = allRecords.concat(response.data.items);
        }
        pageToken = response.data?.page_token;
      } while (pageToken);
      return allRecords;
    };

    const [allRecords, snapshotEntries] = await Promise.all([
      fetchRecords(),
      fetchSnapshotData(client),
    ]);

    const snapshotIndex = indexSnapshots(snapshotEntries);

    console.log("[delivery-change] Fetched records:", allRecords.length, "snapshots:", snapshotEntries.length);

    // 期の月を初期化（8月〜7月）
    const periodStartYear = period + 1975;
    const yearMonths: string[] = [];
    for (let i = 0; i < 12; i++) {
      const monthNum = ((i + 8 - 1) % 12) + 1;
      const year = i < 5 ? periodStartYear : periodStartYear + 1;
      yearMonths.push(`${year}${String(monthNum).padStart(2, "0")}`);
    }

    const monthlyMap = new Map<string, { changeCount: number; backlogCount: number }>();
    for (const ym of yearMonths) {
      monthlyMap.set(ym, { changeCount: 0, backlogCount: 0 });
    }

    // データ処理
    const records: DeliveryChangeRecord[] = [];
    const tantoushaMap = new Map<string, {
      office: string;
      region: string;
      monthly: Map<string, { changeCount: number; backlogCount: number }>;
    }>();

    // 責任区分×変更要因 集計
    const responsibilityMap = new Map<string, { monthlyCounts: Record<string, number>; total: number }>();
    // 判定集計
    const judgmentMap = new Map<string, { j1Yes: number; j1No: number; j2Yes: number; j2No: number }>();

    allRecords.forEach((record) => {
      const fields = record.fields || {};

      const tantousha = extractUserName(fields["営業担当者"]);
      const orderNumber = extractTextValue(fields["受注伝票番号"]);
      const orderName = extractTextValue(fields["売約名"]);
      const beforeDateRaw = fields["変更前施工日"];
      const afterDateRaw = fields["変更後施工日"];
      const status = extractTextValue(fields["確定or仮"]);
      const applicationDateRaw = fields["申請日"];
      const responsibilityRaw = extractTextValue(fields["変更責任区分"]);
      const changeReasonRaw = extractTextValue(fields["変更要因"]);

      // 日付変換
      const beforeDate = parseDate(beforeDateRaw);
      const afterDate = parseDate(afterDateRaw);
      const applicationDate = parseDate(applicationDateRaw);

      // 日数差計算（変更前と変更後の差）
      const diff = daysDiff(beforeDate, afterDate);

      // カウント判定: 差が7日を超える場合
      const isCounted = diff !== null && Math.abs(diff) > 7;

      // 営業所・地域の判定（静的マッピング使用）
      const officeInfo = getOfficeInfo(tantousha);

      // 責任区分の判定
      const category = getResponsibilityCategory(responsibilityRaw);
      const reason = getChangeReason(responsibilityRaw, changeReasonRaw);

      // 第1判定: (変更前施工日 - 申請日) <= 30日 → ○
      let judgment1: boolean | null = null;
      if (beforeDate && applicationDate) {
        const daysBeforeApplication = daysDiff(applicationDate, beforeDate);
        if (daysBeforeApplication !== null) {
          judgment1 = daysBeforeApplication <= 30;
        }
      }

      // 第2判定: 第1判定=○ AND (変更後施工日 - 変更前施工日) >= 7日 → ○
      let judgment2: boolean | null = null;
      if (judgment1 === true && beforeDate && afterDate) {
        const changeDays = daysDiff(beforeDate, afterDate);
        if (changeDays !== null) {
          judgment2 = Math.abs(changeDays) >= 7;
        }
      } else if (judgment1 === false) {
        judgment2 = false;
      }

      // 申請月を計算
      let targetYearMonth = "";
      if (applicationDate) {
        targetYearMonth = `${applicationDate.getFullYear()}${String(applicationDate.getMonth() + 1).padStart(2, "0")}`;
      }

      const deliveryRecord: DeliveryChangeRecord = {
        recordId: record.record_id,
        tantousha,
        office: officeInfo.office,
        region: officeInfo.region,
        orderNumber,
        orderName,
        orderDate: "",
        constructionStartDate: formatDate(beforeDate),
        daysDiff: diff,
        beforeDate: formatDate(beforeDate),
        beforeStatus: status,
        afterDate: formatDate(afterDate),
        afterStatus: status,
        applicationDate: formatDate(applicationDate),
        applicationMonth: targetYearMonth,
        isCounted,
        responsibility: category,
        changeReason: reason,
        judgment1,
        judgment2,
      };

      records.push(deliveryRecord);

      // 月別集計（変更回数のみ。受注残件数はスナップショットテーブルから取得）
      if (targetYearMonth && monthlyMap.has(targetYearMonth) && isCounted) {
        monthlyMap.get(targetYearMonth)!.changeCount++;
      }

      // 担当者別集計
      if (tantousha) {
        if (!tantoushaMap.has(tantousha)) {
          tantoushaMap.set(tantousha, {
            office: officeInfo.office,
            region: officeInfo.region,
            monthly: new Map(),
          });
        }
        const tanData = tantoushaMap.get(tantousha)!;
        if (targetYearMonth) {
          if (!tanData.monthly.has(targetYearMonth)) {
            tanData.monthly.set(targetYearMonth, { changeCount: 0, backlogCount: 0 });
          }
          if (isCounted) {
            tanData.monthly.get(targetYearMonth)!.changeCount++;
          }
        }
      }

      // 責任区分×要因 集計（カウント対象のみ）
      if (isCounted && targetYearMonth && monthlyMap.has(targetYearMonth)) {
        const respKey = `${category}:${reason || category}`;
        if (!responsibilityMap.has(respKey)) {
          responsibilityMap.set(respKey, { monthlyCounts: {}, total: 0 });
        }
        const respData = responsibilityMap.get(respKey)!;
        respData.monthlyCounts[targetYearMonth] = (respData.monthlyCounts[targetYearMonth] || 0) + 1;
        respData.total++;

        // 判定集計
        if (!judgmentMap.has(category)) {
          judgmentMap.set(category, { j1Yes: 0, j1No: 0, j2Yes: 0, j2No: 0 });
        }
        const jData = judgmentMap.get(category)!;
        if (judgment1 === true) jData.j1Yes++;
        if (judgment1 === false) jData.j1No++;
        if (judgment2 === true) jData.j2Yes++;
        if (judgment2 === false) jData.j2No++;
      }
    });

    // 受注残件数をスナップショットテーブルから設定
    for (const [yearMonth, data] of monthlyMap.entries()) {
      data.backlogCount = snapshotIndex.byMonth.get(yearMonth) || 0;
    }

    // 担当者別の受注残件数をスナップショットテーブルから設定
    for (const [tantousha, tanData] of tantoushaMap.entries()) {
      for (const yearMonth of yearMonths) {
        if (!tanData.monthly.has(yearMonth)) {
          tanData.monthly.set(yearMonth, { changeCount: 0, backlogCount: 0 });
        }
        const tanMonthly = tanData.monthly.get(yearMonth)!;
        const snapshotKey = `${tantousha}:${yearMonth}`;
        tanMonthly.backlogCount = snapshotIndex.byTantoushaMonth.get(snapshotKey) || 0;
      }
    }

    // 月別サマリー作成
    const monthlyData: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
      const data = monthlyMap.get(yearMonth)!;
      return {
        month: getFiscalMonthName(idx),
        monthIndex: idx,
        yearMonth,
        changeCount: data.changeCount,
        backlogCount: data.backlogCount,
        changeRate: data.backlogCount > 0 ? data.changeCount / data.backlogCount : 0,
      };
    });

    // 担当者別サマリー作成
    const byTantousha: TantoushaSummary[] = [];
    for (const [name, data] of tantoushaMap.entries()) {
      let totalChangeCount = 0;
      let totalBacklogCount = 0;
      const tanMonthlyData: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
        const mData = data.monthly.get(yearMonth) || { changeCount: 0, backlogCount: 0 };
        totalChangeCount += mData.changeCount;
        totalBacklogCount += mData.backlogCount;
        return {
          month: getFiscalMonthName(idx),
          monthIndex: idx,
          yearMonth,
          changeCount: mData.changeCount,
          backlogCount: mData.backlogCount,
          changeRate: mData.backlogCount > 0 ? mData.changeCount / mData.backlogCount : 0,
        };
      });
      byTantousha.push({
        name,
        office: data.office,
        region: data.region,
        totalChangeCount,
        totalBacklogCount,
        changeRate: totalBacklogCount > 0 ? totalChangeCount / totalBacklogCount : 0,
        monthlyData: tanMonthlyData,
      });
    }

    // 営業所順でソート
    byTantousha.sort((a, b) => {
      const offDiff = getOfficeOrderIndex(a.office) - getOfficeOrderIndex(b.office);
      if (offDiff !== 0) return offDiff;
      return a.name.localeCompare(b.name, "ja");
    });

    // 営業所別サマリー作成
    const officeSet = new Set<string>();
    byTantousha.forEach(t => officeSet.add(t.office));

    const byOffice: OfficeSummary[] = [];
    for (const officeName of OFFICE_ORDER) {
      const officeTantousha = byTantousha.filter(t => t.office === officeName);
      if (officeTantousha.length === 0) continue;

      const officeMonthlyData: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
        let changeCount = 0;
        let backlogCount = 0;
        officeTantousha.forEach(t => {
          const m = t.monthlyData.find(md => md.yearMonth === yearMonth);
          if (m) {
            changeCount += m.changeCount;
            backlogCount += m.backlogCount;
          }
        });
        return {
          month: getFiscalMonthName(idx),
          monthIndex: idx,
          yearMonth,
          changeCount,
          backlogCount,
          changeRate: backlogCount > 0 ? changeCount / backlogCount : 0,
        };
      });

      const totalChangeCount = officeTantousha.reduce((sum, t) => sum + t.totalChangeCount, 0);
      const totalBacklogCount = officeTantousha.reduce((sum, t) => sum + t.totalBacklogCount, 0);

      byOffice.push({
        name: officeName,
        region: OFFICE_REGION_MAP[officeName] || "その他",
        totalChangeCount,
        totalBacklogCount,
        changeRate: totalBacklogCount > 0 ? totalChangeCount / totalBacklogCount : 0,
        tantoushaList: officeTantousha,
        monthlyData: officeMonthlyData,
      });
    }

    // 「その他」営業所の担当者がいれば追加
    const otherTantousha = byTantousha.filter(t => !(OFFICE_ORDER as readonly string[]).includes(t.office));
    if (otherTantousha.length > 0) {
      const otherMonthly: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
        let changeCount = 0;
        let backlogCount = 0;
        otherTantousha.forEach(t => {
          const m = t.monthlyData.find(md => md.yearMonth === yearMonth);
          if (m) { changeCount += m.changeCount; backlogCount += m.backlogCount; }
        });
        return {
          month: getFiscalMonthName(idx), monthIndex: idx, yearMonth,
          changeCount, backlogCount,
          changeRate: backlogCount > 0 ? changeCount / backlogCount : 0,
        };
      });
      byOffice.push({
        name: "その他",
        region: "その他",
        totalChangeCount: otherTantousha.reduce((s, t) => s + t.totalChangeCount, 0),
        totalBacklogCount: otherTantousha.reduce((s, t) => s + t.totalBacklogCount, 0),
        changeRate: 0,
        tantoushaList: otherTantousha,
        monthlyData: otherMonthly,
      });
    }

    // 地域別サマリー（月別データ付き）
    const regionNames = ["西日本", "東日本"];
    const byRegion = regionNames.map(regionName => {
      const regionOffices = byOffice.filter(o => o.region === regionName);
      const regionMonthlyData: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
        let changeCount = 0;
        let backlogCount = 0;
        regionOffices.forEach(o => {
          const m = o.monthlyData.find(md => md.yearMonth === yearMonth);
          if (m) { changeCount += m.changeCount; backlogCount += m.backlogCount; }
        });
        return {
          month: getFiscalMonthName(idx), monthIndex: idx, yearMonth,
          changeCount, backlogCount,
          changeRate: backlogCount > 0 ? changeCount / backlogCount : 0,
        };
      });
      const changeCount = regionOffices.reduce((s, o) => s + o.totalChangeCount, 0);
      const backlogCount = regionOffices.reduce((s, o) => s + o.totalBacklogCount, 0);
      return {
        name: regionName,
        changeCount,
        backlogCount,
        changeRate: backlogCount > 0 ? changeCount / backlogCount : 0,
        monthlyData: regionMonthlyData,
      };
    }).filter(r => r.changeCount > 0 || r.backlogCount > 0);

    // 「その他」地域
    const otherRegionOffices = byOffice.filter(o => o.region === "その他");
    if (otherRegionOffices.length > 0) {
      const otherRegionMonthly: MonthlySummary[] = yearMonths.map((yearMonth, idx) => {
        let cc = 0, bc = 0;
        otherRegionOffices.forEach(o => {
          const m = o.monthlyData.find(md => md.yearMonth === yearMonth);
          if (m) { cc += m.changeCount; bc += m.backlogCount; }
        });
        return { month: getFiscalMonthName(idx), monthIndex: idx, yearMonth, changeCount: cc, backlogCount: bc, changeRate: bc > 0 ? cc / bc : 0 };
      });
      byRegion.push({
        name: "その他",
        changeCount: otherRegionOffices.reduce((s, o) => s + o.totalChangeCount, 0),
        backlogCount: otherRegionOffices.reduce((s, o) => s + o.totalBacklogCount, 0),
        changeRate: 0,
        monthlyData: otherRegionMonthly,
      });
    }

    // 全体集計
    const totalChangeCount = monthlyData.reduce((sum, m) => sum + m.changeCount, 0);
    const totalBacklogCount = monthlyData.reduce((sum, m) => sum + m.backlogCount, 0);
    const overallChangeRate = totalBacklogCount > 0 ? totalChangeCount / totalBacklogCount : 0;

    // 責任区分×変更要因データ
    const responsibilityItems: ResponsibilityItem[] = [];
    const monthlyTotals: Record<string, number> = {};

    for (const group of RESPONSIBILITY_REASONS) {
      for (const reason of group.reasons) {
        const key = `${group.category}:${reason}`;
        const data = responsibilityMap.get(key);
        responsibilityItems.push({
          category: group.category,
          reason,
          monthlyCounts: data?.monthlyCounts || {},
          total: data?.total || 0,
        });
      }
    }

    // 月別合計
    for (const item of responsibilityItems) {
      for (const [ym, count] of Object.entries(item.monthlyCounts)) {
        monthlyTotals[ym] = (monthlyTotals[ym] || 0) + count;
      }
    }

    // 判定データ
    const judgmentCategories = ["社外", "自社", "納期確定"];
    const judgmentByResp: JudgmentByCategory[] = judgmentCategories.map(cat => {
      const jd = judgmentMap.get(cat) || { j1Yes: 0, j1No: 0, j2Yes: 0, j2No: 0 };
      return { category: cat, ...jd };
    });

    const judgmentTotals = {
      j1Yes: judgmentByResp.reduce((s, j) => s + j.j1Yes, 0),
      j1No: judgmentByResp.reduce((s, j) => s + j.j1No, 0),
      j2Yes: judgmentByResp.reduce((s, j) => s + j.j2Yes, 0),
      j2No: judgmentByResp.reduce((s, j) => s + j.j2No, 0),
    };

    const result: PeriodData = {
      period,
      dateRange,
      totalChangeCount,
      totalBacklogCount,
      overallChangeRate,
      monthlyData,
      byRegion,
      byOffice,
      byTantousha,
      records: records.filter(r => r.isCounted).slice(0, 500),
      snapshotUsed: true,
      responsibilityData: {
        items: responsibilityItems,
        monthlyTotals,
        grandTotal: totalChangeCount,
      },
      judgmentData: {
        byResponsibility: judgmentByResp,
        totals: judgmentTotals,
      },
    };

    console.log("[delivery-change] Completed in", Date.now() - startTime, "ms");

    const responseData = { success: true, currentPeriod: getCurrentPeriod(), data: result };
    setCachedData(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[delivery-change] Error:", error);
    return NextResponse.json(
      { error: "納期変更データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
