import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

// テーブルID（製番原価データ）
const TABLE_ID = "tbl7lMDstBVYxQKd";

// 期から日付範囲を計算（期初は8月）
// 50期 = 2026/08/01 ～ 2027/07/31
function getPeriodDateRange(period: number): { start: string; end: string } {
  // 50期 = 2026年度 → 開始年 = 50 + 1976 = 2026
  const startYear = period + 1976;
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
  const month = now.getMonth() + 1; // 1-12
  // 8月以降は当年の期、7月以前は前年の期
  if (month >= 8) {
    return year - 1976;
  } else {
    return year - 1977;
  }
}

// 月名を取得（8月始まり）
function getFiscalMonthName(monthIndex: number): string {
  const months = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
  return months[monthIndex];
}

// 日付文字列から期内の月インデックスを取得（8月=0, 9月=1, ..., 7月=11）
function getFiscalMonthIndex(dateStr: string): number {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return -1;
  const parts = dateStr.split("/");
  if (parts.length < 2) return -1;
  const month = parseInt(parts[1], 10);
  if (isNaN(month)) return -1;
  // 8月=0, 9月=1, ..., 12月=4, 1月=5, ..., 7月=11
  return month >= 8 ? month - 8 : month + 4;
}

interface SalesRecord {
  fields: {
    製番?: string;
    受注日?: string;
    完成日?: string;
    受注金額?: string | number;
    PJ区分?: string;
    得意先?: string;
    担当者?: string;
    状態?: string;
    [key: string]: any;
  };
}

interface PJCategorySummary {
  category: string;
  count: number;
  amount: number;
  monthlyData: { month: string; count: number; amount: number }[];
}

interface PeriodSummary {
  period: number;
  dateRange: { start: string; end: string };
  totalCount: number;
  totalAmount: number;
  pjCategories: PJCategorySummary[];
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fromPeriod = parseInt(searchParams.get("fromPeriod") || String(getCurrentPeriod()), 10);
  const toPeriod = parseInt(searchParams.get("toPeriod") || String(getCurrentPeriod()), 10);

  try {
    const results: PeriodSummary[] = [];

    for (let period = fromPeriod; period <= toPeriod; period++) {
      const dateRange = getPeriodDateRange(period);

      // Lark Baseからデータ取得（ページネーション対応）
      let allRecords: SalesRecord[] = [];
      let pageToken: string | undefined;

      do {
        const response = await client.bitable.appTableRecord.list({
          path: {
            app_token: getLarkBaseToken(),
            table_id: TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: pageToken,
          },
        });

        if (response.data?.items) {
          allRecords = allRecords.concat(response.data.items as SalesRecord[]);
        }
        pageToken = response.data?.page_token;
      } while (pageToken);

      // 期間でフィルタリング（受注日ベース）
      const periodRecords = allRecords.filter((record) => {
        const juchuDate = record.fields.受注日;
        if (!juchuDate || juchuDate.trim() === "" || juchuDate === "　") return false;
        return juchuDate >= dateRange.start && juchuDate <= dateRange.end;
      });

      // PJ区分別に集計
      const pjCategoryMap = new Map<string, {
        count: number;
        amount: number;
        monthlyData: Map<number, { count: number; amount: number }>;
      }>();

      periodRecords.forEach((record) => {
        // PJ区分がオブジェクト形式の場合はテキストを抽出
        let pjCategory = "未分類";
        const rawPjCategory = record.fields.PJ区分;
        if (rawPjCategory) {
          if (typeof rawPjCategory === "string") {
            pjCategory = rawPjCategory.trim() || "未分類";
          } else if (Array.isArray(rawPjCategory) && rawPjCategory.length > 0) {
            // 配列形式の場合（単一選択フィールド）
            const first = rawPjCategory[0];
            if (typeof first === "object" && first.text) {
              pjCategory = first.text;
            } else if (typeof first === "string") {
              pjCategory = first;
            }
          } else if (typeof rawPjCategory === "object" && (rawPjCategory as any).text) {
            pjCategory = (rawPjCategory as any).text;
          }
        }
        const amount = parseFloat(String(record.fields.受注金額 || 0)) || 0;
        const monthIndex = getFiscalMonthIndex(record.fields.受注日 || "");

        if (!pjCategoryMap.has(pjCategory)) {
          pjCategoryMap.set(pjCategory, {
            count: 0,
            amount: 0,
            monthlyData: new Map(),
          });
        }

        const category = pjCategoryMap.get(pjCategory)!;
        category.count++;
        category.amount += amount;

        if (monthIndex >= 0) {
          if (!category.monthlyData.has(monthIndex)) {
            category.monthlyData.set(monthIndex, { count: 0, amount: 0 });
          }
          const monthly = category.monthlyData.get(monthIndex)!;
          monthly.count++;
          monthly.amount += amount;
        }
      });

      // 集計結果を配列に変換
      const pjCategories: PJCategorySummary[] = Array.from(pjCategoryMap.entries())
        .map(([category, data]) => ({
          category,
          count: data.count,
          amount: data.amount,
          monthlyData: Array.from({ length: 12 }, (_, i) => ({
            month: getFiscalMonthName(i),
            count: data.monthlyData.get(i)?.count || 0,
            amount: data.monthlyData.get(i)?.amount || 0,
          })),
        }))
        .sort((a, b) => b.amount - a.amount);

      results.push({
        period,
        dateRange,
        totalCount: periodRecords.length,
        totalAmount: periodRecords.reduce(
          (sum, r) => sum + (parseFloat(String(r.fields.受注金額 || 0)) || 0),
          0
        ),
        pjCategories,
      });
    }

    return NextResponse.json({
      success: true,
      currentPeriod: getCurrentPeriod(),
      data: results,
    });
  } catch (error) {
    console.error("Sales analysis error:", error);
    return NextResponse.json(
      { error: "売上分析データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
