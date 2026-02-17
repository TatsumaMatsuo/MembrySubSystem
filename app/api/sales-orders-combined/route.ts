import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// AWS Amplify SSRでのタイムアウト延長（最大60秒）
export const maxDuration = 60;

// 売上情報テーブル（実際の売上データ）
const SALES_TABLE_ID = "tbl65w6u6J72QFoz";
const SALES_VIEW_ID = "vewJWLOWQP"; // 月PJ区分別売上情報

// 案件一覧テーブル（受注残データ）
const BACKLOG_TABLE_ID = "tbl1ICzfUixpGqDy";
const BACKLOG_VIEW_ID = "vewCU8LrsT"; // 月部門担当者別受注残（売上済フラグ=0, 削除フラグ=0 でフィルター済み）

// シンプルなインメモリキャッシュ（TTL: 15分）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

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

// リトライ可能なLark APIエラーコード
const RETRYABLE_ERROR_CODES = [
  1254607, // Data not ready, please try again later
  1254609, // Busy, please try again later
];

// HTTP 400もリトライ対象（Lark APIが一時的に400を返すことがある）
function isRetryableError(error: any): boolean {
  const errorCode = error?.code || error?.data?.code;
  if (RETRYABLE_ERROR_CODES.includes(errorCode)) return true;
  const httpStatus = error?.response?.status || error?.status;
  if ([400, 429, 500, 502, 503].includes(httpStatus)) return true;
  const msg = error?.message || "";
  if (/status code (400|429|5\d\d)/.test(msg)) return true;
  return false;
}

// リトライ付きでLark API呼び出しを実行
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000,
  label: string = ""
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      const resultData = result as any;
      const errorCode = resultData?.code || resultData?.data?.code;
      if (errorCode && RETRYABLE_ERROR_CODES.includes(errorCode)) {
        throw { code: errorCode, msg: resultData?.msg || resultData?.data?.msg };
      }
      return result;
    } catch (error: any) {
      lastError = error;
      if (isRetryableError(error) && attempt < maxRetries) {
        const detail = error?.message || error?.code || "unknown";
        console.log(`[sales-orders-combined${label ? `:${label}` : ""}] Retrying after ${detail} (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// 月名配列（8月始まり）
const FISCAL_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

// JST (UTC+9) オフセット（ミリ秒）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// DateオブジェクトからJST日付成分を取得
function getJSTComponents(date: Date): { year: number; month: number; day: number } {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

// テキスト型の日付文字列をDateオブジェクトに変換（JST午前0時として解釈）
// sales-dashboard と同じ方式
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return null;
  const cleaned = dateStr.trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(Date.UTC(year, month - 1, day) - JST_OFFSET_MS);
}

// 日付が範囲内かどうかを判定
function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  const date = parseDate(dateStr);
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

// 日付文字列から期内の月インデックスを取得（JST基準）
function getFiscalMonthIndex(dateStr: string): number {
  const date = parseDate(dateStr);
  if (!date) return -1;
  const { month } = getJSTComponents(date);
  return month >= 8 ? month - 8 : month + 4;
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
  const { year, month } = getJSTComponents(now);
  return month >= 8 ? year - 1975 : year - 1976;
}

// フィールドからテキスト値を抽出
function extractTextValue(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.text) return first.text;
    if (typeof first === "object" && first?.name) return first.name;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.text) return value.text;
  if (typeof value === "object" && value?.name) return value.name;
  return String(value);
}

// 複数選択フィールドから全ての値を抽出
function extractMultiSelectValues(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value.trim()];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item?.text) return item.text;
      if (typeof item === "object" && item?.name) return item.name;
      return String(item);
    }).filter(Boolean);
  }
  if (typeof value === "object" && value?.text) return [value.text];
  if (typeof value === "object" && value?.name) return [value.name];
  return [];
}

// 営業所名リスト
const OFFICE_NAMES = [
  "仙台営業所", "北関東営業所", "東京営業所", "名古屋営業所",
  "大阪営業所", "北九州営業所", "福岡営業所", "佐賀営業所", "八女営業所", "宮崎営業所",
  "本社",
];

const HQ_SALES_PERSON = "山口 篤樹";

// 部署フィールドから営業所を抽出
function extractOfficeFromDepartment(
  departmentValue: any,
  optionMap?: Map<string, string>
): string {
  let departments = extractMultiSelectValues(departmentValue);

  if (optionMap && optionMap.size > 0) {
    departments = departments.map((id) => optionMap.get(id) || id);
  }

  for (const dept of departments) {
    if (OFFICE_NAMES.includes(dept)) {
      return dept;
    }
    const matchedOffice = OFFICE_NAMES.find((office) => dept.includes(office) || office.includes(dept));
    if (matchedOffice) {
      return matchedOffice;
    }
  }
  return departments[0] || "未設定";
}

// フェッチ済みの売上レコードから最新売上済月を計算
function computeLatestSoldMonth(salesRecords: any[]): string {
  let latestMonth = "";
  for (const record of salesRecords) {
    const uriageDate = extractTextValue(record.fields?.売上日);
    if (!uriageDate) continue;
    const date = parseDate(uriageDate);
    if (!date) continue;
    const { year, month } = getJSTComponents(date);
    const ym = `${year}${String(month).padStart(2, "0")}`;
    if (ym > latestMonth) {
      latestMonth = ym;
    }
  }
  return latestMonth;
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || String(getCurrentPeriod()), 10);
  const noCache = searchParams.get("noCache") === "true";

  const cacheKey = `sales-orders-combined:${period}`;
  if (!noCache) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
  }

  try {
    const baseToken = getLarkBaseToken();
    const dateRange = getPeriodDateRange(period);

    // 部署マッピング取得
    const departmentMap = new Map<string, string>();
    try {
      const deptResponse = await listAllDepartments();
      if (deptResponse.code === 0 && deptResponse.data?.items) {
        for (const dept of deptResponse.data.items) {
          const deptId = (dept as any).open_department_id || (dept as any).department_id;
          const deptName = (dept as any).name;
          if (deptId && deptName) {
            departmentMap.set(deptId, deptName);
            departmentMap.set(String(deptId), deptName);
          }
        }
      }
    } catch (e) {
      // 部署マッピング取得失敗時は空のまま継続
    }

    // ========================================
    // 1. 売上情報テーブルから実売上データを取得
    // ========================================
    const salesDateFilter = `AND(CurrentValue.[売上日] >= "${dateRange.start}", CurrentValue.[売上日] <= "${dateRange.end}")`;
    const salesFields = ["製番", "売上日", "金額"];

    let salesRecords: any[] = [];
    let salesPageToken: string | undefined;

    const salesStartTime = Date.now();
    do {
      const currentToken = salesPageToken;
      const response: any = await withRetry(() =>
        client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: SALES_TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: currentToken,
            filter: salesDateFilter,
            field_names: JSON.stringify(salesFields),
            view_id: SALES_VIEW_ID,
          },
        })
      );

      if (response.data?.items) {
        salesRecords.push(...response.data.items);
      }
      salesPageToken = response.data?.page_token;
    } while (salesPageToken);

    console.log(`[sales-orders-combined] Sales records: ${salesRecords.length} in ${Date.now() - salesStartTime}ms`);

    // 最新売上済月をフェッチ済みレコードから計算（ソートAPI不要）
    const latestSoldMonth = computeLatestSoldMonth(salesRecords);
    console.log(`[sales-orders-combined] Latest sold month: ${latestSoldMonth}`);

    // カットオフ日を計算（最新売上済月の翌月1日）
    let cutoffDate = "";
    if (latestSoldMonth) {
      const year = parseInt(latestSoldMonth.substring(0, 4), 10);
      const month = parseInt(latestSoldMonth.substring(4, 6), 10);
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      cutoffDate = `${nextYear}/${String(nextMonth).padStart(2, "0")}/01`;
    }

    // ========================================
    // 2. 案件一覧テーブルから受注残データを取得
    //    ビューで売上済フラグ=0, 削除フラグ=0 はフィルター済み
    // ========================================
    const backlogFields = ["製番", "受注金額", "売上見込日", "担当者", "部門", "得意先宛名1", "PJ区分"];

    let backlogRecords: any[] = [];
    let backlogPageToken: string | undefined;

    const backlogStartTime = Date.now();
    do {
      const currentToken = backlogPageToken;
      const response: any = await withRetry(() =>
        client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: BACKLOG_TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: currentToken,
            field_names: JSON.stringify(backlogFields),
            view_id: BACKLOG_VIEW_ID,
          },
        })
      );

      if (response.data?.items) {
        backlogRecords.push(...response.data.items);
      }
      backlogPageToken = response.data?.page_token;
    } while (backlogPageToken);

    console.log(`[sales-orders-combined] Backlog records: ${backlogRecords.length} in ${Date.now() - backlogStartTime}ms`);

    // ========================================
    // 3. 売上データを月別集計
    // ========================================
    const monthlyMap = new Map<number, {
      salesAmount: number;
      salesCount: number;
      orderAmount: number;
      orderCount: number;
    }>();

    let totalSalesAmount = 0;
    let totalSalesCount = 0;

    for (const record of salesRecords) {
      const fields = record.fields as any;
      const uriageDateStr = extractTextValue(fields?.売上日);
      if (!uriageDateStr) continue;

      // 期間内チェックは dateFilter で済んでいるが念のため
      if (!isDateInRange(uriageDateStr, dateRange.start, dateRange.end)) continue;

      const monthIndex = getFiscalMonthIndex(uriageDateStr);
      if (monthIndex < 0 || monthIndex >= 12) continue;

      const amount = parseFloat(String(fields?.金額 || 0)) || 0;

      if (!monthlyMap.has(monthIndex)) {
        monthlyMap.set(monthIndex, { salesAmount: 0, salesCount: 0, orderAmount: 0, orderCount: 0 });
      }
      const m = monthlyMap.get(monthIndex)!;
      m.salesAmount += amount;
      m.salesCount++;
      totalSalesAmount += amount;
      totalSalesCount++;
    }

    // ========================================
    // 4. 受注残データを月別集計 + 不正リスト生成
    // ========================================
    const irregularList: {
      seiban: string;
      customer: string;
      tantousha: string;
      office: string;
      amount: number;
      expectedMonth: string;
      pjCategory: string;
    }[] = [];

    let totalOrderAmount = 0;
    let totalOrderCount = 0;

    for (const record of backlogRecords) {
      const fields = record.fields as any;

      const mikomiDateStr = extractTextValue(fields?.["売上見込日"]);
      if (!mikomiDateStr) continue;

      const mikomiDate = parseDate(mikomiDateStr);
      if (!mikomiDate) continue;

      const amount = parseFloat(String(fields?.["受注金額"] || 0)) || 0;
      const seiban = extractTextValue(fields?.["製番"]);
      const tantousha = extractTextValue(fields?.["担当者"]) || "未設定";
      let eigyosho = fields?.["部門"]
        ? extractOfficeFromDepartment(fields?.["部門"], departmentMap)
        : "未設定";
      if (tantousha === HQ_SALES_PERSON) {
        eigyosho = "本社";
      }
      const customer = extractTextValue(fields?.["得意先宛名1"]);
      const pjCategory = extractTextValue(fields?.["PJ区分"]);

      // 不正リストチェック: 売上見込日 <= 最終売上月（期間に関係なく全受注残が対象）
      if (latestSoldMonth) {
        const { year: mikomiYear, month: mikomiMonth } = getJSTComponents(mikomiDate);
        const mikomiYM = `${mikomiYear}${String(mikomiMonth).padStart(2, "0")}`;
        if (mikomiYM <= latestSoldMonth) {
          irregularList.push({
            seiban,
            customer,
            tantousha,
            office: eigyosho,
            amount,
            expectedMonth: `${mikomiYear}/${String(mikomiMonth).padStart(2, "0")}`,
            pjCategory,
          });
        }
      }

      // 月別集計は期間内のみ
      if (!isDateInRange(mikomiDateStr, dateRange.start, dateRange.end)) continue;

      const monthIndex = getFiscalMonthIndex(mikomiDateStr);
      if (monthIndex < 0 || monthIndex >= 12) continue;

      // 月別集計に加算
      if (!monthlyMap.has(monthIndex)) {
        monthlyMap.set(monthIndex, { salesAmount: 0, salesCount: 0, orderAmount: 0, orderCount: 0 });
      }
      const m = monthlyMap.get(monthIndex)!;
      m.orderAmount += amount;
      m.orderCount++;
      totalOrderAmount += amount;
      totalOrderCount++;
    }

    // ========================================
    // 5. レスポンスデータ生成
    // ========================================
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const data = monthlyMap.get(i);
      return {
        month: FISCAL_MONTHS[i],
        monthIndex: i,
        salesAmount: data?.salesAmount || 0,
        salesCount: data?.salesCount || 0,
        orderAmount: data?.orderAmount || 0,
        orderCount: data?.orderCount || 0,
        totalAmount: (data?.salesAmount || 0) + (data?.orderAmount || 0),
        totalCount: (data?.salesCount || 0) + (data?.orderCount || 0),
      };
    });

    // 累計データ
    let salesCumulative = 0;
    let orderCumulative = 0;
    const cumulativeData = monthlyData.map((m) => {
      salesCumulative += m.salesAmount;
      orderCumulative += m.orderAmount;
      return {
        month: m.month,
        salesCumulative,
        orderCumulative,
        totalCumulative: salesCumulative + orderCumulative,
      };
    });

    // 不正リストを金額降順でソート
    irregularList.sort((a, b) => b.amount - a.amount);

    const result = {
      success: true,
      data: {
        period,
        dateRange,
        latestSoldMonth,
        monthlyData,
        cumulativeData,
        totalSalesAmount,
        totalSalesCount,
        totalOrderAmount,
        totalOrderCount,
        irregularList,
      },
    };

    setCachedData(cacheKey, result);
    return NextResponse.json(result);
  } catch (error: any) {
    const responseData = error?.response?.data;
    const responseStatus = error?.response?.status;
    console.error(`[sales-orders-combined] Error: ${error?.message || error}, HTTP status: ${responseStatus || "N/A"}`);
    if (responseData) {
      console.error("[sales-orders-combined] Response data:", JSON.stringify(responseData).substring(0, 500));
    }
    const detail = responseData
      ? `HTTP ${responseStatus}: ${JSON.stringify(responseData).substring(0, 200)}`
      : (error?.message || String(error));
    return NextResponse.json(
      { error: "受注込データの取得に失敗しました", details: detail },
      { status: 500 }
    );
  }
}
