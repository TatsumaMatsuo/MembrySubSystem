"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
  Target,
  MapPin,
  Building2,
  Users,
  User,
  Filter,
  ChevronDown,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Loader2,
  ChevronUp,
} from "lucide-react";

// 型定義
interface DimensionSummary {
  name: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface MonthlyData {
  month: string;
  monthIndex: number;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface QuarterlyData {
  quarter: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface RegionSummary {
  region: string;
  regionKey: "east" | "west" | "hq";
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
  offices: DimensionSummary[];
}

interface SalesPersonSummary {
  name: string;
  office: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
  monthlyData: MonthlyData[];
}

interface OfficeSalesPersons {
  office: string;
  salesPersons: string[];
}

interface PeriodDashboard {
  period: number;
  dateRange: { start: string; end: string };
  totalCount: number;
  totalAmount: number;
  totalCost: number;     // 原価合計
  totalProfit: number;   // 粗利合計
  monthlyData: MonthlyData[];
  quarterlyData: QuarterlyData[];
  cumulativeData: MonthlyData[];
  regionSummary: RegionSummary[];
  officeSummary: DimensionSummary[];
  pjCategorySummary: DimensionSummary[];
  industrySummary: DimensionSummary[];
  prefectureSummary: DimensionSummary[];
  webNewSummary: DimensionSummary[];
  salesPersonSummary: SalesPersonSummary[];
  officeSalesPersons: OfficeSalesPersons[];
}

interface OfficeBudget {
  office: string;
  monthlyBudget: number[];
  yearlyBudget: number;
}

interface SalesPersonBudget {
  salesPerson: string;
  office: string;
  monthlyBudget: number[];
  yearlyBudget: number;
}

interface BudgetData {
  period: number;
  office: string;
  monthlyBudget: number[];
  yearlyBudget: number;
  quarterlyBudget: number[];
  totalBudget: number;
  officeBudgets: OfficeBudget[];
  salesPersonBudgets: SalesPersonBudget[];
}

// 全社KPI型定義
interface CompanyKPIData {
  recordId?: string;
  period: number;
  salesTarget: number;
  monthlySalesTarget: number;
  costOfSales: number;
  costOfSalesRate: number;
  sgaExpenses: number;
  sgaRate: number;
  operatingIncome: number;
  operatingIncomeRate: number;
  variableCost: number;
  variableCostRate: number;
  marginalProfit: number;
  marginalProfitRate: number;
  fixedCost: number;
  fixedCostRate: number;
  ordinaryIncome: number;
  ordinaryIncomeRate: number;
  manufacturingCostRate: number;
  executionBudgetRate: number;
  outsourcingRate: number;
  headcountPlan: number;
  capitalInvestment: number;
  advertisingBudget: number;
  notes: string;
}

// カラーパレット（Tableau風）
const COLORS = {
  primary: "#4e79a7",
  secondary: "#f28e2c",
  tertiary: "#e15759",
  quaternary: "#76b7b2",
  quinary: "#59a14f",
  senary: "#edc949",
  septenary: "#af7aa1",
  octonary: "#ff9da7",
  nonary: "#9c755f",
  denary: "#bab0ab",
  // 積み上げグラフ用
  profit: "#22c55e",   // 粗利（緑）
  cost: "#f97316",     // 原価（オレンジ）
  budget: "#8b5cf6",   // 予算（紫）
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.tertiary,
  COLORS.quaternary,
  COLORS.quinary,
  COLORS.senary,
  COLORS.septenary,
  COLORS.octonary,
  COLORS.nonary,
  COLORS.denary,
];

const REGION_COLORS = {
  east: "#4e79a7",
  west: "#f28e2c",
  hq: "#59a14f",
};

// 金額フォーマット
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}億`;
  } else if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}千万`;
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}万`;
  }
  return amount.toLocaleString();
}

// パーセント変化を計算
function calcChange(current: number, previous: number): { value: number; trend: "up" | "down" | "flat" } {
  if (previous === 0) return { value: 0, trend: "flat" };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    trend: change > 1 ? "up" : change < -1 ? "down" : "flat",
  };
}

// タブ定義
type TabType = "overview" | "region" | "office" | "salesperson" | "category" | "industry" | "budget";

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "概要", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "region", label: "エリア別", icon: <MapPin className="w-4 h-4" /> },
  { id: "office", label: "営業所別", icon: <Building2 className="w-4 h-4" /> },
  { id: "salesperson", label: "担当者別", icon: <User className="w-4 h-4" /> },
  { id: "category", label: "PJ区分別", icon: <Filter className="w-4 h-4" /> },
  { id: "industry", label: "産業別", icon: <Users className="w-4 h-4" /> },
  { id: "budget", label: "予実管理", icon: <Target className="w-4 h-4" /> },
];

// KPIカードコンポーネント
function KPICard({
  title,
  value,
  unit,
  change,
  changeLabel,
  icon,
  color = "emerald",
  budgetAmount,
  actualAmount,
  ytdBudgetAmount,
  ytdActualAmount,
  ytdLabel,
  targetRate,
  actualRate,
  avgUnitPrices,
}: {
  title: string;
  value: string;
  unit?: string;
  change?: { value: number; trend: "up" | "down" | "flat" };
  changeLabel?: string;
  icon: React.ReactNode;
  color?: string;
  budgetAmount?: number;
  actualAmount?: number;
  ytdBudgetAmount?: number;
  ytdActualAmount?: number;
  ytdLabel?: string;
  targetRate?: number;
  actualRate?: number;
  avgUnitPrices?: { period: number; value: number }[];
}) {
  const colorClasses = {
    emerald: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-indigo-500",
    purple: "from-purple-500 to-pink-500",
    orange: "from-orange-500 to-amber-500",
  };

  // 年度予算進捗率
  const progressRate = budgetAmount && actualAmount ? (actualAmount / budgetAmount) * 100 : 0;
  // YTD予算進捗率（実績がある月までの累計）
  const ytdProgressRate = ytdBudgetAmount && ytdActualAmount ? (ytdActualAmount / ytdBudgetAmount) * 100 : 0;
  // 目標率との差
  const rateDiff = targetRate !== undefined && actualRate !== undefined ? actualRate - targetRate : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.emerald}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {unit && <span className="text-sm text-gray-500 mb-1">{unit}</span>}
      </div>
      {budgetAmount !== undefined && budgetAmount > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
          {/* 年度予算進捗 */}
          <div>
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span>年度予算: {formatAmount(budgetAmount)}円</span>
              <span className={`font-bold ${progressRate >= 100 ? "text-green-600" : progressRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                進捗 {progressRate.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressRate >= 100 ? "bg-green-500" : progressRate >= 80 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(progressRate, 100)}%` }}
              />
            </div>
          </div>
          {/* YTD予算進捗（実績がある月まで） */}
          {ytdBudgetAmount !== undefined && ytdBudgetAmount > 0 && (
            <div>
              <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                <span>累計予算{ytdLabel ? `（${ytdLabel}まで）` : ""}: {formatAmount(ytdBudgetAmount)}円</span>
                <span className={`font-bold ${ytdProgressRate >= 100 ? "text-green-600" : ytdProgressRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                  進捗 {ytdProgressRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ytdProgressRate >= 100 ? "bg-green-500" : ytdProgressRate >= 80 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(ytdProgressRate, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      {/* 目標率との比較（粗利率用） */}
      {targetRate !== undefined && targetRate > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">目標: {targetRate.toFixed(1)}%</span>
            <span className={`font-bold ${rateDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
              {rateDiff >= 0 ? "+" : ""}{rateDiff.toFixed(1)}pt
            </span>
          </div>
          <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden relative">
            {/* 目標ライン */}
            <div className="absolute h-full w-0.5 bg-purple-600 z-10" style={{ left: `${Math.min(targetRate, 100)}%` }} />
            {/* 実績バー */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                rateDiff >= 0 ? "bg-green-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(actualRate || 0, 100)}%` }}
            />
          </div>
        </div>
      )}
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {change.trend === "up" && <ArrowUpRight className="w-4 h-4 text-green-500" />}
          {change.trend === "down" && <ArrowDownRight className="w-4 h-4 text-red-500" />}
          {change.trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
          <span
            className={`text-sm font-medium ${
              change.trend === "up" ? "text-green-500" : change.trend === "down" ? "text-red-500" : "text-gray-400"
            }`}
          >
            {change.value.toFixed(1)}% {changeLabel || "前年比"}
          </span>
        </div>
      )}
      {/* 3年間平均単価表示 */}
      {avgUnitPrices && avgUnitPrices.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">平均単価（3年間）</div>
          <div className="flex gap-2">
            {avgUnitPrices.map((item, i) => (
              <div key={item.period} className={`flex-1 text-center py-1 rounded ${i === 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                <div className="text-[10px] text-gray-400">{item.period}期</div>
                <div className={`text-xs font-bold ${i === 0 ? "text-orange-600" : "text-gray-600"}`}>
                  {formatAmount(item.value)}円
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 達成率ゲージコンポーネント
function AchievementGauge({ actual, budget, label }: { actual: number; budget: number; label: string }) {
  const rate = budget > 0 ? (actual / budget) * 100 : 0;
  const displayRate = Math.min(rate, 150); // 150%上限で表示

  const getColor = (r: number) => {
    if (r >= 100) return "#22c55e";
    if (r >= 80) return "#eab308";
    if (r >= 60) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-lg font-bold" style={{ color: getColor(rate) }}>
          {rate.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(displayRate, 100)}%`,
            backgroundColor: getColor(rate),
          }}
        />
        {/* 100%ライン */}
        <div className="absolute h-full w-0.5 bg-gray-800 opacity-50" style={{ left: `${100 * (100 / 150)}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>実績: {formatAmount(actual)}円</span>
        <span>予算: {formatAmount(budget)}円</span>
      </div>
    </div>
  );
}

export default function BIDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodDashboard[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [selectedPeriod, setSelectedPeriod] = useState(50);
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [companyKPI, setCompanyKPI] = useState<CompanyKPIData | null>(null);

  // 営業担当者フィルター
  const [selectedOffice, setSelectedOffice] = useState<string>("");
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>("");
  const [filterInitialized, setFilterInitialized] = useState(false);
  // AI分析（概要タブ用）
  const [overviewAiAnalysis, setOverviewAiAnalysis] = useState<string>("");
  const [isOverviewAnalyzing, setIsOverviewAnalyzing] = useState(false);
  // AI分析（エリア別タブ用）
  const [areaAiAnalysis, setAreaAiAnalysis] = useState<string>("");
  const [isAreaAnalyzing, setIsAreaAnalyzing] = useState(false);
  // 全社KPI折りたたみ
  const [isKPIExpanded, setIsKPIExpanded] = useState(true);
  // エリア選択（エリア別タブ用）
  const [selectedArea, setSelectedArea] = useState<string>("all");

  // ログインユーザーの社員名
  const loggedInEmployeeName = (session?.user as any)?.employeeName || "";

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 過去3年分のデータを取得
      const fromPeriod = selectedPeriod - 2;
      const toPeriod = selectedPeriod;

      const [dashboardRes, budgetRes, kpiRes] = await Promise.all([
        fetch(`/api/sales-dashboard?fromPeriod=${fromPeriod}&toPeriod=${toPeriod}`),
        fetch(`/api/sales-budget?period=${selectedPeriod}&office=全社`),
        fetch(`/api/company-kpi?period=${selectedPeriod}`),
      ]);

      const dashboardData = await dashboardRes.json();
      const budgetData = await budgetRes.json();
      const kpiData = await kpiRes.json();

      if (dashboardData.success) {
        setData(dashboardData.data);
        setCurrentPeriod(dashboardData.currentPeriod);
      } else {
        setError("データの取得に失敗しました");
      }

      if (budgetData.success) {
        setBudget(budgetData.data);
      }

      if (kpiData.success && kpiData.data) {
        setCompanyKPI(kpiData.data);
      } else {
        // データがない場合は選択期のデフォルト値（0）を設定
        setCompanyKPI({
          period: selectedPeriod,
          salesTarget: 0,
          monthlySalesTarget: 0,
          costOfSales: 0,
          costOfSalesRate: 0,
          sgaExpenses: 0,
          sgaRate: 0,
          operatingIncome: 0,
          operatingIncomeRate: 0,
          variableCost: 0,
          variableCostRate: 0,
          marginalProfit: 0,
          marginalProfitRate: 0,
          fixedCost: 0,
          fixedCostRate: 0,
          ordinaryIncome: 0,
          ordinaryIncomeRate: 0,
          manufacturingCostRate: 0,
          executionBudgetRate: 0,
          outsourcingRate: 0,
          headcountPlan: 0,
          capitalInvestment: 0,
          advertisingBudget: 0,
          notes: "",
        });
      }
    } catch (err) {
      setError("データの取得中にエラーが発生しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 期変更時に関連状態をリセット
    setOverviewAiAnalysis("");
    setIsOverviewAnalyzing(false);
    setAreaAiAnalysis("");
    setIsAreaAnalyzing(false);
    setSelectedArea("all");
    fetchData();
  }, [selectedPeriod]);

  // ログインユーザーが営業担当者の場合、デフォルトでフィルタリング
  useEffect(() => {
    if (!filterInitialized && data.length > 0 && loggedInEmployeeName) {
      const currentPeriodData = data.find((d) => d.period === selectedPeriod);
      if (currentPeriodData) {
        // ログインユーザーが担当者リストにいるか確認
        const userSummary = currentPeriodData.salesPersonSummary?.find(
          (sp) => sp.name === loggedInEmployeeName
        );
        if (userSummary) {
          // ユーザーの営業所と担当者名をデフォルト設定
          setSelectedOffice(userSummary.office);
          setSelectedSalesPerson(loggedInEmployeeName);
        }
        setFilterInitialized(true);
      }
    }
  }, [data, loggedInEmployeeName, filterInitialized, selectedPeriod]);

  // 現在期と前年のデータを取得
  const currentData = useMemo(() => data.find((d) => d.period === selectedPeriod), [data, selectedPeriod]);
  const previousData = useMemo(() => data.find((d) => d.period === selectedPeriod - 1), [data, selectedPeriod]);

  // データがある月までの累計で前年比を計算（YTD比較）
  const ytdComparison = useMemo(() => {
    if (!currentData || !previousData) return null;

    // 現在期でデータがある最後の月を特定（件数が1以上の月）
    // amountではなくcountで判定（金額は0円の案件もありうるため）
    let lastMonthWithData = -1;
    for (let i = currentData.monthlyData.length - 1; i >= 0; i--) {
      if (currentData.monthlyData[i].count > 0) {
        lastMonthWithData = i;
        break;
      }
    }

    if (lastMonthWithData < 0) return null;

    // デバッグ用ログ（本番では削除）
    console.log("[ytdComparison] 全月データ:", currentData.monthlyData.map((m, i) => ({
      index: i,
      month: m.month,
      count: m.count,
      amount: m.amount,
    })));
    console.log("[ytdComparison] lastMonthWithData:", lastMonthWithData,
      "month:", currentData.monthlyData[lastMonthWithData]?.month);

    // その月までの累計を計算
    let currentYtdAmount = 0;
    let currentYtdProfit = 0;
    let currentYtdCount = 0;
    let previousYtdAmount = 0;
    let previousYtdProfit = 0;
    let previousYtdCount = 0;

    for (let i = 0; i <= lastMonthWithData; i++) {
      currentYtdAmount += currentData.monthlyData[i]?.amount || 0;
      currentYtdProfit += currentData.monthlyData[i]?.profit || 0;
      currentYtdCount += currentData.monthlyData[i]?.count || 0;
      previousYtdAmount += previousData.monthlyData[i]?.amount || 0;
      previousYtdProfit += previousData.monthlyData[i]?.profit || 0;
      previousYtdCount += previousData.monthlyData[i]?.count || 0;
    }

    // 最後のデータがある月名を取得
    const lastMonth = currentData.monthlyData[lastMonthWithData]?.month || "";

    return {
      lastMonth,
      lastMonthIndex: lastMonthWithData,
      currentAmount: currentYtdAmount,
      previousAmount: previousYtdAmount,
      currentProfit: currentYtdProfit,
      previousProfit: previousYtdProfit,
      currentCount: currentYtdCount,
      previousCount: previousYtdCount,
    };
  }, [currentData, previousData]);

  // YTD予算（実績がある月までの累計予算）
  const ytdBudget = useMemo(() => {
    if (!budget?.monthlyBudget || !ytdComparison) return 0;
    let total = 0;
    for (let i = 0; i <= ytdComparison.lastMonthIndex; i++) {
      total += budget.monthlyBudget[i] || 0;
    }
    return total;
  }, [budget, ytdComparison]);

  // 粗利予算（年度・累計）- 全社KPIから計算
  const profitBudget = useMemo(() => {
    if (!companyKPI) return { yearly: 0, ytd: 0, targetRate: 0 };
    // 粗利率目標 = 100 - 売上原価率
    const targetProfitRate = 100 - companyKPI.costOfSalesRate;
    // 年度粗利予算 = 売上目標 × 粗利率目標（千円単位なので×1000）
    const yearlyProfitBudget = companyKPI.salesTarget * 1000 * (targetProfitRate / 100);
    // YTD粗利予算 = YTD売上予算 × 粗利率目標
    const ytdProfitBudget = ytdBudget * (targetProfitRate / 100);
    return {
      yearly: yearlyProfitBudget,
      ytd: ytdProfitBudget,
      targetRate: targetProfitRate,
    };
  }, [companyKPI, ytdBudget]);

  // 3年間平均単価計算
  const avgUnitPrices = useMemo(() => {
    if (!data || data.length === 0) return [];
    // 今期含め最大3年分を取得
    const periods = [selectedPeriod, selectedPeriod - 1, selectedPeriod - 2];
    return periods
      .map((period) => {
        const periodData = data.find((d) => d.period === period);
        if (!periodData || periodData.totalCount === 0) return null;
        return {
          period,
          value: periodData.totalAmount / periodData.totalCount,
        };
      })
      .filter((item): item is { period: number; value: number } => item !== null);
  }, [data, selectedPeriod]);

  // 月次比較データ作成（粗利・原価の積み上げ用）
  const monthlyComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.monthlyData.map((m, i) => ({
      month: m.month,
      粗利: m.profit,
      原価: m.cost,
      売上: m.amount,
      予算: budget?.monthlyBudget?.[i] || 0,
    }));
  }, [currentData, budget]);

  // 3期分売上推移データ（折れ線グラフ用）
  const salesTrendData = useMemo(() => {
    if (!currentData) return [];
    const period2 = data.find((d) => d.period === selectedPeriod - 1);
    const period3 = data.find((d) => d.period === selectedPeriod - 2);
    return currentData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.amount,
      [`${selectedPeriod - 1}期`]: period2?.monthlyData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: period3?.monthlyData[i]?.amount || 0,
    }));
  }, [currentData, data, selectedPeriod]);

  // 3期分粗利推移データ（折れ線グラフ用）
  const profitTrendData = useMemo(() => {
    if (!currentData) return [];
    const period2 = data.find((d) => d.period === selectedPeriod - 1);
    const period3 = data.find((d) => d.period === selectedPeriod - 2);
    return currentData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.profit,
      [`${selectedPeriod - 1}期`]: period2?.monthlyData[i]?.profit || 0,
      [`${selectedPeriod - 2}期`]: period3?.monthlyData[i]?.profit || 0,
    }));
  }, [currentData, data, selectedPeriod]);

  // 累計比較データ作成（粗利・原価の積み上げ用）
  const cumulativeComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.cumulativeData.map((m, i) => ({
      month: m.month,
      粗利: m.profit,
      原価: m.cost,
      売上: m.amount,
      [`${selectedPeriod - 1}期`]: previousData?.cumulativeData[i]?.amount || 0,
      予算累計: budget ? budget.monthlyBudget.slice(0, i + 1).reduce((a, b) => a + b, 0) : 0,
    }));
  }, [currentData, previousData, data, selectedPeriod, budget]);

  // 四半期比較データ作成（粗利・原価の積み上げ用）
  const quarterlyComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      粗利: q.profit,
      原価: q.cost,
      売上: q.amount,
      [`${selectedPeriod - 1}期`]: previousData?.quarterlyData[i]?.amount || 0,
      予算: budget?.quarterlyBudget?.[i] || 0,
    }));
  }, [currentData, previousData, selectedPeriod, budget]);

  // 3期分四半期売上推移データ（折れ線グラフ用）
  const quarterlySalesTrendData = useMemo(() => {
    if (!currentData) return [];
    const period2 = data.find((d) => d.period === selectedPeriod - 1);
    const period3 = data.find((d) => d.period === selectedPeriod - 2);
    return currentData.quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      [`${selectedPeriod}期`]: q.amount,
      [`${selectedPeriod - 1}期`]: period2?.quarterlyData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: period3?.quarterlyData[i]?.amount || 0,
    }));
  }, [currentData, data, selectedPeriod]);

  // エリア別データ
  const regionData = useMemo(() => {
    if (!currentData) return [];
    return currentData.regionSummary.map((r) => ({
      name: r.region,
      value: r.amount,
      count: r.count,
      color: REGION_COLORS[r.regionKey],
    }));
  }, [currentData]);

  // 選択エリアのデータ集計
  const selectedAreaData = useMemo(() => {
    if (!currentData || selectedArea === "all") return null;
    const regionSummary = currentData.regionSummary.find((r) => r.region === selectedArea);
    if (!regionSummary) return null;

    // 該当エリアの営業所リスト
    const areaOffices = regionSummary.offices || [];
    const totalAmount = regionSummary.amount;
    const totalCount = regionSummary.count;
    const totalProfit = regionSummary.profit;
    const totalCost = regionSummary.cost;
    const profitRate = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
    const avgUnitPrice = totalCount > 0 ? totalAmount / totalCount : 0;

    // 3期分の比較データ
    const period2Data = previousData?.regionSummary.find((r) => r.region === selectedArea);
    const period3Data = data.find((d) => d.period === selectedPeriod - 2)?.regionSummary.find((r) => r.region === selectedArea);

    // エリアの予算計算（営業所予算の合計）
    const officeNames = areaOffices.map((o) => o.name);
    const areaBudgets = budget?.officeBudgets?.filter((ob) => officeNames.includes(ob.office)) || [];
    const yearlyBudget = areaBudgets.reduce((sum, ob) => sum + ob.yearlyBudget, 0);
    const monthlyBudget = areaBudgets.reduce((sum, ob) => {
      ob.monthlyBudget.forEach((mb, i) => {
        sum[i] = (sum[i] || 0) + mb;
      });
      return sum;
    }, [] as number[]);

    // YTD予算計算（実績がある月まで）
    const lastMonthIndex = ytdComparison?.lastMonthIndex ?? -1;
    const ytdBudgetAmount = lastMonthIndex >= 0 ? monthlyBudget.slice(0, lastMonthIndex + 1).reduce((a, b) => a + b, 0) : 0;

    // 粗利予算計算（全社KPIの粗利率目標を適用）
    const targetProfitRate = companyKPI ? 100 - companyKPI.costOfSalesRate : 30;
    const yearlyProfitBudget = yearlyBudget * (targetProfitRate / 100);
    const ytdProfitBudget = ytdBudgetAmount * (targetProfitRate / 100);

    // 月次データ推計（全社月次データにエリア構成比を適用）
    const regionShare = currentData.totalAmount > 0 ? totalAmount / currentData.totalAmount : 0;
    const monthlyData = currentData.monthlyData.map((m) => ({
      month: m.month,
      amount: Math.round(m.amount * regionShare),
      profit: Math.round(m.profit * regionShare),
      cost: Math.round(m.cost * regionShare),
      count: Math.round(m.count * regionShare),
    }));

    // 累計データ
    let cumAmount = 0, cumProfit = 0, cumCost = 0;
    const cumulativeData = monthlyData.map((m) => {
      cumAmount += m.amount;
      cumProfit += m.profit;
      cumCost += m.cost;
      return { month: m.month, amount: cumAmount, profit: cumProfit, cost: cumCost, budget: 0 };
    });
    // 累計予算を追加
    let cumBudget = 0;
    cumulativeData.forEach((c, i) => {
      cumBudget += monthlyBudget[i] || 0;
      c.budget = cumBudget;
    });

    // 3期分売上推移データ
    const period2 = previousData;
    const period3 = data.find((d) => d.period === selectedPeriod - 2);
    const period2Region = period2?.regionSummary.find((r) => r.region === selectedArea);
    const period3Region = period3?.regionSummary.find((r) => r.region === selectedArea);
    const period2Share = period2 && period2.totalAmount > 0 ? (period2Region?.amount || 0) / period2.totalAmount : 0;
    const period3Share = period3 && period3.totalAmount > 0 ? (period3Region?.amount || 0) / period3.totalAmount : 0;

    const salesTrendData = currentData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: Math.round(m.amount * regionShare),
      [`${selectedPeriod - 1}期`]: Math.round((period2?.monthlyData[i]?.amount || 0) * period2Share),
      [`${selectedPeriod - 2}期`]: Math.round((period3?.monthlyData[i]?.amount || 0) * period3Share),
    }));

    const profitTrendData = currentData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: Math.round(m.profit * regionShare),
      [`${selectedPeriod - 1}期`]: Math.round((period2?.monthlyData[i]?.profit || 0) * period2Share),
      [`${selectedPeriod - 2}期`]: Math.round((period3?.monthlyData[i]?.profit || 0) * period3Share),
    }));

    // 3年間平均単価
    const avgUnitPrices = [
      { period: selectedPeriod, value: avgUnitPrice },
      { period: selectedPeriod - 1, value: period2Region && period2Region.count > 0 ? period2Region.amount / period2Region.count : 0 },
      { period: selectedPeriod - 2, value: period3Region && period3Region.count > 0 ? period3Region.amount / period3Region.count : 0 },
    ].filter((p) => p.value > 0);

    return {
      region: selectedArea,
      totalAmount,
      totalCount,
      totalProfit,
      totalCost,
      profitRate,
      avgUnitPrice,
      offices: areaOffices,
      // 予算関連
      yearlyBudget,
      monthlyBudget,
      ytdBudgetAmount,
      yearlyProfitBudget,
      ytdProfitBudget,
      targetProfitRate,
      // 比較データ
      comparison: {
        currentAmount: totalAmount,
        prevAmount: period2Data?.amount || 0,
        prev2Amount: period3Data?.amount || 0,
        currentCount: totalCount,
        prevCount: period2Data?.count || 0,
        currentProfit: totalProfit,
        prevProfit: period2Data?.profit || 0,
      },
      // グラフ用データ
      monthlyData,
      cumulativeData,
      salesTrendData,
      profitTrendData,
      avgUnitPrices,
      lastMonthIndex,
    };
  }, [currentData, previousData, data, selectedArea, selectedPeriod, budget, companyKPI, ytdComparison]);

  // 営業所リスト
  const officeList = useMemo(() => {
    if (!currentData?.officeSalesPersons) return [];
    return currentData.officeSalesPersons.map((o) => o.office);
  }, [currentData]);

  // 選択された営業所の担当者リスト
  const filteredSalesPersons = useMemo(() => {
    if (!currentData?.officeSalesPersons) return [];
    if (!selectedOffice) {
      // 全担当者
      return currentData.salesPersonSummary?.map((sp) => sp.name) || [];
    }
    const officeData = currentData.officeSalesPersons.find((o) => o.office === selectedOffice);
    return officeData?.salesPersons || [];
  }, [currentData, selectedOffice]);

  // フィルタリングされた担当者サマリー
  const filteredSalesPersonSummary = useMemo(() => {
    if (!currentData?.salesPersonSummary) return [];
    let result = currentData.salesPersonSummary;
    if (selectedOffice) {
      result = result.filter((sp) => sp.office === selectedOffice);
    }
    if (selectedSalesPerson) {
      result = result.filter((sp) => sp.name === selectedSalesPerson);
    }
    return result;
  }, [currentData, selectedOffice, selectedSalesPerson]);

  // 選択された担当者の詳細
  const selectedPersonData = useMemo(() => {
    if (!selectedSalesPerson || !currentData?.salesPersonSummary) return null;
    return currentData.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);
  }, [currentData, selectedSalesPerson]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Gauge className="w-6 h-6 text-blue-500" />
                売上BI
              </h1>
              <p className="text-sm text-gray-500">営業部 &gt; 売上BI</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">期間:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 10 }, (_, i) => currentPeriod - 5 + i).map((p) => (
                    <option key={p} value={p}>
                      第{p}期
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
            </div>
          </div>

          {/* 全社KPI（折りたたみ可能） */}
          {companyKPI && (
            <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
              <button
                onClick={() => setIsKPIExpanded(!isKPIExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-purple-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-bold text-purple-800">第{companyKPI.period}期 全社KPI</span>
                </div>
                {isKPIExpanded ? (
                  <ChevronUp className="w-4 h-4 text-purple-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-purple-600" />
                )}
              </button>
              {isKPIExpanded && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">売上目標</div>
                      <div className="font-bold text-gray-800">{formatAmount(companyKPI.salesTarget * 1000)}円</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">売上原価率</div>
                      <div className="font-bold text-orange-600">{companyKPI.costOfSalesRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">販管費率</div>
                      <div className="font-bold text-blue-600">{companyKPI.sgaRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">営業利益率</div>
                      <div className="font-bold text-green-600">{companyKPI.operatingIncomeRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">製造原価率</div>
                      <div className="font-bold text-amber-600">{companyKPI.manufacturingCostRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">実行予算率</div>
                      <div className="font-bold text-cyan-600">{companyKPI.executionBudgetRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">外注発注率</div>
                      <div className="font-bold text-pink-600">{companyKPI.outsourcingRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <div className="text-gray-500">経常利益率</div>
                      <div className="font-bold text-purple-600">{companyKPI.ordinaryIncomeRate}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* タブ */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          {!loading && currentData && (
            <>
              {/* 概要タブ */}
              {activeTab === "overview" && (
                <>
                  {/* KPIカード */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                      title="売上金額"
                      value={formatAmount(currentData.totalAmount)}
                      unit="円"
                      change={ytdComparison ? calcChange(ytdComparison.currentAmount, ytdComparison.previousAmount) : undefined}
                      changeLabel={ytdComparison ? `累計前年比（${ytdComparison.lastMonth}まで）` : undefined}
                      icon={<TrendingUp className="w-5 h-5 text-white" />}
                      color="emerald"
                      budgetAmount={budget?.yearlyBudget}
                      actualAmount={currentData.totalAmount}
                      ytdBudgetAmount={ytdBudget}
                      ytdActualAmount={ytdComparison?.currentAmount}
                      ytdLabel={ytdComparison?.lastMonth}
                    />
                    <KPICard
                      title="粗利"
                      value={formatAmount(currentData.totalProfit)}
                      unit="円"
                      change={ytdComparison ? calcChange(ytdComparison.currentProfit, ytdComparison.previousProfit) : undefined}
                      changeLabel={ytdComparison ? `累計前年比（${ytdComparison.lastMonth}まで）` : undefined}
                      icon={<TrendingUp className="w-5 h-5 text-white" />}
                      color="blue"
                      budgetAmount={profitBudget.yearly}
                      actualAmount={currentData.totalProfit}
                      ytdBudgetAmount={profitBudget.ytd}
                      ytdActualAmount={ytdComparison?.currentProfit}
                      ytdLabel={ytdComparison?.lastMonth}
                    />
                    <KPICard
                      title="粗利率"
                      value={currentData.totalAmount > 0 ? `${((currentData.totalProfit / currentData.totalAmount) * 100).toFixed(1)}` : "0"}
                      unit="%"
                      icon={<Target className="w-5 h-5 text-white" />}
                      color="purple"
                      targetRate={profitBudget.targetRate}
                      actualRate={currentData.totalAmount > 0 ? (currentData.totalProfit / currentData.totalAmount) * 100 : 0}
                    />
                    <KPICard
                      title="受注件数"
                      value={currentData.totalCount.toLocaleString()}
                      unit="件"
                      change={ytdComparison ? calcChange(ytdComparison.currentCount, ytdComparison.previousCount) : undefined}
                      changeLabel={ytdComparison ? `累計前年比（${ytdComparison.lastMonth}まで）` : undefined}
                      icon={<BarChart3 className="w-5 h-5 text-white" />}
                      color="orange"
                      avgUnitPrices={avgUnitPrices}
                    />
                  </div>

                  {/* 月次推移グラフ */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        月次売上推移（粗利・原価構成）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={monthlyComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const profit = payload.find((p) => p.dataKey === "粗利")?.value as number || 0;
                                  const cost = payload.find((p) => p.dataKey === "原価")?.value as number || 0;
                                  const budgetVal = payload.find((p) => p.dataKey === "予算")?.value as number || 0;
                                  const total = profit + cost;
                                  const profitRate = total > 0 ? (profit / total) * 100 : 0;
                                  const achievementRate = budgetVal > 0 ? (total / budgetVal) * 100 : 0;
                                  return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                      <p className="font-bold text-gray-800 mb-2">{label}</p>
                                      <p className="text-sm text-gray-600">売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                      <p className="text-sm text-green-600">粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                      <p className="text-sm text-orange-600">原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                      <p className={`text-sm font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                        粗利率: {profitRate.toFixed(1)}%
                                      </p>
                                      {budgetVal > 0 && (
                                        <>
                                          <hr className="my-2 border-gray-200" />
                                          <p className="text-sm text-purple-600">予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                          <p className={`text-sm font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                            達成率: {achievementRate.toFixed(1)}%
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend />
                            <Bar dataKey="原価" stackId="a" fill={COLORS.cost} name="原価" />
                            <Bar dataKey="粗利" stackId="a" fill={COLORS.profit} name="粗利" />
                            <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={false} name="予算" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-500" />
                        累計売上推移（粗利・原価構成）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={cumulativeComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const profit = payload.find((p) => p.dataKey === "粗利")?.value as number || 0;
                                  const cost = payload.find((p) => p.dataKey === "原価")?.value as number || 0;
                                  const budgetVal = payload.find((p) => p.dataKey === "予算累計")?.value as number || 0;
                                  const total = profit + cost;
                                  const profitRate = total > 0 ? (profit / total) * 100 : 0;
                                  const achievementRate = budgetVal > 0 ? (total / budgetVal) * 100 : 0;
                                  return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                      <p className="font-bold text-gray-800 mb-2">{label}</p>
                                      <p className="text-sm text-gray-600">累計売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                      <p className="text-sm text-green-600">累計粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                      <p className="text-sm text-orange-600">累計原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                      <p className={`text-sm font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                        粗利率: {profitRate.toFixed(1)}%
                                      </p>
                                      {budgetVal > 0 && (
                                        <>
                                          <hr className="my-2 border-gray-200" />
                                          <p className="text-sm text-purple-600">予算累計: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                          <p className={`text-sm font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                            達成率: {achievementRate.toFixed(1)}%
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend />
                            <Bar dataKey="原価" stackId="a" fill={COLORS.cost} name="原価" />
                            <Bar dataKey="粗利" stackId="a" fill={COLORS.profit} name="粗利" />
                            <Line type="monotone" dataKey="予算累計" stroke={COLORS.budget} strokeWidth={2} dot={false} name="予算累計" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 3期分推移グラフ（折れ線） */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                        売上推移（3期比較）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={salesTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod}期`}
                              stroke={COLORS.primary}
                              strokeWidth={3}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 1}期`}
                              stroke={COLORS.secondary}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 2}期`}
                              stroke={COLORS.denary}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        粗利推移（3期比較）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={profitTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod}期`}
                              stroke={COLORS.profit}
                              strokeWidth={3}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 1}期`}
                              stroke={COLORS.quaternary}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 2}期`}
                              stroke={COLORS.denary}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 四半期 & 地域 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-500" />
                        四半期売上（粗利・原価構成）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={quarterlyComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="quarter" />
                            <YAxis tickFormatter={(v) => formatAmount(v)} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const profit = payload.find((p) => p.dataKey === "粗利")?.value as number || 0;
                                  const cost = payload.find((p) => p.dataKey === "原価")?.value as number || 0;
                                  const budgetVal = payload.find((p) => p.dataKey === "予算")?.value as number || 0;
                                  const total = profit + cost;
                                  const profitRate = total > 0 ? (profit / total) * 100 : 0;
                                  const achievementRate = budgetVal > 0 ? (total / budgetVal) * 100 : 0;
                                  return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                      <p className="font-bold text-gray-800 mb-2">{label}</p>
                                      <p className="text-sm text-gray-600">売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                      <p className="text-sm text-green-600">粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                      <p className="text-sm text-orange-600">原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                      <p className={`text-sm font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                        粗利率: {profitRate.toFixed(1)}%
                                      </p>
                                      {budgetVal > 0 && (
                                        <>
                                          <hr className="my-2 border-gray-200" />
                                          <p className="text-sm text-purple-600">予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                          <p className={`text-sm font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                            達成率: {achievementRate.toFixed(1)}%
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend />
                            <Bar dataKey="原価" stackId="a" fill={COLORS.cost} name="原価" />
                            <Bar dataKey="粗利" stackId="a" fill={COLORS.profit} name="粗利" />
                            <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={{ r: 4 }} name="予算" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        四半期売上推移（3期比較）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={quarterlySalesTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="quarter" />
                            <YAxis tickFormatter={(v) => formatAmount(v)} />
                            <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod}期`}
                              stroke={COLORS.primary}
                              strokeWidth={3}
                              dot={{ r: 5 }}
                              activeDot={{ r: 7 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 1}期`}
                              stroke={COLORS.secondary}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 2}期`}
                              stroke={COLORS.denary}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* AI分析 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI売上分析
                      </h3>
                      <button
                        onClick={async () => {
                          if (!currentData) return;
                          setIsOverviewAnalyzing(true);
                          setOverviewAiAnalysis("");
                          try {
                            const analysisData = {
                              period: selectedPeriod,
                              totalAmount: currentData.totalAmount,
                              totalCount: currentData.totalCount,
                              totalProfit: currentData.totalProfit,
                              profitRate: currentData.totalAmount > 0 ? (currentData.totalProfit / currentData.totalAmount) * 100 : 0,
                              budget: budget?.yearlyBudget || 0,
                              achievementRate: budget?.yearlyBudget ? (currentData.totalAmount / budget.yearlyBudget) * 100 : 0,
                              avgUnitPrice: currentData.totalCount > 0 ? currentData.totalAmount / currentData.totalCount : 0,
                              regionSummary: currentData.regionSummary.map(r => ({
                                region: r.region,
                                amount: r.amount,
                                count: r.count,
                                profit: r.profit,
                                profitRate: r.amount > 0 ? (r.profit / r.amount) * 100 : 0,
                              })),
                              officeSummary: currentData.officeSummary.slice(0, 5).map(o => ({
                                office: o.name,
                                amount: o.amount,
                                count: o.count,
                                profit: o.profit,
                              })),
                              monthlyTrend: currentData.monthlyData.map(m => ({
                                month: m.month,
                                amount: m.amount,
                                count: m.count,
                              })),
                              companyKPI: companyKPI ? {
                                salesTarget: companyKPI.salesTarget * 1000,
                                costOfSalesRate: companyKPI.costOfSalesRate,
                                operatingIncomeRate: companyKPI.operatingIncomeRate,
                              } : null,
                            };
                            const res = await fetch("/api/ai-analysis", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "sales-overview", data: analysisData }),
                            });
                            const result = await res.json();
                            if (result.success) {
                              setOverviewAiAnalysis(result.analysis);
                            } else {
                              setOverviewAiAnalysis("分析の取得に失敗しました。");
                            }
                          } catch (e) {
                            setOverviewAiAnalysis("分析中にエラーが発生しました。");
                          } finally {
                            setIsOverviewAnalyzing(false);
                          }
                        }}
                        disabled={isOverviewAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                      >
                        {isOverviewAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI分析を実行
                          </>
                        )}
                      </button>
                    </div>
                    {overviewAiAnalysis ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                          {overviewAiAnalysis}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">「AI分析を実行」ボタンを押すと、現在の売上データをAIが分析します</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* エリア別タブ */}
              {activeTab === "region" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentData.regionSummary.map((region) => {
                      const regionProfitRate = region.amount > 0 ? (region.profit / region.amount) * 100 : 0;
                      return (
                        <div key={region.region} className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                          <div className="flex items-center gap-2 mb-4">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: REGION_COLORS[region.regionKey] }}
                            />
                            <h3 className="text-lg font-bold text-gray-800">{region.region}</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-sm text-gray-500">売上金額</div>
                              <div className="text-xl font-bold text-gray-800">{formatAmount(region.amount)}円</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">受注件数</div>
                              <div className="text-xl font-bold text-gray-800">{region.count.toLocaleString()}件</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-sm text-gray-500">粗利</div>
                              <div className="text-xl font-bold text-green-600">{formatAmount(region.profit)}円</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">粗利率</div>
                              <div className={`text-xl font-bold ${regionProfitRate >= 30 ? "text-green-600" : regionProfitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                {regionProfitRate.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-600 mb-2">営業所内訳</div>
                            {region.offices.slice(0, 5).map((office) => {
                              const officeProfitRate = office.amount > 0 ? (office.profit / office.amount) * 100 : 0;
                              return (
                                <div key={office.name} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{office.name}</span>
                                  <div className="flex gap-2">
                                    <span className="font-medium text-gray-800">{formatAmount(office.amount)}円</span>
                                    <span className={`font-medium ${officeProfitRate >= 30 ? "text-green-600" : officeProfitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                      ({officeProfitRate.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* エリア別売上構成 & 3期比較 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* エリア別売上構成 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        エリア別売上構成
                      </h3>
                      <div className="h-72 flex items-center justify-center">
                        <ResponsiveContainer width="50%" height="100%">
                          <PieChart>
                            <Pie
                              data={regionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {regionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="w-44 space-y-2">
                          {regionData.map((r) => {
                            const percentage = currentData.totalAmount > 0 ? (r.value / currentData.totalAmount) * 100 : 0;
                            return (
                              <div key={r.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                                <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-gray-700">{r.name}</span>
                                    <span className="text-xs font-bold text-gray-800">{percentage.toFixed(1)}%</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500">{formatAmount(r.value)}円</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* エリア別3期比較 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        エリア別 3期比較
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={["東日本", "西日本", "本社"].map((region) => ({
                              region,
                              [`${selectedPeriod}期`]:
                                currentData.regionSummary.find((r) => r.region === region)?.amount || 0,
                              [`${selectedPeriod - 1}期`]:
                                previousData?.regionSummary.find((r) => r.region === region)?.amount || 0,
                              [`${selectedPeriod - 2}期`]:
                                data.find((d) => d.period === selectedPeriod - 2)?.regionSummary.find((r) => r.region === region)?.amount || 0,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="region" />
                            <YAxis tickFormatter={(v) => formatAmount(v)} />
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                            <Legend />
                            <Bar dataKey={`${selectedPeriod}期`} fill={COLORS.primary} />
                            <Bar dataKey={`${selectedPeriod - 1}期`} fill={COLORS.secondary} />
                            <Bar dataKey={`${selectedPeriod - 2}期`} fill={COLORS.denary} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* エリア選択・詳細表示 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-purple-500" />
                        エリア別詳細
                      </h3>
                      <select
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="all">エリアを選択</option>
                        <option value="本社">本社</option>
                        <option value="東日本">東日本</option>
                        <option value="西日本">西日本</option>
                      </select>
                    </div>

                    {selectedAreaData ? (
                      <div className="space-y-4">
                        {/* エリア概要KPIカード */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* 売上金額 */}
                          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-100">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                              売上金額
                            </div>
                            <div className="text-xl font-bold text-emerald-600">{formatAmount(selectedAreaData.totalAmount)}円</div>
                            {selectedAreaData.yearlyBudget > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                  <span>年度予算: {formatAmount(selectedAreaData.yearlyBudget)}円</span>
                                  <span className={`font-bold ${(selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100 >= 100 ? "text-green-600" : (selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                    {((selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${(selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100 >= 100 ? "bg-green-500" : (selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100, 100)}%` }} />
                                </div>
                                {selectedAreaData.ytdBudgetAmount > 0 && (
                                  <>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                      <span>累計予算: {formatAmount(selectedAreaData.ytdBudgetAmount)}円</span>
                                      <span className={`font-bold ${(selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100 >= 100 ? "text-green-600" : (selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                        {((selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${(selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100 >= 100 ? "bg-green-500" : (selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedAreaData.totalAmount / selectedAreaData.ytdBudgetAmount) * 100, 100)}%` }} />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 粗利 */}
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                              粗利
                            </div>
                            <div className="text-xl font-bold text-blue-600">{formatAmount(selectedAreaData.totalProfit)}円</div>
                            {selectedAreaData.yearlyProfitBudget > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                  <span>年度予算: {formatAmount(selectedAreaData.yearlyProfitBudget)}円</span>
                                  <span className={`font-bold ${(selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100 >= 100 ? "text-green-600" : (selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                    {((selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${(selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100 >= 100 ? "bg-green-500" : (selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedAreaData.totalProfit / selectedAreaData.yearlyProfitBudget) * 100, 100)}%` }} />
                                </div>
                                {selectedAreaData.ytdProfitBudget > 0 && (
                                  <>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                      <span>累計予算: {formatAmount(selectedAreaData.ytdProfitBudget)}円</span>
                                      <span className={`font-bold ${(selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100 >= 100 ? "text-green-600" : (selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                        {((selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${(selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100 >= 100 ? "bg-green-500" : (selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedAreaData.totalProfit / selectedAreaData.ytdProfitBudget) * 100, 100)}%` }} />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 粗利率 */}
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5 text-purple-500" />
                              粗利率
                            </div>
                            <div className={`text-xl font-bold ${selectedAreaData.profitRate >= 30 ? "text-green-600" : selectedAreaData.profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                              {selectedAreaData.profitRate.toFixed(1)}%
                            </div>
                            {selectedAreaData.targetProfitRate > 0 && (
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                  <span>目標: {selectedAreaData.targetProfitRate.toFixed(1)}%</span>
                                  <span className={`font-bold ${selectedAreaData.profitRate >= selectedAreaData.targetProfitRate ? "text-green-600" : "text-red-600"}`}>
                                    {selectedAreaData.profitRate >= selectedAreaData.targetProfitRate ? "+" : ""}{(selectedAreaData.profitRate - selectedAreaData.targetProfitRate).toFixed(1)}pt
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                                  <div className="absolute h-full w-0.5 bg-purple-600 z-10" style={{ left: `${Math.min(selectedAreaData.targetProfitRate, 100)}%` }} />
                                  <div className={`h-full rounded-full ${selectedAreaData.profitRate >= selectedAreaData.targetProfitRate ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedAreaData.profitRate, 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 受注件数 */}
                          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <BarChart3 className="w-3.5 h-3.5 text-orange-500" />
                              受注件数
                            </div>
                            <div className="text-xl font-bold text-orange-600">{selectedAreaData.totalCount.toLocaleString()}件</div>
                            {selectedAreaData.comparison.prevCount > 0 && (
                              <div className={`text-xs mt-1 ${selectedAreaData.totalCount >= selectedAreaData.comparison.prevCount ? "text-green-600" : "text-red-600"}`}>
                                累計前年比 {((selectedAreaData.totalCount / selectedAreaData.comparison.prevCount) * 100).toFixed(1)}%
                              </div>
                            )}
                            {selectedAreaData.avgUnitPrices.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-orange-200">
                                <div className="text-[10px] text-gray-500 mb-1">平均単価（3年間）</div>
                                <div className="flex gap-1">
                                  {selectedAreaData.avgUnitPrices.map((item, i) => (
                                    <div key={item.period} className={`flex-1 text-center py-0.5 rounded ${i === 0 ? "bg-orange-100" : "bg-gray-100"}`}>
                                      <div className="text-[8px] text-gray-400">{item.period}期</div>
                                      <div className={`text-[10px] font-bold ${i === 0 ? "text-orange-600" : "text-gray-600"}`}>{formatAmount(item.value)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* グラフセクション */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* 月次売上推移（粗利・原価構成） */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">月次売上推移（粗利・原価構成）</h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={selectedAreaData.monthlyData.map((m, i) => ({ ...m, 予算: selectedAreaData.monthlyBudget[i] || 0 }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 9 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend wrapperStyle={{ fontSize: 10 }} />
                                  <Bar dataKey="cost" stackId="a" fill={COLORS.cost} name="原価" />
                                  <Bar dataKey="profit" stackId="a" fill={COLORS.profit} name="粗利" />
                                  <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={false} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 累計売上推移（粗利・原価構成） */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">累計売上推移（粗利・原価構成）</h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={selectedAreaData.cumulativeData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 9 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend wrapperStyle={{ fontSize: 10 }} />
                                  <Bar dataKey="cost" stackId="a" fill={COLORS.cost} name="原価" />
                                  <Bar dataKey="profit" stackId="a" fill={COLORS.profit} name="粗利" />
                                  <Line type="monotone" dataKey="budget" stroke={COLORS.budget} strokeWidth={2} dot={false} name="予算" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 売上推移（3期比較） */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">売上推移（3期比較）</h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedAreaData.salesTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 9 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend wrapperStyle={{ fontSize: 10 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={1.5} dot={{ r: 2 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.denary} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 粗利推移（3期比較） */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">粗利推移（3期比較）</h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedAreaData.profitTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 9 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend wrapperStyle={{ fontSize: 10 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.profit} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.quaternary} strokeWidth={1.5} dot={{ r: 2 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.denary} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* 営業所内訳 */}
                        {selectedAreaData.offices.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">営業所別内訳</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-300">
                                    <th className="text-left py-2 px-3 text-gray-600">営業所</th>
                                    <th className="text-right py-2 px-3 text-gray-600">売上金額</th>
                                    <th className="text-right py-2 px-3 text-gray-600">件数</th>
                                    <th className="text-right py-2 px-3 text-gray-600">粗利</th>
                                    <th className="text-right py-2 px-3 text-gray-600">粗利率</th>
                                    <th className="text-right py-2 px-3 text-gray-600">構成比</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedAreaData.offices.slice(0, 10).map((office, i) => {
                                    const officeProfitRate = office.amount > 0 ? (office.profit / office.amount) * 100 : 0;
                                    const shareRate = selectedAreaData.totalAmount > 0 ? (office.amount / selectedAreaData.totalAmount) * 100 : 0;
                                    return (
                                      <tr key={office.name} className={i % 2 === 0 ? "bg-white" : ""}>
                                        <td className="py-2 px-3 font-medium">{office.name}</td>
                                        <td className="py-2 px-3 text-right">{formatAmount(office.amount)}円</td>
                                        <td className="py-2 px-3 text-right">{office.count}件</td>
                                        <td className="py-2 px-3 text-right text-green-600">{formatAmount(office.profit)}円</td>
                                        <td className={`py-2 px-3 text-right ${officeProfitRate >= 30 ? "text-green-600" : officeProfitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                          {officeProfitRate.toFixed(1)}%
                                        </td>
                                        <td className="py-2 px-3 text-right text-gray-500">{shareRate.toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* AI分析 */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              {selectedAreaData.region} AI分析
                            </h4>
                            <button
                              onClick={async () => {
                                setIsAreaAnalyzing(true);
                                setAreaAiAnalysis("");
                                try {
                                  const analysisData = {
                                    period: selectedPeriod,
                                    area: selectedAreaData.region,
                                    totalAmount: selectedAreaData.totalAmount,
                                    totalCount: selectedAreaData.totalCount,
                                    totalProfit: selectedAreaData.totalProfit,
                                    profitRate: selectedAreaData.profitRate,
                                    yearlyBudget: selectedAreaData.yearlyBudget,
                                    achievementRate: selectedAreaData.yearlyBudget > 0 ? (selectedAreaData.totalAmount / selectedAreaData.yearlyBudget) * 100 : 0,
                                    avgUnitPrice: selectedAreaData.avgUnitPrice,
                                    targetProfitRate: selectedAreaData.targetProfitRate,
                                    comparison: selectedAreaData.comparison,
                                    officeSummary: selectedAreaData.offices.slice(0, 5).map(o => ({
                                      office: o.name,
                                      amount: o.amount,
                                      count: o.count,
                                      profit: o.profit,
                                      profitRate: o.amount > 0 ? (o.profit / o.amount) * 100 : 0,
                                    })),
                                    monthlyTrend: selectedAreaData.monthlyData.filter(m => m.amount > 0).map(m => ({
                                      month: m.month,
                                      amount: m.amount,
                                      profit: m.profit,
                                    })),
                                  };
                                  const res = await fetch("/api/ai-analysis", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ type: "sales-area", data: analysisData }),
                                  });
                                  const result = await res.json();
                                  if (result.success) {
                                    setAreaAiAnalysis(result.analysis);
                                  } else {
                                    setAreaAiAnalysis("分析の取得に失敗しました。");
                                  }
                                } catch (e) {
                                  setAreaAiAnalysis("分析中にエラーが発生しました。");
                                } finally {
                                  setIsAreaAnalyzing(false);
                                }
                              }}
                              disabled={isAreaAnalyzing}
                              className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded text-xs font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                            >
                              {isAreaAnalyzing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  分析中...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  AI分析
                                </>
                              )}
                            </button>
                          </div>
                          {areaAiAnalysis ? (
                            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{areaAiAnalysis}</div>
                          ) : (
                            <div className="text-xs text-purple-400 text-center py-2">「AI分析」ボタンで{selectedAreaData.region}エリアの詳細分析を実行</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">エリアを選択すると詳細情報を表示します</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 営業所別タブ */}
              {activeTab === "office" && (
                <>
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800">営業所別売上ランキング</h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentData.officeSummary.slice(0, 15)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatAmount(v)} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                          <Bar dataKey="amount" fill={COLORS.primary}>
                            {currentData.officeSummary.slice(0, 15).map((_, i) => (
                              <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 営業所別詳細テーブル */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">営業所別 詳細データ</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">営業所</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">売上金額</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">予算</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">達成率</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利率</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.officeSummary.map((office, i) => {
                            const profitRate = office.amount > 0 ? (office.profit / office.amount) * 100 : 0;
                            const officeBudget = budget?.officeBudgets?.find((b) => b.office === office.name);
                            const officeBudgetAmount = officeBudget?.yearlyBudget || 0;
                            const achievementRate = officeBudgetAmount > 0 ? (office.amount / officeBudgetAmount) * 100 : 0;
                            return (
                              <tr key={office.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{office.name}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {formatAmount(office.amount)}円
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-purple-600">
                                  {officeBudgetAmount > 0 ? `${formatAmount(officeBudgetAmount)}円` : "-"}
                                </td>
                                <td className={`px-4 py-3 text-sm text-right font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : achievementRate > 0 ? "text-red-600" : "text-gray-400"}`}>
                                  {officeBudgetAmount > 0 ? `${achievementRate.toFixed(1)}%` : "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                                  {formatAmount(office.profit)}円
                                </td>
                                <td className={`px-4 py-3 text-sm text-right font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                  {profitRate.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {office.count.toLocaleString()}件
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {((office.amount / currentData.totalAmount) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* 営業担当者別タブ */}
              {activeTab === "salesperson" && (
                <>
                  {/* フィルター */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                      <Filter className="w-5 h-5 text-blue-500" />
                      抽出条件
                      {loggedInEmployeeName && (
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          （ログイン: {loggedInEmployeeName}）
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-600">営業所:</label>
                        <select
                          value={selectedOffice}
                          onChange={(e) => {
                            setSelectedOffice(e.target.value);
                            setSelectedSalesPerson("");
                          }}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
                        >
                          <option value="">全営業所</option>
                          {officeList.map((office) => (
                            <option key={office} value={office}>
                              {office}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-600">担当者:</label>
                        <select
                          value={selectedSalesPerson}
                          onChange={(e) => setSelectedSalesPerson(e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
                        >
                          <option value="">全担当者</option>
                          {filteredSalesPersons.map((person) => (
                            <option key={person} value={person}>
                              {person}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedOffice("");
                          setSelectedSalesPerson("");
                        }}
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                      >
                        クリア
                      </button>
                    </div>
                  </div>

                  {/* 担当者個人の詳細（担当者選択時） */}
                  {selectedPersonData && (
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        {selectedPersonData.name} の売上詳細
                        <span className="text-sm font-normal text-gray-500">（{selectedPersonData.office}）</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                          <div className="text-sm text-gray-500">売上金額</div>
                          <div className="text-2xl font-bold text-indigo-600">{formatAmount(selectedPersonData.amount)}円</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
                          <div className="text-sm text-gray-500">受注件数</div>
                          <div className="text-2xl font-bold text-emerald-600">{selectedPersonData.count.toLocaleString()}件</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
                          <div className="text-sm text-gray-500">平均単価</div>
                          <div className="text-2xl font-bold text-purple-600">
                            {formatAmount(selectedPersonData.count > 0 ? selectedPersonData.amount / selectedPersonData.count : 0)}円
                          </div>
                        </div>
                      </div>
                      {/* 月次推移グラフ */}
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={selectedPersonData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip formatter={(v, name) => [name === "件数" ? `${v}件` : `${(v as number).toLocaleString()}円`, name]} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="amount" name="売上金額" fill={COLORS.primary} />
                            <Line yAxisId="right" type="monotone" dataKey="count" name="件数" stroke={COLORS.tertiary} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* 担当者一覧（担当者未選択時） */}
                  {!selectedSalesPerson && (
                    <>
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <h3 className="text-base font-bold mb-4 text-gray-800">
                          営業担当者別売上ランキング
                          {selectedOffice && <span className="text-sm font-normal text-gray-500 ml-2">（{selectedOffice}）</span>}
                        </h3>
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredSalesPersonSummary.slice(0, 15)} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tickFormatter={(v) => formatAmount(v)} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                              <Bar dataKey="amount" fill={COLORS.primary}>
                                {filteredSalesPersonSummary.slice(0, 15).map((_, i) => (
                                  <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 担当者別詳細テーブル */}
                      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                          <h3 className="text-base font-bold text-white">営業担当者別 詳細データ</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">担当者</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">営業所</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">売上金額</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">予算</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">達成率</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利率</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredSalesPersonSummary.map((person, i) => {
                                const profitRate = person.amount > 0 ? (person.profit / person.amount) * 100 : 0;
                                const personBudget = budget?.salesPersonBudgets?.find((b) => b.salesPerson === person.name);
                                const personBudgetAmount = personBudget?.yearlyBudget || 0;
                                const achievementRate = personBudgetAmount > 0 ? (person.amount / personBudgetAmount) * 100 : 0;
                                return (
                                  <tr
                                    key={person.name}
                                    className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} cursor-pointer hover:bg-blue-50 transition-colors`}
                                    onClick={() => setSelectedSalesPerson(person.name)}
                                  >
                                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        {person.name}
                                        {person.name === loggedInEmployeeName && (
                                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">自分</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{person.office}</td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                      {formatAmount(person.amount)}円
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-purple-600">
                                      {personBudgetAmount > 0 ? `${formatAmount(personBudgetAmount)}円` : "-"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm text-right font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : achievementRate > 0 ? "text-red-600" : "text-gray-400"}`}>
                                      {personBudgetAmount > 0 ? `${achievementRate.toFixed(1)}%` : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                                      {formatAmount(person.profit)}円
                                    </td>
                                    <td className={`px-4 py-3 text-sm text-right font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                      {profitRate.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                      {person.count.toLocaleString()}件
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                      {currentData && ((person.amount / currentData.totalAmount) * 100).toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* 区分別タブ */}
              {activeTab === "category" && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PJ区分 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">PJ区分別売上</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={currentData.pjCategorySummary.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatAmount(v)} />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                            <Bar dataKey="amount" fill={COLORS.primary} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* WEB新規 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">WEB新規区分</h3>
                      <div className="h-80 flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                          <PieChart>
                            <Pie
                              data={currentData.webNewSummary.map((d) => ({ name: d.name, value: d.amount }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={3}
                              dataKey="value"
                              nameKey="name"
                            >
                              {currentData.webNewSummary.map((_, i) => (
                                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="w-40 space-y-2">
                          {currentData.webNewSummary.map((item, i) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700">{item.name}</div>
                                <div className="text-xs text-gray-500">{formatAmount(item.amount)}円</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 県別 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800">納入先県別売上 TOP15</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentData.prefectureSummary.slice(0, 15)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                          <YAxis tickFormatter={(v) => formatAmount(v)} />
                          <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                          <Bar dataKey="amount" fill={COLORS.quaternary}>
                            {currentData.prefectureSummary.slice(0, 15).map((_, i) => (
                              <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* PJ区分別詳細テーブル */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">PJ区分別 詳細データ</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">PJ区分</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">売上金額</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利率</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.pjCategorySummary.map((category, i) => {
                            const profitRate = category.amount > 0 ? (category.profit / category.amount) * 100 : 0;
                            return (
                              <tr key={category.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{category.name}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {formatAmount(category.amount)}円
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                                  {formatAmount(category.profit)}円
                                </td>
                                <td className={`px-4 py-3 text-sm text-right font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                  {profitRate.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {category.count.toLocaleString()}件
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {((category.amount / currentData.totalAmount) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* 産業別タブ */}
              {activeTab === "industry" && (
                <>
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800">産業分類別売上</h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentData.industrySummary.slice(0, 15)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatAmount(v)} />
                          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                          <Bar dataKey="amount" fill={COLORS.quinary}>
                            {currentData.industrySummary.slice(0, 15).map((_, i) => (
                              <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 産業別詳細テーブル */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">産業分類別 詳細データ</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">産業分類</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">売上金額</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">粗利率</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.industrySummary.map((industry, i) => {
                            const profitRate = industry.amount > 0 ? (industry.profit / industry.amount) * 100 : 0;
                            return (
                              <tr key={industry.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{industry.name}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {formatAmount(industry.amount)}円
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                                  {formatAmount(industry.profit)}円
                                </td>
                                <td className={`px-4 py-3 text-sm text-right font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                  {profitRate.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {industry.count.toLocaleString()}件
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {((industry.amount / currentData.totalAmount) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* 予実管理タブ */}
              {activeTab === "budget" && budget && (
                <>
                  {/* 達成率ゲージ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AchievementGauge
                      actual={currentData.totalAmount}
                      budget={budget.yearlyBudget}
                      label="年間達成率"
                    />
                    {currentData.quarterlyData.map((q, i) => (
                      <AchievementGauge
                        key={q.quarter}
                        actual={q.amount}
                        budget={budget.quarterlyBudget[i]}
                        label={`${q.quarter} 達成率`}
                      />
                    ))}
                  </div>

                  {/* 月次予実比較 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800">月次 予算vs実績</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={currentData.monthlyData.map((m, i) => ({
                            month: m.month,
                            実績: m.amount,
                            予算: budget.monthlyBudget[i],
                            達成率: budget.monthlyBudget[i] > 0 ? (m.amount / budget.monthlyBudget[i]) * 100 : 0,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" tickFormatter={(v) => formatAmount(v)} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 150]} unit="%" />
                          <Tooltip
                            formatter={(v, name) => [
                              name === "達成率" ? `${(v as number).toFixed(1)}%` : `${(v as number).toLocaleString()}円`,
                              name,
                            ]}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="実績" fill={COLORS.primary} />
                          <Bar yAxisId="left" dataKey="予算" fill={COLORS.denary} />
                          <Line yAxisId="right" type="monotone" dataKey="達成率" stroke={COLORS.tertiary} strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 予実詳細テーブル */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">月次 予実詳細</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">月</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">予算</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">実績</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">差異</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">達成率</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.monthlyData.map((m, i) => {
                            const budgetAmount = budget.monthlyBudget[i];
                            const diff = m.amount - budgetAmount;
                            const rate = budgetAmount > 0 ? (m.amount / budgetAmount) * 100 : 0;
                            return (
                              <tr key={m.month} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.month}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {formatAmount(budgetAmount)}円
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {formatAmount(m.amount)}円
                                </td>
                                <td
                                  className={`px-4 py-3 text-sm text-right font-medium ${
                                    diff >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {diff >= 0 ? "+" : ""}
                                  {formatAmount(diff)}円
                                </td>
                                <td
                                  className={`px-4 py-3 text-sm text-right font-bold ${
                                    rate >= 100 ? "text-green-600" : rate >= 80 ? "text-yellow-600" : "text-red-600"
                                  }`}
                                >
                                  {rate.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                          <tr>
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">合計</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                              {formatAmount(budget.yearlyBudget)}円
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                              {formatAmount(currentData.totalAmount)}円
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-bold ${
                                currentData.totalAmount - budget.yearlyBudget >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {currentData.totalAmount - budget.yearlyBudget >= 0 ? "+" : ""}
                              {formatAmount(currentData.totalAmount - budget.yearlyBudget)}円
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-bold ${
                                (currentData.totalAmount / budget.yearlyBudget) * 100 >= 100
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {((currentData.totalAmount / budget.yearlyBudget) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {!loading && !currentData && !error && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gauge className="w-10 h-10 text-blue-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">データを読み込んでいます...</p>
            </div>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
