import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, getTableFields } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

// AWS Amplify SSRでのタイムアウト延長
export const maxDuration = 60;

// インメモリキャッシュ（TTL: 10分）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

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
// 50期 = 2025/08/01 〜 2026/07/31
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
  return months[monthIndex] || "";
}

// テキスト型の日付文字列をDateオブジェクトに変換
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return null;
  // タイムスタンプ（ミリ秒）の場合
  if (/^\d{13}$/.test(dateStr)) {
    return new Date(parseInt(dateStr, 10));
  }
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
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.text) return first.text;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.text) return value.text;
  return String(value);
}

// 数値を抽出
function extractNumber(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const str = extractTextValue(value).replace(/[,、円¥]/g, "");
  return parseFloat(str) || 0;
}

// 日付を抽出（タイムスタンプ対応）
function extractDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    // Larkのタイムスタンプはミリ秒
    return new Date(value);
  }
  return parseDate(extractTextValue(value));
}

// 日付が範囲内かどうかを判定
function isDateInRange(date: Date | null, startStr: string, endStr: string): boolean {
  if (!date) return false;
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return false;
  return date >= start && date <= end;
}

// 日付から期内の月インデックスを取得（8月=0, 9月=1, ... 7月=11）
function getFiscalMonthIndex(date: Date): number {
  const month = date.getMonth() + 1; // 1-12
  return month >= 8 ? month - 8 : month + 4;
}

// 四半期を取得（Q1: 8-10月, Q2: 11-1月, Q3: 2-4月, Q4: 5-7月）
function getQuarter(monthIndex: number): number {
  if (monthIndex <= 2) return 1;
  if (monthIndex <= 5) return 2;
  if (monthIndex <= 8) return 3;
  return 4;
}

// コピー経費テーブルのフィールド定義（確定済み）
// テーブル: tblAewkgMf7ZmEUv
// フィールド: 年月(DateTime), 事業所(Text), 印刷種別(SingleSelect), 印刷枚数(Number), 単価(Formula), 金額(Number)
const COPY_EXPENSE_FIELDS = {
  dateField: "年月",
  amountField: "金額",
  descriptionField: null as string | null, // 摘要フィールドなし
  categoryField: "印刷種別",
  departmentField: "事業所",
  countField: "印刷枚数",
  unitPriceField: "単価",
};

interface FieldMapping {
  dateField: string | null;
  amountField: string | null;
  descriptionField: string | null;
  categoryField: string | null;
  departmentField: string | null;
  countField: string | null;
  unitPriceField: string | null;
  allFields: string[];
}

function getFieldMapping(fields: any[]): FieldMapping {
  return {
    ...COPY_EXPENSE_FIELDS,
    allFields: fields.map((f: any) => f.field_name),
  };
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || String(getCurrentPeriod()), 10);
  const noCache = searchParams.get("noCache") === "true";
  const discover = searchParams.get("discover") === "true";

  const tables = getLarkTables();
  const tableId = tables.COPY_EXPENSE;
  const baseToken = getLarkBaseToken();

  // discover mode: フィールドメタデータ返却
  if (discover) {
    try {
      const response = await getTableFields(tableId, baseToken);
      const fields = response.data?.items || [];
      const mapping = getFieldMapping(fields);
      return NextResponse.json({
        tableId,
        fieldMapping: mapping,
        fields: fields.map((f: any) => ({
          field_name: f.field_name,
          type: f.type,
          property: f.property,
        })),
      });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  // データ取得モード
  const cacheKey = `copy-expense:${period}`;
  if (!noCache) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
  }

  try {
    // フィールドマッピング（ハードコード済み）
    const fieldMapping: FieldMapping = {
      ...COPY_EXPENSE_FIELDS,
      allFields: ["年月", "事業所", "印刷種別", "印刷枚数", "単価", "金額"],
    };

    console.log(`[copy-expense] Field mapping:`, fieldMapping);

    const dateRange = getPeriodDateRange(period);
    let allRecords: any[] = [];
    let pageToken: string | undefined;

    // ページネーションでレコードを全件取得
    const startFetchTime = Date.now();
    do {
      const currentPageToken = pageToken;
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: tableId,
        },
        params: {
          page_size: 500,
          page_token: currentPageToken,
        },
      });

      // Lark APIエラーチェック
      if (response.code !== 0) {
        console.error(`[copy-expense] Lark API error:`, { code: response.code, msg: response.msg });
        return NextResponse.json({
          error: `Lark APIエラー: code=${response.code}, msg=${response.msg}`,
          tableId,
        }, { status: 500 });
      }

      if (response.data?.items) {
        allRecords.push(...response.data.items);
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[copy-expense] Fetched ${allRecords.length} records in ${Date.now() - startFetchTime}ms`);

    // 期間でフィルタリング
    const periodRecords = allRecords.filter((record: any) => {
      const fields = record.fields;
      if (!fieldMapping.dateField) return true; // 日付フィールドが不明なら全件
      const dateVal = fields[fieldMapping.dateField];
      const date = extractDate(dateVal);
      return isDateInRange(date, dateRange.start, dateRange.end);
    });

    console.log(`[copy-expense] Period ${period} records: ${periodRecords.length}`);

    // 集計
    let totalExpense = 0;
    let totalSheets = 0;
    let totalCount = periodRecords.length;
    const monthlyMap = new Map<number, { count: number; amount: number; sheets: number }>();
    const quarterlyMap = new Map<number, { count: number; amount: number; sheets: number }>();
    const records: any[] = [];

    for (const record of periodRecords) {
      const fields = record.fields;
      const amount = fieldMapping.amountField ? extractNumber(fields[fieldMapping.amountField]) : 0;
      const sheets = fieldMapping.countField ? extractNumber(fields[fieldMapping.countField]) : 0;
      const dateVal = fieldMapping.dateField ? fields[fieldMapping.dateField] : null;
      const date = extractDate(dateVal);
      const category = fieldMapping.categoryField ? extractTextValue(fields[fieldMapping.categoryField]) : "";
      const department = fieldMapping.departmentField ? extractTextValue(fields[fieldMapping.departmentField]) : "";

      totalExpense += amount;
      totalSheets += sheets;

      if (date) {
        const monthIndex = getFiscalMonthIndex(date);
        const quarter = getQuarter(monthIndex);

        // 月次集計
        if (!monthlyMap.has(monthIndex)) {
          monthlyMap.set(monthIndex, { count: 0, amount: 0, sheets: 0 });
        }
        const m = monthlyMap.get(monthIndex)!;
        m.count++;
        m.amount += amount;
        m.sheets += sheets;

        // 四半期集計
        if (!quarterlyMap.has(quarter)) {
          quarterlyMap.set(quarter, { count: 0, amount: 0, sheets: 0 });
        }
        const q = quarterlyMap.get(quarter)!;
        q.count++;
        q.amount += amount;
        q.sheets += sheets;

        records.push({
          date: date.toISOString().substring(0, 10),
          month: getFiscalMonthName(monthIndex),
          amount,
          sheets,
          category,
          department,
        });
      } else {
        records.push({
          date: null,
          month: null,
          amount,
          sheets,
          category,
          department,
        });
      }
    }

    // 月次データ配列化
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: getFiscalMonthName(i),
      monthIndex: i,
      count: monthlyMap.get(i)?.count || 0,
      amount: monthlyMap.get(i)?.amount || 0,
      sheets: monthlyMap.get(i)?.sheets || 0,
    }));

    // 四半期データ配列化
    const quarterlyData = [1, 2, 3, 4].map((q) => ({
      quarter: `Q${q}`,
      count: quarterlyMap.get(q)?.count || 0,
      amount: quarterlyMap.get(q)?.amount || 0,
      sheets: quarterlyMap.get(q)?.sheets || 0,
    }));

    // 月間平均
    const monthsWithData = monthlyData.filter((m) => m.count > 0).length;
    const monthlyAverage = monthsWithData > 0 ? totalExpense / monthsWithData : 0;

    // 最高月
    const maxMonth = monthlyData.reduce(
      (max, m) => (m.amount > max.amount ? m : max),
      { month: "-", amount: 0, monthIndex: -1, count: 0, sheets: 0 }
    );

    const responseData = {
      success: true,
      period,
      currentPeriod: getCurrentPeriod(),
      dateRange,
      totalExpense,
      totalCount,
      totalSheets,
      monthlyAverage,
      maxMonth: { month: maxMonth.month, amount: maxMonth.amount },
      monthlyData,
      quarterlyData,
      records: records.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      }),
    };

    setCachedData(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[copy-expense] Error:", error);
    const details = error?.message || error?.msg || String(error);
    const stack = error?.stack?.split("\n").slice(0, 5).join("\n");
    return NextResponse.json(
      {
        error: "コピー経費データの取得に失敗しました",
        details,
        stack: process.env.NODE_ENV === "development" ? stack : undefined,
        tableId,
        baseToken: baseToken.substring(0, 8) + "...",
      },
      { status: 500 }
    );
  }
}
