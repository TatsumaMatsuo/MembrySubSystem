import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, getLarkBaseToken } from "@/lib/lark-client";

// 予算テーブルID
const BUDGET_TABLE_ID = "tblkWi7igpAzTzl9";

// 予算データの型定義
interface BudgetData {
  period: number;
  office: string;
  salesPerson?: string;
  monthlyBudget: number[];  // 12ヶ月分の予算（8月〜7月）
  yearlyBudget: number;
  quarterlyBudget: number[];
}

// シンプルなインメモリキャッシュ（TTL: 5分）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

// 月名配列（8月始まり）
const FISCAL_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

// 日付から期の月インデックスを取得（8月=0, 9月=1, ..., 7月=11）
function getFiscalMonthIndex(dateValue: number | string): number {
  let date: Date;
  if (typeof dateValue === "number") {
    // Larkのタイムスタンプ（ミリ秒）
    date = new Date(dateValue);
  } else {
    date = new Date(dateValue);
  }
  const month = date.getMonth() + 1; // 1-12
  return month >= 8 ? month - 8 : month + 4;
}

// 日付から期を取得（8月始まり）
function getPeriodFromDate(dateValue: number | string): number {
  let date: Date;
  if (typeof dateValue === "number") {
    date = new Date(dateValue);
  } else {
    date = new Date(dateValue);
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  // 8月以降は year - 1975、1-7月は year - 1976
  return month >= 8 ? year - 1975 : year - 1976;
}

// 予算データを取得してパース
async function fetchBudgetData(): Promise<any[]> {
  const cacheKey = "budget_data";
  const cached = getCachedData(cacheKey);
  if (cached) {
    return cached;
  }

  const allRecords: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await getBaseRecords(BUDGET_TABLE_ID, {
      pageSize: 500,
      pageToken,
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0 && response.data?.items) {
      allRecords.push(...response.data.items);
      pageToken = response.data.has_more ? response.data.page_token : undefined;
    } else {
      console.error("[sales-budget] Error fetching budget data:", response);
      break;
    }
  } while (pageToken);

  console.log(`[sales-budget] Fetched ${allRecords.length} budget records`);
  setCachedData(cacheKey, allRecords);
  return allRecords;
}

// GET: 予算データ取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || "50", 10);
  const office = searchParams.get("office") || "全社";
  const salesPerson = searchParams.get("salesPerson") || "";

  try {
    const records = await fetchBudgetData();

    // 期間でフィルタ
    const filteredRecords = records.filter((record) => {
      const budgetMonth = record.fields["予算月"];
      if (!budgetMonth) return false;
      const recordPeriod = getPeriodFromDate(budgetMonth);
      return recordPeriod === period;
    });

    console.log(`[sales-budget] Period ${period}: ${filteredRecords.length} records`);

    // 集計用マップ（月別）
    const monthlyTotals: number[] = Array(12).fill(0);
    const officeMonthlyTotals: Map<string, number[]> = new Map();
    const salesPersonMonthlyTotals: Map<string, { office: string; monthly: number[] }> = new Map();

    for (const record of filteredRecords) {
      const budgetMonth = record.fields["予算月"];
      const recordOffice = record.fields["商談 所有者: 部署"] || "不明";
      const recordSalesPerson = record.fields["社員名"] || "";
      const amount = parseFloat(String(record.fields["金額"] || 0)) || 0;
      const monthIndex = getFiscalMonthIndex(budgetMonth);

      if (monthIndex < 0 || monthIndex >= 12) continue;

      // 全社合計
      monthlyTotals[monthIndex] += amount;

      // 営業所別
      if (!officeMonthlyTotals.has(recordOffice)) {
        officeMonthlyTotals.set(recordOffice, Array(12).fill(0));
      }
      officeMonthlyTotals.get(recordOffice)![monthIndex] += amount;

      // 担当者別
      if (recordSalesPerson) {
        if (!salesPersonMonthlyTotals.has(recordSalesPerson)) {
          salesPersonMonthlyTotals.set(recordSalesPerson, { office: recordOffice, monthly: Array(12).fill(0) });
        }
        salesPersonMonthlyTotals.get(recordSalesPerson)!.monthly[monthIndex] += amount;
      }
    }

    // 要求されたデータを返す
    let monthlyBudget: number[];
    let targetOffice = office;
    let targetSalesPerson = salesPerson;

    if (salesPerson && salesPersonMonthlyTotals.has(salesPerson)) {
      // 担当者指定
      monthlyBudget = salesPersonMonthlyTotals.get(salesPerson)!.monthly;
      targetOffice = salesPersonMonthlyTotals.get(salesPerson)!.office;
    } else if (office === "全社") {
      // 全社合計
      monthlyBudget = monthlyTotals;
    } else if (officeMonthlyTotals.has(office)) {
      // 営業所指定
      monthlyBudget = officeMonthlyTotals.get(office)!;
    } else {
      // 該当なし - ゼロ配列
      monthlyBudget = Array(12).fill(0);
    }

    const yearlyBudget = monthlyBudget.reduce((a, b) => a + b, 0);
    const quarterlyBudget = [
      monthlyBudget.slice(0, 3).reduce((a, b) => a + b, 0),  // Q1: 8-10月
      monthlyBudget.slice(3, 6).reduce((a, b) => a + b, 0),  // Q2: 11-1月
      monthlyBudget.slice(6, 9).reduce((a, b) => a + b, 0),  // Q3: 2-4月
      monthlyBudget.slice(9, 12).reduce((a, b) => a + b, 0), // Q4: 5-7月
    ];

    // 営業所別・担当者別サマリーも返す
    const officeBudgets = Array.from(officeMonthlyTotals.entries()).map(([name, monthly]) => ({
      office: name,
      monthlyBudget: monthly,
      yearlyBudget: monthly.reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.yearlyBudget - a.yearlyBudget);

    const salesPersonBudgets = Array.from(salesPersonMonthlyTotals.entries()).map(([name, data]) => ({
      salesPerson: name,
      office: data.office,
      monthlyBudget: data.monthly,
      yearlyBudget: data.monthly.reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.yearlyBudget - a.yearlyBudget);

    return NextResponse.json({
      success: true,
      data: {
        period,
        office: targetOffice,
        salesPerson: targetSalesPerson || undefined,
        monthlyBudget,
        yearlyBudget,
        quarterlyBudget,
        monthlyBudgetWithLabels: FISCAL_MONTHS.map((month, i) => ({
          month,
          budget: monthlyBudget[i],
        })),
        // 全体サマリー
        totalBudget: monthlyTotals.reduce((a, b) => a + b, 0),
        officeBudgets,
        salesPersonBudgets,
      },
    });
  } catch (error) {
    console.error("[sales-budget] Error:", error);
    return NextResponse.json(
      { success: false, error: "予算データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
