import { NextRequest, NextResponse } from "next/server";
import { getLarkClient } from "@/lib/lark-client";

export const dynamic = "force-dynamic";

// 納期変更データのテーブル情報
const BASE_TOKEN = "VWNGbLiaZa2JursrxTMjENXap9b";
const TABLE_ID = "tblkBgZnxOaYmKXh";

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

// 数値を抽出
function extractNumberValue(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
}

// Excelシリアル日付をDateに変換
function excelDateToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null;
  // Excelは1900年1月1日を1とする
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

  // 数値の場合
  if (typeof dateStr === "number") {
    // Unixタイムスタンプ（ミリ秒）の場合
    if (dateStr > 1000000000000) {
      return new Date(dateStr);
    }
    // Excelシリアル日付の場合
    return excelDateToDate(dateStr);
  }

  // 文字列の場合
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

// 納期変更カウント判定
// 施工開始日と変更後日程の差が7日を超える（8日以上または-8日以下）場合にカウント
// 仮→本への同日変更はカウントしない
function shouldCountChange(
  constructionStartDate: Date | null,
  beforeDate: Date | null,
  afterDate: Date | null,
  beforeStatus: string,
  afterStatus: string
): boolean {
  if (!constructionStartDate || !afterDate) return false;

  // 仮→本への同日変更はカウントしない
  if (beforeStatus === "仮" && afterStatus === "確" || beforeStatus === "仮" && afterStatus === "本") {
    if (beforeDate && afterDate) {
      const sameDayChange = daysDiff(beforeDate, afterDate) === 0;
      if (sameDayChange) return false;
    }
  }

  // 施工開始日と変更後日程の差を計算
  const diff = daysDiff(constructionStartDate, afterDate);
  if (diff === null) return false;

  // 差が7日を超える場合（8日以上または-8日以下）にカウント
  return Math.abs(diff) > 7;
}

// 営業所マッピング
const OFFICE_MAP: Record<string, string> = {
  "仙台営業所": "東日本",
  "北関東営業所": "東日本",
  "東京営業所": "東日本",
  "名古屋営業所": "東日本",
  "大阪営業所": "西日本",
  "北九州営業所": "西日本",
  "福岡営業所": "西日本",
  "佐賀営業所": "西日本",
  "八女営業所": "西日本",
  "宮崎営業所": "西日本",
  "本社": "本社",
};

interface DeliveryChangeRecord {
  recordId: string;
  tantousha: string;          // 担当者
  office: string;             // 営業所
  region: string;             // 地域
  orderNumber: string;        // 受注番号
  orderName: string;          // 受注件名
  orderDate: string;          // 受注日
  constructionStartDate: string; // 施工開始日
  daysDiff: number | null;    // 日数差
  beforeDate: string;         // 変更前日程
  beforeStatus: string;       // 変更前 仮/確
  afterDate: string;          // 変更後日程
  afterStatus: string;        // 変更後 仮/確
  applicationDate: string;    // 申請日
  applicationMonth: string;   // 申請月
  isCounted: boolean;         // カウント対象か
}

interface MonthlySummary {
  month: string;
  monthIndex: number;
  yearMonth: string;          // YYYYMM形式
  changeCount: number;        // 変更回数
  backlogCount: number;       // 受注残数
  changeRate: number;         // 変更率
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
  }[];
  byOffice: OfficeSummary[];
  byTantousha: TantoushaSummary[];
  records: DeliveryChangeRecord[];
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || String(getCurrentPeriod()), 10);
  const month = searchParams.get("month"); // YYYYMM形式（オプション）
  const refresh = searchParams.get("refresh") === "true";

  const cacheKey = `delivery-change:${period}:${month || "all"}`;
  if (!refresh) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      console.log("[delivery-change] Cache hit:", cacheKey);
      return NextResponse.json(cachedResult);
    }
  }

  console.log("[delivery-change] Fetching data for period:", period);
  const startTime = Date.now();

  try {
    const dateRange = getPeriodDateRange(period);

    // Larkテーブルからデータ取得
    let allRecords: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: BASE_TOKEN,
          table_id: TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
        },
      });

      if (response.data?.items) {
        allRecords = allRecords.concat(response.data.items);
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log("[delivery-change] Fetched records:", allRecords.length, "in", Date.now() - startTime, "ms");

    // デバッグ: 最初のレコードのフィールド名を出力
    if (allRecords.length > 0) {
      const sampleFields = allRecords[0].fields || {};
      console.log("[delivery-change] Sample record fields:", Object.keys(sampleFields));
      console.log("[delivery-change] Sample record values:", JSON.stringify(sampleFields, null, 2).slice(0, 1000));
    }

    // データ処理
    const records: DeliveryChangeRecord[] = [];
    const monthlyMap = new Map<string, { changeCount: number; backlogCount: number }>();
    const tantoushaMap = new Map<string, {
      office: string;
      region: string;
      monthly: Map<string, { changeCount: number; backlogCount: number }>;
    }>();
    const officeMap = new Map<string, { region: string; tantoushaSet: Set<string> }>();

    // 期の月を初期化（8月〜7月）
    const periodStartYear = period + 1975;
    for (let i = 0; i < 12; i++) {
      const monthNum = ((i + 8 - 1) % 12) + 1;
      const year = i < 5 ? periodStartYear : periodStartYear + 1;
      const yearMonth = `${year}${String(monthNum).padStart(2, "0")}`;
      monthlyMap.set(yearMonth, { changeCount: 0, backlogCount: 0 });
    }

    allRecords.forEach((record) => {
      const fields = record.fields || {};

      // 実際のLarkテーブルフィールド名に合わせる
      const tantousha = extractUserName(fields["営業担当者"]);
      const orderNumber = extractTextValue(fields["受注伝票番号"]);
      const orderName = extractTextValue(fields["売約名"]);
      const beforeDateRaw = fields["変更前施工日"];
      const afterDateRaw = fields["変更後施工日"];
      const status = extractTextValue(fields["確定or仮"]); // "仮" or "確"
      const applicationDateRaw = fields["申請日"];
      const responsibility = extractTextValue(fields["変更責任区分"]); // "社外" or "社内"

      // 日付変換（Unixタイムスタンプ）
      const beforeDate = parseDate(beforeDateRaw);
      const afterDate = parseDate(afterDateRaw);
      const applicationDate = parseDate(applicationDateRaw);

      // 日数差計算（変更前と変更後の差）
      const diff = daysDiff(beforeDate, afterDate);

      // カウント判定: 変更前と変更後の差が7日を超える場合にカウント
      const isCounted = diff !== null && Math.abs(diff) > 7;

      // 営業所は担当者名から推定（後で売約情報と紐付けが必要な場合あり）
      const office = "本社"; // 暫定

      // 地域判定（暫定）
      const region = "本社";

      // 申請月を計算
      let targetYearMonth = "";
      if (applicationDate) {
        targetYearMonth = `${applicationDate.getFullYear()}${String(applicationDate.getMonth() + 1).padStart(2, "0")}`;
      }

      // レコード作成
      const deliveryRecord: DeliveryChangeRecord = {
        recordId: record.record_id,
        tantousha,
        office,
        region,
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
      };

      records.push(deliveryRecord);

      // 月別集計
      if (targetYearMonth && monthlyMap.has(targetYearMonth)) {
        const monthly = monthlyMap.get(targetYearMonth)!;
        monthly.backlogCount++;
        if (isCounted) {
          monthly.changeCount++;
        }
      }

      // 担当者別集計
      if (tantousha) {
        if (!tantoushaMap.has(tantousha)) {
          tantoushaMap.set(tantousha, {
            office,
            region,
            monthly: new Map(),
          });
        }
        const tanData = tantoushaMap.get(tantousha)!;
        if (targetYearMonth) {
          if (!tanData.monthly.has(targetYearMonth)) {
            tanData.monthly.set(targetYearMonth, { changeCount: 0, backlogCount: 0 });
          }
          const tanMonthly = tanData.monthly.get(targetYearMonth)!;
          tanMonthly.backlogCount++;
          if (isCounted) {
            tanMonthly.changeCount++;
          }
        }
      }

      // 営業所別集計
      if (office) {
        if (!officeMap.has(office)) {
          officeMap.set(office, { region, tantoushaSet: new Set() });
        }
        if (tantousha) {
          officeMap.get(office)!.tantoushaSet.add(tantousha);
        }
      }
    });

    // 月別サマリー作成
    const monthlyData: MonthlySummary[] = [];
    let idx = 0;
    for (const [yearMonth, data] of monthlyMap.entries()) {
      const changeRate = data.backlogCount > 0 ? data.changeCount / data.backlogCount : 0;
      monthlyData.push({
        month: getFiscalMonthName(idx),
        monthIndex: idx,
        yearMonth,
        changeCount: data.changeCount,
        backlogCount: data.backlogCount,
        changeRate,
      });
      idx++;
    }

    // 担当者別サマリー作成
    const byTantousha: TantoushaSummary[] = [];
    for (const [name, data] of tantoushaMap.entries()) {
      let totalChangeCount = 0;
      let totalBacklogCount = 0;
      const tanMonthlyData: MonthlySummary[] = [];

      let midx = 0;
      for (const [yearMonth] of monthlyMap.entries()) {
        const mData = data.monthly.get(yearMonth) || { changeCount: 0, backlogCount: 0 };
        totalChangeCount += mData.changeCount;
        totalBacklogCount += mData.backlogCount;
        tanMonthlyData.push({
          month: getFiscalMonthName(midx),
          monthIndex: midx,
          yearMonth,
          changeCount: mData.changeCount,
          backlogCount: mData.backlogCount,
          changeRate: mData.backlogCount > 0 ? mData.changeCount / mData.backlogCount : 0,
        });
        midx++;
      }

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

    // 変更率でソート
    byTantousha.sort((a, b) => b.changeRate - a.changeRate);

    // 営業所別サマリー作成
    const byOffice: OfficeSummary[] = [];
    for (const [officeName, data] of officeMap.entries()) {
      const officeTantousha = byTantousha.filter(t => t.office === officeName);
      const totalChangeCount = officeTantousha.reduce((sum, t) => sum + t.totalChangeCount, 0);
      const totalBacklogCount = officeTantousha.reduce((sum, t) => sum + t.totalBacklogCount, 0);

      byOffice.push({
        name: officeName,
        region: data.region,
        totalChangeCount,
        totalBacklogCount,
        changeRate: totalBacklogCount > 0 ? totalChangeCount / totalBacklogCount : 0,
        tantoushaList: officeTantousha,
      });
    }

    byOffice.sort((a, b) => b.changeRate - a.changeRate);

    // 地域別サマリー
    const regionMap = new Map<string, { changeCount: number; backlogCount: number }>();
    byOffice.forEach(office => {
      if (!regionMap.has(office.region)) {
        regionMap.set(office.region, { changeCount: 0, backlogCount: 0 });
      }
      const rData = regionMap.get(office.region)!;
      rData.changeCount += office.totalChangeCount;
      rData.backlogCount += office.totalBacklogCount;
    });

    const byRegion = Array.from(regionMap.entries()).map(([name, data]) => ({
      name,
      changeCount: data.changeCount,
      backlogCount: data.backlogCount,
      changeRate: data.backlogCount > 0 ? data.changeCount / data.backlogCount : 0,
    }));

    // 全体集計
    const totalChangeCount = monthlyData.reduce((sum, m) => sum + m.changeCount, 0);
    const totalBacklogCount = monthlyData.reduce((sum, m) => sum + m.backlogCount, 0);
    const overallChangeRate = totalBacklogCount > 0 ? totalChangeCount / totalBacklogCount : 0;

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
      records: records.filter(r => r.isCounted).slice(0, 200), // カウント対象のみ、上位200件
    };

    console.log("[delivery-change] Processing completed in", Date.now() - startTime, "ms");

    const responseData = {
      success: true,
      currentPeriod: getCurrentPeriod(),
      data: result,
    };

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
