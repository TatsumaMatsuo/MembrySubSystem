import { NextRequest, NextResponse } from "next/server";

// 予算データの型定義
interface BudgetEntry {
  period: number;
  office: string;  // 営業所名 or "全社"
  monthlyBudget: number[];  // 12ヶ月分の予算（8月〜7月）
  yearlyBudget: number;  // 年間予算
}

// インメモリ予算ストレージ（本番環境ではDB保存推奨）
const budgetStorage = new Map<string, BudgetEntry>();

// 予算キー生成
function getBudgetKey(period: number, office: string): string {
  return `${period}:${office}`;
}

// 月名配列（8月始まり）
const FISCAL_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

// デフォルト予算データ（初期値）
const DEFAULT_BUDGETS: Record<string, number> = {
  "全社": 1000000000,  // 10億
  "東京営業所": 300000000,
  "大阪営業所": 200000000,
  "名古屋営業所": 150000000,
  "福岡営業所": 100000000,
  "仙台営業所": 80000000,
  "北関東営業所": 70000000,
  "北九州営業所": 50000000,
  "佐賀営業所": 30000000,
  "八女営業所": 20000000,
  "宮崎営業所": 20000000,
  "本社": 100000000,
};

// 予算を均等に12ヶ月に分配
function distributeYearlyBudget(yearlyBudget: number): number[] {
  const monthlyBase = Math.floor(yearlyBudget / 12);
  const remainder = yearlyBudget - (monthlyBase * 12);
  const monthly = Array(12).fill(monthlyBase);
  // 余りは最初の月に加算
  monthly[0] += remainder;
  return monthly;
}

// GET: 予算データ取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || "50", 10);
  const office = searchParams.get("office") || "全社";

  const key = getBudgetKey(period, office);
  let budget = budgetStorage.get(key);

  // 予算がない場合はデフォルト値を返す
  if (!budget) {
    const defaultYearly = DEFAULT_BUDGETS[office] || 50000000;
    budget = {
      period,
      office,
      monthlyBudget: distributeYearlyBudget(defaultYearly),
      yearlyBudget: defaultYearly,
    };
  }

  // 四半期予算も計算
  const quarterlyBudget = [
    budget.monthlyBudget.slice(0, 3).reduce((a, b) => a + b, 0),  // Q1: 8-10月
    budget.monthlyBudget.slice(3, 6).reduce((a, b) => a + b, 0),  // Q2: 11-1月
    budget.monthlyBudget.slice(6, 9).reduce((a, b) => a + b, 0),  // Q3: 2-4月
    budget.monthlyBudget.slice(9, 12).reduce((a, b) => a + b, 0), // Q4: 5-7月
  ];

  return NextResponse.json({
    success: true,
    data: {
      ...budget,
      quarterlyBudget,
      monthlyBudgetWithLabels: FISCAL_MONTHS.map((month, i) => ({
        month,
        budget: budget!.monthlyBudget[i],
      })),
    },
  });
}

// POST: 予算データ保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, office, monthlyBudget, yearlyBudget } = body;

    if (!period || !office) {
      return NextResponse.json(
        { success: false, error: "期と営業所は必須です" },
        { status: 400 }
      );
    }

    let finalMonthlyBudget: number[];
    let finalYearlyBudget: number;

    if (monthlyBudget && Array.isArray(monthlyBudget) && monthlyBudget.length === 12) {
      // 月次予算が指定された場合
      finalMonthlyBudget = monthlyBudget.map(Number);
      finalYearlyBudget = finalMonthlyBudget.reduce((a, b) => a + b, 0);
    } else if (yearlyBudget) {
      // 年間予算のみ指定された場合は均等分配
      finalYearlyBudget = Number(yearlyBudget);
      finalMonthlyBudget = distributeYearlyBudget(finalYearlyBudget);
    } else {
      return NextResponse.json(
        { success: false, error: "月次予算または年間予算を指定してください" },
        { status: 400 }
      );
    }

    const key = getBudgetKey(period, office);
    const budgetEntry: BudgetEntry = {
      period,
      office,
      monthlyBudget: finalMonthlyBudget,
      yearlyBudget: finalYearlyBudget,
    };

    budgetStorage.set(key, budgetEntry);

    return NextResponse.json({
      success: true,
      message: "予算を保存しました",
      data: budgetEntry,
    });
  } catch (error) {
    console.error("Budget save error:", error);
    return NextResponse.json(
      { success: false, error: "予算の保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 予算データ削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || "0", 10);
  const office = searchParams.get("office") || "";

  if (!period || !office) {
    return NextResponse.json(
      { success: false, error: "期と営業所は必須です" },
      { status: 400 }
    );
  }

  const key = getBudgetKey(period, office);
  const deleted = budgetStorage.delete(key);

  return NextResponse.json({
    success: true,
    message: deleted ? "予算を削除しました" : "予算が見つかりませんでした",
  });
}
