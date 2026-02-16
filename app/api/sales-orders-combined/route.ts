import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// AWS Amplify SSRでのタイムアウト延長（最大60秒）
export const maxDuration = 60;

// テーブルID（案件一覧）
const TABLE_ID = "tbl1ICzfUixpGqDy";

// 売上情報テーブル（最終売上月取得用）
const SALES_TABLE_ID = "tbl65w6u6J72QFoz";

// 必要なフィールド
const REQUIRED_FIELDS = [
  "製番",
  "受注金額",
  "売上見込日",
  "担当者",
  "部門",
  "得意先",
  "売上済フラグ",
  "削除フラグ",
  "PJ区分",
  "産業分類",
];

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

// リトライ付きでLark API呼び出しを実行
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
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
      const errorCode = error?.code || error?.data?.code;
      if (RETRYABLE_ERROR_CODES.includes(errorCode) && attempt < maxRetries) {
        console.log(`[sales-orders-combined] Retrying after error ${errorCode} (attempt ${attempt + 1}/${maxRetries})...`);
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

// 日付から期の月インデックスを取得（8月=0, 9月=1, ..., 7月=11）
function getFiscalMonthIndex(dateValue: number | string): number {
  const date = typeof dateValue === "number" ? new Date(dateValue) : new Date(dateValue);
  if (isNaN(date.getTime())) return -1;
  const { month } = getJSTComponents(date);
  return month >= 8 ? month - 8 : month + 4;
}

// 日付から期を取得（8月始まり）
function getPeriodFromDate(dateValue: number | string): number {
  const date = typeof dateValue === "number" ? new Date(dateValue) : new Date(dateValue);
  const { year, month } = getJSTComponents(date);
  return month >= 8 ? year - 1975 : year - 1976;
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

// テキスト型の日付文字列をDateオブジェクトに変換
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return null;
  const cleaned = dateStr.trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
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

// 最新売上済月を取得（降順ソートで最新1件のみ取得）
async function getLatestSoldMonth(client: any, baseToken: string): Promise<string> {
  const startTime = Date.now();

  const response: any = await withRetry(() =>
    client.bitable.appTableRecord.list({
      path: {
        app_token: baseToken,
        table_id: SALES_TABLE_ID,
      },
      params: {
        page_size: 1,
        sort: JSON.stringify([{ field_name: "売上日", desc: true }]),
        field_names: JSON.stringify(["売上日"]),
      },
    })
  );

  let latestMonth = "";
  if (response.data?.items && response.data.items.length > 0) {
    const uriageDate = extractTextValue(response.data.items[0].fields?.売上日);
    if (uriageDate) {
      const date = parseDate(uriageDate);
      if (date) {
        latestMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[sales-orders-combined] Found latest sold month: ${latestMonth} in ${elapsed}ms`);
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

    // 最新売上済月を取得
    const latestSoldMonth = await getLatestSoldMonth(client, baseToken);

    // 案件一覧から全レコードを取得（フィルターなし、API側で分類）
    let allRecords: any[] = [];
    let pageToken: string | undefined;

    const fetchStartTime = Date.now();
    do {
      const response: any = await withRetry(() =>
        client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: pageToken,
            field_names: JSON.stringify(REQUIRED_FIELDS),
          },
        })
      );

      if (response.data?.items) {
        allRecords.push(...response.data.items);
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    const fetchElapsed = Date.now() - fetchStartTime;
    console.log(`[sales-orders-combined] Fetched ${allRecords.length} records in ${fetchElapsed}ms`);

    // 月別集計
    const monthlyMap = new Map<number, {
      salesAmount: number;
      salesCount: number;
      orderAmount: number;
      orderCount: number;
    }>();

    // 不正リスト
    const irregularList: {
      seiban: string;
      customer: string;
      tantousha: string;
      office: string;
      amount: number;
      expectedMonth: string;
      pjCategory: string;
    }[] = [];

    let totalSalesAmount = 0;
    let totalSalesCount = 0;
    let totalOrderAmount = 0;
    let totalOrderCount = 0;

    for (const record of allRecords) {
      const fields = record.fields as any;

      // 削除フラグチェック
      const deleteFlag = fields?.["削除フラグ"];
      if (deleteFlag === true || deleteFlag === "true") continue;

      // 売上見込日
      const mikomiDateStr = extractTextValue(fields?.["売上見込日"]);
      if (!mikomiDateStr) continue;

      const mikomiDate = parseDate(mikomiDateStr);
      if (!mikomiDate) continue;

      // 期間フィルタ
      const recordPeriod = getPeriodFromDate(mikomiDate.getTime());
      if (recordPeriod !== period) continue;

      const monthIndex = getFiscalMonthIndex(mikomiDate.getTime());
      if (monthIndex < 0 || monthIndex >= 12) continue;

      const amount = parseFloat(String(fields?.["受注金額"] || 0)) || 0;
      const isSold = fields?.["売上済フラグ"] === true || fields?.["売上済フラグ"] === "true";

      const seiban = extractTextValue(fields?.["製番"]);
      const tantousha = extractTextValue(fields?.["担当者"]) || "未設定";
      let eigyosho = fields?.["部門"]
        ? extractOfficeFromDepartment(fields?.["部門"], departmentMap)
        : "未設定";
      if (tantousha === HQ_SALES_PERSON) {
        eigyosho = "本社";
      }
      const customer = extractTextValue(fields?.["得意先"]);
      const pjCategory = extractTextValue(fields?.["PJ区分"]);

      // 月別集計に加算
      if (!monthlyMap.has(monthIndex)) {
        monthlyMap.set(monthIndex, { salesAmount: 0, salesCount: 0, orderAmount: 0, orderCount: 0 });
      }
      const m = monthlyMap.get(monthIndex)!;

      if (isSold) {
        m.salesAmount += amount;
        m.salesCount++;
        totalSalesAmount += amount;
        totalSalesCount++;
      } else {
        m.orderAmount += amount;
        m.orderCount++;
        totalOrderAmount += amount;
        totalOrderCount++;

        // 不正リストチェック: 受注残で売上見込日の月 < 最終売上月
        if (latestSoldMonth) {
          const mikomiYear = mikomiDate.getFullYear();
          const mikomiMonth = mikomiDate.getMonth() + 1;
          const mikomiYM = `${mikomiYear}${String(mikomiMonth).padStart(2, "0")}`;
          if (mikomiYM < latestSoldMonth) {
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
      }
    }

    // 月別データ配列を生成
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
  } catch (error) {
    console.error("[sales-orders-combined] Error:", error);
    return NextResponse.json(
      { error: "受注込データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
