"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
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
  ScatterChart,
  Scatter,
  ZAxis,
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
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Shield,
  Printer,
} from "lucide-react";

// 型定義
interface DimensionSummary {
  name: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
  [key: string]: string | number;  // Recharts互換用インデックスシグネチャ
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

// 赤字案件
interface DeficitRecord {
  seiban: string;
  salesDate: string;
  customer: string;
  tantousha: string;
  office: string;
  pjCategory: string;
  industry: string;
  amount: number;
  cost: number;
  profit: number;
  profitRate: number;
}

// 赤字案件分析
interface DeficitAnalysis {
  records: DeficitRecord[];
  totalCount: number;
  totalAmount: number;
  totalLoss: number;
  byPjCategory: { name: string; count: number; loss: number; avgProfitRate: number }[];
  byTantousha: { name: string; office: string; count: number; loss: number; avgProfitRate: number }[];
  byCustomer: { name: string; count: number; loss: number; avgProfitRate: number }[];
  byMonth: { month: string; monthIndex: number; count: number; loss: number }[];
  byIndustry: { name: string; count: number; loss: number; avgProfitRate: number }[];
  patterns: {
    highRiskPjCategories: string[];
    highRiskCustomers: string[];
    seasonalPattern: string | null;
    avgDeficitRate: number;
    commonFactors: string[];
  };
  recommendations: string[];
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
  webNewMonthlyData: {
    month: string;
    monthIndex: number;
    webNew: number;
    webNewCount: number;
    normal: number;
    normalCount: number;
  }[];
  salesPersonSummary: SalesPersonSummary[];
  officeSalesPersons: OfficeSalesPersons[];
  deficitAnalysis?: DeficitAnalysis;
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

// 受注込データ型定義
interface OrdersCombinedMonthly {
  month: string;
  monthIndex: number;
  salesAmount: number;
  salesCount: number;
  orderAmount: number;
  orderCount: number;
  totalAmount: number;
  totalCount: number;
}

interface OrdersCombinedCumulative {
  month: string;
  salesCumulative: number;
  orderCumulative: number;
  totalCumulative: number;
}

interface IrregularRecord {
  seiban: string;
  customer: string;
  tantousha: string;
  office: string;
  amount: number;
  expectedMonth: string;
  pjCategory: string;
}

interface OrdersCombinedData {
  period: number;
  dateRange: { start: string; end: string };
  latestSoldMonth: string;
  monthlyData: OrdersCombinedMonthly[];
  cumulativeData: OrdersCombinedCumulative[];
  totalSalesAmount: number;
  totalSalesCount: number;
  totalOrderAmount: number;
  totalOrderCount: number;
  irregularList: IrregularRecord[];
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
type TabType = "overview" | "orders-combined" | "region" | "office" | "salesperson" | "category" | "budget";

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "概要", icon: <BarChart3 className="w-3 h-3" /> },
  { id: "orders-combined", label: "受注込", icon: <TrendingUp className="w-3 h-3" /> },
  { id: "region", label: "エリア別", icon: <MapPin className="w-3 h-3" /> },
  { id: "office", label: "営業所別", icon: <Building2 className="w-3 h-3" /> },
  { id: "salesperson", label: "担当者別", icon: <User className="w-3 h-3" /> },
  { id: "category", label: "集計区分別", icon: <Filter className="w-3 h-3" /> },
  { id: "budget", label: "予実管理", icon: <Target className="w-3 h-3" /> },
];

// タブ名マップ
const TAB_NAMES: Record<TabType, string> = {
  overview: "概要",
  "orders-combined": "受注込分析",
  region: "エリア別分析",
  office: "営業所別分析",
  salesperson: "担当者別分析",
  category: "集計区分別分析",
  budget: "予実管理",
};

// 印刷ボタンコンポーネント
function PrintButton({
  tabName,
  period,
  dateRange
}: {
  tabName: string;
  period: number;
  dateRange?: { start: string; end: string };
}) {
  const handlePrint = () => {
    // 印刷用ヘッダーを動的に追加
    const printHeader = document.createElement('div');
    printHeader.id = 'print-header-dynamic';
    printHeader.className = 'print-header hidden print:block';
    printHeader.innerHTML = `
      <h1>売上BIダッシュボード - ${tabName}</h1>
      <div class="print-date">
        第${period}期 ${dateRange ? `(${dateRange.start} 〜 ${dateRange.end})` : ''} |
        印刷日: ${new Date().toLocaleDateString('ja-JP')}
      </div>
    `;

    // 既存のヘッダーを削除して新しいものを追加
    const existing = document.getElementById('print-header-dynamic');
    if (existing) existing.remove();
    document.body.insertBefore(printHeader, document.body.firstChild);

    // 印刷実行
    window.print();

    // 印刷後にヘッダーを削除
    setTimeout(() => {
      const header = document.getElementById('print-header-dynamic');
      if (header) header.remove();
    }, 1000);
  };

  return (
    <button
      onClick={handlePrint}
      className="no-print flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm"
      title="このタブをA4縦で印刷"
    >
      <Printer className="w-4 h-4" />
      <span>印刷</span>
    </button>
  );
}

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

// スケルトンコンポーネント
function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className || ""}`} style={style} />
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <SkeletonPulse className="h-4 w-20" />
        <SkeletonPulse className="h-10 w-10 rounded-lg" />
      </div>
      <div className="flex items-end gap-2">
        <SkeletonPulse className="h-8 w-32" />
        <SkeletonPulse className="h-4 w-8 mb-1" />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <SkeletonPulse className="h-3 w-24" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
        <SkeletonPulse className="h-2 w-full rounded-full" />
      </div>
      <div className="flex items-center gap-1 mt-3">
        <SkeletonPulse className="h-4 w-4" />
        <SkeletonPulse className="h-4 w-24" />
      </div>
    </div>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  const barHeights = [45, 60, 35, 70, 55, 80, 40, 65, 50, 75, 45, 60];
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <SkeletonPulse className="h-5 w-5" />
        <span className="text-base font-bold text-gray-400">{title}</span>
      </div>
      <div className="h-72 flex items-end justify-between gap-2 px-4">
        {barHeights.map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <SkeletonPulse
              className="w-full rounded-t"
              style={{ height: `${height}%` }}
            />
            <SkeletonPulse className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <SkeletonPulse className="h-6 w-40 mb-4" />
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-4 flex-1" />
            <SkeletonPulse className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPIカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
      {/* チャート */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton title="月次売上推移を読み込み中..." />
        <ChartSkeleton title="四半期推移を読み込み中..." />
      </div>
      {/* テーブル */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableSkeleton rows={5} />
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
}

export default function BIDashboardPage() {
  const { user, status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodDashboard[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [selectedPeriod, setSelectedPeriod] = useState(50);
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [companyKPI, setCompanyKPI] = useState<CompanyKPIData | null>(null);
  const [ordersCombined, setOrdersCombined] = useState<OrdersCombinedData | null>(null);

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
  // AI分析（営業所別タブ用）
  const [officeAiAnalysis, setOfficeAiAnalysis] = useState<string>("");
  const [isOfficeAnalyzing, setIsOfficeAnalyzing] = useState(false);
  // AI分析（担当者別タブ用）
  const [personAiAnalysis, setPersonAiAnalysis] = useState<string>("");
  const [isPersonAnalyzing, setIsPersonAnalyzing] = useState(false);
  // 全社KPI折りたたみ
  const [isKPIExpanded, setIsKPIExpanded] = useState(true);
  // エリア選択（エリア別タブ用）
  const [selectedArea, setSelectedArea] = useState<string>("all");
  // 営業所詳細選択（営業所別タブ用）
  const [selectedOfficeForDetail, setSelectedOfficeForDetail] = useState<string>("");
  // PJ区分詳細データ折りたたみ（デフォルト: 折りたたみ）
  const [isPjCategoryDetailExpanded, setIsPjCategoryDetailExpanded] = useState(false);
  // 産業分類別詳細データ折りたたみ（デフォルト: 折りたたみ）
  const [isIndustryDetailExpanded, setIsIndustryDetailExpanded] = useState(false);

  // ログインユーザーの社員名
  const loggedInEmployeeName = (user as any)?.employeeName || user?.name || "";

  // データ取得（更新ボタン押下時）
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 過去3年分のデータを取得
      const fromPeriod = selectedPeriod - 2;
      const toPeriod = selectedPeriod;

      // 各APIを安全にフェッチ（1つが失敗しても他は継続）
      const safeJson = async (res: Response, label: string) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[${label}] HTTP ${res.status}: ${text.substring(0, 200)}`);
          try { return JSON.parse(text); } catch { return { error: `HTTP ${res.status}`, details: text.substring(0, 200) }; }
        }
        const text = await res.text();
        if (!text) {
          console.error(`[${label}] Empty response body`);
          return { error: "空のレスポンス" };
        }
        try { return JSON.parse(text); } catch {
          console.error(`[${label}] Invalid JSON: ${text.substring(0, 200)}`);
          return { error: "不正なレスポンス" };
        }
      };

      const responses = await Promise.all([
        fetch(`/api/sales-dashboard?fromPeriod=${fromPeriod}&toPeriod=${toPeriod}`),
        fetch(`/api/sales-budget?period=${selectedPeriod}&office=全社`),
        fetch(`/api/company-kpi?period=${selectedPeriod}`),
        fetch(`/api/sales-orders-combined?period=${selectedPeriod}`),
      ]);

      const [dashboardData, budgetData, kpiData, ordersCombinedData] = await Promise.all([
        safeJson(responses[0], "sales-dashboard"),
        safeJson(responses[1], "sales-budget"),
        safeJson(responses[2], "company-kpi"),
        safeJson(responses[3], "sales-orders-combined"),
      ]);

      if (dashboardData.success) {
        setData(dashboardData.data);
        setCurrentPeriod(dashboardData.currentPeriod);
      } else {
        console.error("Sales dashboard API error:", dashboardData);
        const errorMsg = dashboardData.error || "不明なエラー";
        const errorDetail = dashboardData.details || "";
        setError(`データの取得に失敗しました: ${errorMsg}${errorDetail ? ` (${errorDetail})` : ""}`);
      }

      if (budgetData.success) {
        setBudget(budgetData.data);
      }

      if (kpiData.success && kpiData.data) {
        setCompanyKPI(kpiData.data);
      } else {
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

      if (ordersCombinedData.success) {
        setOrdersCombined(ordersCombinedData.data);
      }

    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(`データの取得中にエラーが発生しました: ${err?.message || String(err)}`);
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
  // 粗利予算 = 年間売上目標 - (年間売上目標 × 原価率)
  const profitBudget = useMemo(() => {
    if (!companyKPI || !budget) return { yearly: 0, ytd: 0, targetRate: 0 };
    // 原価率（%）
    const costRate = companyKPI.costOfSalesRate / 100;
    // 粗利率目標 = 100 - 売上原価率
    const targetProfitRate = 100 - companyKPI.costOfSalesRate;
    // 年間売上目標（円）- 売上予算を使用
    const yearlySalesTarget = budget.yearlyBudget;
    // 年度粗利予算 = 年間売上目標 - (年間売上目標 × 原価率)
    const yearlyProfitBudget = yearlySalesTarget - (yearlySalesTarget * costRate);
    // YTD粗利予算 = YTD売上予算 - (YTD売上予算 × 原価率)
    const ytdProfitBudget = ytdBudget - (ytdBudget * costRate);
    return {
      yearly: yearlyProfitBudget,
      ytd: ytdProfitBudget,
      targetRate: targetProfitRate,
    };
  }, [companyKPI, budget, ytdBudget]);

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

  // 営業所詳細データ（営業所別タブ用）
  const selectedOfficeDetailData = useMemo(() => {
    if (!selectedOfficeForDetail || !currentData) return null;

    const officeSummary = currentData.officeSummary.find((o) => o.name === selectedOfficeForDetail);
    if (!officeSummary) return null;

    // 所属担当者を取得
    const salesPersons = currentData.salesPersonSummary.filter((sp) => sp.office === selectedOfficeForDetail);

    // 月次データを担当者から集計
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthData = { month: currentData.monthlyData[i]?.month || `${i + 1}月`, monthIndex: i, count: 0, amount: 0, cost: 0, profit: 0 };
      salesPersons.forEach((sp) => {
        const spMonth = sp.monthlyData[i];
        if (spMonth) {
          monthData.count += spMonth.count;
          monthData.amount += spMonth.amount;
          monthData.cost += spMonth.cost;
          monthData.profit += spMonth.profit;
        }
      });
      return monthData;
    });

    // 累計データ作成
    let cumAmount = 0, cumProfit = 0, cumCost = 0, cumCount = 0;
    const cumulativeData = monthlyData.map((m) => {
      cumAmount += m.amount;
      cumProfit += m.profit;
      cumCost += m.cost;
      cumCount += m.count;
      return { ...m, amount: cumAmount, profit: cumProfit, cost: cumCost, count: cumCount };
    });

    // 3期比較データ作成
    const getPeriodOfficeMonthlyData = (period: number) => {
      const periodData = data.find((d) => d.period === period);
      if (!periodData) return Array(12).fill({ amount: 0, profit: 0 });
      const persons = periodData.salesPersonSummary.filter((sp) => sp.office === selectedOfficeForDetail);
      return Array.from({ length: 12 }, (_, i) => {
        let amount = 0, profit = 0;
        persons.forEach((sp) => {
          if (sp.monthlyData[i]) {
            amount += sp.monthlyData[i].amount;
            profit += sp.monthlyData[i].profit;
          }
        });
        return { amount, profit };
      });
    };

    const prevPeriodData = getPeriodOfficeMonthlyData(selectedPeriod - 1);
    const prev2PeriodData = getPeriodOfficeMonthlyData(selectedPeriod - 2);

    const salesTrendData = monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.amount,
      [`${selectedPeriod - 1}期`]: prevPeriodData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: prev2PeriodData[i]?.amount || 0,
    }));

    const profitTrendData = monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.profit,
      [`${selectedPeriod - 1}期`]: prevPeriodData[i]?.profit || 0,
      [`${selectedPeriod - 2}期`]: prev2PeriodData[i]?.profit || 0,
    }));

    // 四半期データ
    const quarterlyData = [0, 1, 2, 3].map((q) => {
      const startIdx = q * 3;
      const qData = monthlyData.slice(startIdx, startIdx + 3);
      return {
        quarter: `Q${q + 1}`,
        amount: qData.reduce((sum, m) => sum + m.amount, 0),
        profit: qData.reduce((sum, m) => sum + m.profit, 0),
        cost: qData.reduce((sum, m) => sum + m.cost, 0),
        count: qData.reduce((sum, m) => sum + m.count, 0),
      };
    });

    // 予算データ
    const officeBudget = budget?.officeBudgets?.find((b) => b.office === selectedOfficeForDetail);
    const yearlyBudget = officeBudget?.yearlyBudget || 0;
    const monthlyBudget = officeBudget?.monthlyBudget || Array(12).fill(0);

    // YTD累計予算（実績がある最後の月まで）
    let lastMonthWithData = -1;
    for (let i = 0; i < monthlyData.length; i++) {
      if (monthlyData[i].count > 0) {
        lastMonthWithData = i;
      }
    }
    const ytdBudgetAmount = lastMonthWithData >= 0
      ? monthlyBudget.slice(0, lastMonthWithData + 1).reduce((a: number, b: number) => a + b, 0)
      : 0;
    const lastMonthLabel = lastMonthWithData >= 0 ? monthlyData[lastMonthWithData].month : "";

    // YTD実績（累計）
    const ytdActualAmount = lastMonthWithData >= 0
      ? cumulativeData[lastMonthWithData]?.amount || 0
      : 0;

    // 粗利予算計算（全社KPIの粗利率目標を適用）
    const targetProfitRate = companyKPI ? 100 - companyKPI.costOfSalesRate : 30;
    const yearlyProfitBudget = yearlyBudget * (targetProfitRate / 100);
    const ytdProfitBudget = ytdBudgetAmount * (targetProfitRate / 100);

    // 前年比較データ
    const previousPeriodData = data.find((d) => d.period === selectedPeriod - 1);
    const prevOfficeSummary = previousPeriodData?.officeSummary.find((o) => o.name === selectedOfficeForDetail);

    // 3年分平均単価
    const avgUnitPrices = [selectedPeriod, selectedPeriod - 1, selectedPeriod - 2]
      .map((period) => {
        const periodData = data.find((d) => d.period === period);
        const officeData = periodData?.officeSummary.find((o) => o.name === selectedOfficeForDetail);
        if (!officeData || officeData.count === 0) return null;
        return { period, value: officeData.amount / officeData.count };
      })
      .filter((item): item is { period: number; value: number } => item !== null);

    // 月次比較データ（粗利・原価積み上げ + 予算ライン用）
    const monthlyComparisonData = monthlyData.map((m, i) => ({
      month: m.month,
      粗利: m.profit,
      原価: m.cost,
      予算: monthlyBudget[i] || 0,
    }));

    // 累計比較データ（粗利・原価積み上げ + 予算累計ライン用）
    let cumBudget = 0;
    const cumulativeComparisonData = cumulativeData.map((c, i) => {
      cumBudget += monthlyBudget[i] || 0;
      return {
        month: c.month,
        粗利: c.profit,
        原価: c.cost,
        予算累計: cumBudget,
      };
    });

    // 四半期比較データ（粗利・原価積み上げ + 予算ライン用）
    const quarterlyBudget = [0, 1, 2, 3].map((q) => {
      const startIdx = q * 3;
      return monthlyBudget.slice(startIdx, startIdx + 3).reduce((a: number, b: number) => a + b, 0);
    });
    const quarterlyComparisonData = quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      粗利: q.profit,
      原価: q.cost,
      売上: q.amount,
      予算: quarterlyBudget[i] || 0,
    }));

    // 3期分四半期売上推移データ（折れ線グラフ用）
    const getOfficeQuarterlyData = (period: number) => {
      const periodData = data.find((d) => d.period === period);
      if (!periodData) return [0, 0, 0, 0];
      const persons = periodData.salesPersonSummary.filter((sp) => sp.office === selectedOfficeForDetail);
      return [0, 1, 2, 3].map((q) => {
        const startIdx = q * 3;
        let total = 0;
        persons.forEach((sp) => {
          for (let i = startIdx; i < startIdx + 3 && i < 12; i++) {
            if (sp.monthlyData[i]) {
              total += sp.monthlyData[i].amount;
            }
          }
        });
        return total;
      });
    };
    const period2Quarterly = getOfficeQuarterlyData(selectedPeriod - 1);
    const period3Quarterly = getOfficeQuarterlyData(selectedPeriod - 2);
    const quarterlySalesTrendData = quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      [`${selectedPeriod}期`]: q.amount,
      [`${selectedPeriod - 1}期`]: period2Quarterly[i] || 0,
      [`${selectedPeriod - 2}期`]: period3Quarterly[i] || 0,
    }));

    return {
      office: selectedOfficeForDetail,
      ...officeSummary,
      profitRate: officeSummary.amount > 0 ? (officeSummary.profit / officeSummary.amount) * 100 : 0,
      avgUnitPrice: officeSummary.count > 0 ? officeSummary.amount / officeSummary.count : 0,
      avgUnitPrices,
      salesPersons,
      monthlyData,
      cumulativeData,
      monthlyComparisonData,
      cumulativeComparisonData,
      salesTrendData,
      profitTrendData,
      quarterlyData,
      quarterlyComparisonData,
      quarterlySalesTrendData,
      yearlyBudget,
      monthlyBudget,
      ytdBudgetAmount,
      ytdActualAmount,
      lastMonthLabel,
      yearlyProfitBudget,
      ytdProfitBudget,
      targetProfitRate,
      achievementRate: yearlyBudget > 0 ? (officeSummary.amount / yearlyBudget) * 100 : 0,
      ytdAchievementRate: ytdBudgetAmount > 0 ? (ytdActualAmount / ytdBudgetAmount) * 100 : 0,
      prevAmount: prevOfficeSummary?.amount || 0,
      prevProfit: prevOfficeSummary?.profit || 0,
      yoyAmountChange: prevOfficeSummary?.amount ? ((officeSummary.amount - prevOfficeSummary.amount) / prevOfficeSummary.amount) * 100 : 0,
      yoyProfitChange: prevOfficeSummary?.profit ? ((officeSummary.profit - prevOfficeSummary.profit) / prevOfficeSummary.profit) * 100 : 0,
    };
  }, [currentData, data, selectedOfficeForDetail, selectedPeriod, budget, companyKPI]);

  // 担当者詳細データ拡張（担当者別タブ用）
  const selectedPersonDetailData = useMemo(() => {
    if (!selectedSalesPerson || !currentData?.salesPersonSummary) return null;

    const personData = currentData.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);
    if (!personData) return null;

    // 累計データ作成
    let cumAmount = 0, cumProfit = 0, cumCost = 0, cumCount = 0;
    const cumulativeData = personData.monthlyData.map((m) => {
      cumAmount += m.amount;
      cumProfit += m.profit;
      cumCost += m.cost;
      cumCount += m.count;
      return { ...m, amount: cumAmount, profit: cumProfit, cost: cumCost, count: cumCount };
    });

    // 3期比較データ作成
    const getPeriodPersonMonthlyData = (period: number) => {
      const periodData = data.find((d) => d.period === period);
      const person = periodData?.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);
      return person?.monthlyData || Array(12).fill({ amount: 0, profit: 0, count: 0 });
    };

    const prevPeriodData = getPeriodPersonMonthlyData(selectedPeriod - 1);
    const prev2PeriodData = getPeriodPersonMonthlyData(selectedPeriod - 2);

    const salesTrendData = personData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.amount,
      [`${selectedPeriod - 1}期`]: prevPeriodData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: prev2PeriodData[i]?.amount || 0,
    }));

    const profitTrendData = personData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.profit,
      [`${selectedPeriod - 1}期`]: prevPeriodData[i]?.profit || 0,
      [`${selectedPeriod - 2}期`]: prev2PeriodData[i]?.profit || 0,
    }));

    // 四半期データ
    const quarterlyData = [0, 1, 2, 3].map((q) => {
      const startIdx = q * 3;
      const qData = personData.monthlyData.slice(startIdx, startIdx + 3);
      return {
        quarter: `Q${q + 1}`,
        amount: qData.reduce((sum, m) => sum + m.amount, 0),
        profit: qData.reduce((sum, m) => sum + m.profit, 0),
        cost: qData.reduce((sum, m) => sum + m.cost, 0),
        count: qData.reduce((sum, m) => sum + m.count, 0),
      };
    });

    // 予算データ
    const personBudget = budget?.salesPersonBudgets?.find((b) => b.salesPerson === selectedSalesPerson);
    const yearlyBudget = personBudget?.yearlyBudget || 0;
    const monthlyBudget = personBudget?.monthlyBudget || Array(12).fill(0);

    // YTD累計予算（実績がある最後の月まで）
    let lastMonthWithData = -1;
    for (let i = 0; i < personData.monthlyData.length; i++) {
      if (personData.monthlyData[i].count > 0) {
        lastMonthWithData = i;
      }
    }
    const ytdBudgetAmount = lastMonthWithData >= 0
      ? monthlyBudget.slice(0, lastMonthWithData + 1).reduce((a: number, b: number) => a + b, 0)
      : 0;
    const lastMonthLabel = lastMonthWithData >= 0 ? personData.monthlyData[lastMonthWithData].month : "";

    // YTD実績（累計）
    const ytdActualAmount = lastMonthWithData >= 0
      ? cumulativeData[lastMonthWithData]?.amount || 0
      : 0;

    // 粗利予算計算（全社KPIの粗利率目標を適用）
    const targetProfitRate = companyKPI ? 100 - companyKPI.costOfSalesRate : 30;
    const yearlyProfitBudget = yearlyBudget * (targetProfitRate / 100);
    const ytdProfitBudget = ytdBudgetAmount * (targetProfitRate / 100);

    // 3年分平均単価
    const avgUnitPrices = [selectedPeriod, selectedPeriod - 1, selectedPeriod - 2]
      .map((period) => {
        const periodData = data.find((d) => d.period === period);
        const person = periodData?.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);
        if (!person || person.count === 0) return null;
        return { period, value: person.amount / person.count };
      })
      .filter((item): item is { period: number; value: number } => item !== null);

    // 月次比較データ（粗利・原価積み上げ + 予算ライン用）
    const monthlyComparisonData = personData.monthlyData.map((m, i) => ({
      month: m.month,
      粗利: m.profit,
      原価: m.cost,
      予算: monthlyBudget[i] || 0,
    }));

    // 累計比較データ（粗利・原価積み上げ + 予算累計ライン用）
    let cumBudget = 0;
    const cumulativeComparisonData = cumulativeData.map((c, i) => {
      cumBudget += monthlyBudget[i] || 0;
      return {
        month: c.month,
        粗利: c.profit,
        原価: c.cost,
        予算累計: cumBudget,
      };
    });

    // 四半期比較データ（粗利・原価積み上げ + 予算ライン用）
    const quarterlyBudget = [0, 1, 2, 3].map((q) => {
      const startIdx = q * 3;
      return monthlyBudget.slice(startIdx, startIdx + 3).reduce((a: number, b: number) => a + b, 0);
    });
    const quarterlyComparisonData = quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      粗利: q.profit,
      原価: q.cost,
      売上: q.amount,
      予算: quarterlyBudget[i] || 0,
    }));

    // 3期分四半期売上推移データ（折れ線グラフ用）
    const getPersonQuarterlyData = (period: number) => {
      const periodData = data.find((d) => d.period === period);
      const person = periodData?.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);
      if (!person?.monthlyData) return [0, 0, 0, 0];
      return [0, 1, 2, 3].map((q) => {
        const startIdx = q * 3;
        return person.monthlyData.slice(startIdx, startIdx + 3).reduce((sum, m) => sum + m.amount, 0);
      });
    };
    const period2Quarterly = getPersonQuarterlyData(selectedPeriod - 1);
    const period3Quarterly = getPersonQuarterlyData(selectedPeriod - 2);
    const quarterlySalesTrendData = quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      [`${selectedPeriod}期`]: q.amount,
      [`${selectedPeriod - 1}期`]: period2Quarterly[i] || 0,
      [`${selectedPeriod - 2}期`]: period3Quarterly[i] || 0,
    }));

    // 前年比較データ
    const previousPeriodData = data.find((d) => d.period === selectedPeriod - 1);
    const prevPersonData = previousPeriodData?.salesPersonSummary.find((sp) => sp.name === selectedSalesPerson);

    return {
      ...personData,
      profitRate: personData.amount > 0 ? (personData.profit / personData.amount) * 100 : 0,
      avgUnitPrice: personData.count > 0 ? personData.amount / personData.count : 0,
      avgUnitPrices,
      cumulativeData,
      salesTrendData,
      profitTrendData,
      quarterlyData,
      quarterlyComparisonData,
      quarterlySalesTrendData,
      monthlyComparisonData,
      cumulativeComparisonData,
      yearlyBudget,
      monthlyBudget,
      ytdBudgetAmount,
      ytdActualAmount,
      lastMonthLabel,
      yearlyProfitBudget,
      ytdProfitBudget,
      targetProfitRate,
      achievementRate: yearlyBudget > 0 ? (personData.amount / yearlyBudget) * 100 : 0,
      ytdAchievementRate: ytdBudgetAmount > 0 ? (ytdActualAmount / ytdBudgetAmount) * 100 : 0,
      prevAmount: prevPersonData?.amount || 0,
      prevProfit: prevPersonData?.profit || 0,
      yoyAmountChange: prevPersonData?.amount ? ((personData.amount - prevPersonData.amount) / prevPersonData.amount) * 100 : 0,
      yoyProfitChange: prevPersonData?.profit ? ((personData.profit - prevPersonData.profit) / prevPersonData.profit) * 100 : 0,
    };
  }, [currentData, data, selectedSalesPerson, selectedPeriod, budget, companyKPI]);

  // 営業所→担当者へのドリルダウン
  const handleDrilldownToPerson = (personName: string) => {
    setActiveTab("salesperson");
    setSelectedOffice(selectedOfficeForDetail);
    setSelectedSalesPerson(personName);
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        {/* ヘッダー - 印刷時非表示 */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-white no-print">
          <p className="text-sm text-gray-500 mb-1">
            営業部 &gt; 売上BI
          </p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 flex items-center gap-1">
                <Gauge className="w-5 h-5 text-blue-500" />
                売上BI
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-gray-600">期間:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
            </div>
          </div>

          {/* 全社KPI（折りたたみ可能） */}
          {companyKPI && (
            <div className="mt-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
              <button
                onClick={() => setIsKPIExpanded(!isKPIExpanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-purple-100/50 transition-colors"
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
                <div className="px-2 pb-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">売上目標</div>
                      <div className="font-bold text-gray-800">{formatAmount(companyKPI.salesTarget * 1000)}円</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">売上原価率</div>
                      <div className="font-bold text-orange-600">{companyKPI.costOfSalesRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">販管費率</div>
                      <div className="font-bold text-blue-600">{companyKPI.sgaRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">営業利益率</div>
                      <div className="font-bold text-green-600">{companyKPI.operatingIncomeRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">製造原価率</div>
                      <div className="font-bold text-amber-600">{companyKPI.manufacturingCostRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">実行予算率</div>
                      <div className="font-bold text-cyan-600">{companyKPI.executionBudgetRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">外注発注率</div>
                      <div className="font-bold text-pink-600">{companyKPI.outsourcingRate}%</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5">
                      <div className="text-gray-500">経常利益率</div>
                      <div className="font-bold text-purple-600">{companyKPI.ordinaryIncomeRate}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* タブ */}
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
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
        <main className="flex-1 overflow-y-auto p-4 space-y-4 print:overflow-visible print:p-0">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {loading && <DashboardSkeleton />}

          {!loading && currentData && (
            <>
              {/* 概要タブ */}
              {activeTab === "overview" && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.overview}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
                  {/* KPIカード */}
                  <div className="print-section">
                    <div className="hidden print:block mb-2">
                      <h2 className="text-lg font-bold text-gray-800 border-b-2 border-gray-300 pb-1">KPI サマリー</h2>
                    </div>
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
                  </div>

                  {/* 月次推移グラフ - 印刷時は改ページ */}
                  <div className="print-break-before print-section">
                    <div className="hidden print:block mb-2">
                      <h2 className="text-lg font-bold text-gray-800 border-b-2 border-gray-300 pb-1">月次・累計売上推移</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-blue-500 print:hidden" />
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
                  </div>

                  {/* 3期分推移グラフ（折れ線） - 印刷時は改ページ */}
                  <div className="print-break-before print-section">
                    <div className="hidden print:block mb-2">
                      <h2 className="text-lg font-bold text-gray-800 border-b-2 border-gray-300 pb-1">売上・粗利推移（3期比較）</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-indigo-500 print:hidden" />
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
                  </div>

                  {/* 四半期 & 地域 - 印刷時は改ページ */}
                  <div className="print-break-before print-section">
                    <div className="hidden print:block mb-2">
                      <h2 className="text-lg font-bold text-gray-800 border-b-2 border-gray-300 pb-1">四半期売上分析</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-green-500 print:hidden" />
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
                  </div>

                  {/* AI分析 - 印刷時は非表示 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 no-print">
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

              {/* 受注込タブ */}
              {activeTab === "orders-combined" && ordersCombined && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES["orders-combined"]}
                      period={selectedPeriod}
                      dateRange={ordersCombined.dateRange}
                    />
                  </div>

                  {/* KPIカード */}
                  <div className="print-section">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 売上合計 */}
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">売上合計</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{formatAmount(ordersCombined.totalSalesAmount)}円</div>
                        <div className="text-xs text-gray-500 mt-1">{ordersCombined.totalSalesCount}件</div>
                      </div>
                      {/* 受注残合計 */}
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">受注残合計</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{formatAmount(ordersCombined.totalOrderAmount)}円</div>
                        <div className="text-xs text-gray-500 mt-1">{ordersCombined.totalOrderCount}件</div>
                      </div>
                      {/* 売上+受注残合計 */}
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">売上+受注残 合計</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{formatAmount(ordersCombined.totalSalesAmount + ordersCombined.totalOrderAmount)}円</div>
                        <div className="text-xs text-gray-500 mt-1">{ordersCombined.totalSalesCount + ordersCombined.totalOrderCount}件</div>
                      </div>
                      {/* 不正件数 */}
                      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-rose-500 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">不正件数</span>
                        </div>
                        <div className="text-xl font-bold text-red-600">{ordersCombined.irregularList.length}件</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatAmount(ordersCombined.irregularList.reduce((sum, r) => sum + r.amount, 0))}円
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 月別積み上げ棒グラフ */}
                  <div className="print-section bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">月別 売上・受注残 推移</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={ordersCombined.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v) => formatAmount(v)}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `${Number(value).toLocaleString()}円`,
                            String(name),
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="salesAmount"
                          name="売上"
                          stackId="a"
                          fill="#4e79a7"
                        />
                        <Bar
                          dataKey="orderAmount"
                          name="受注残"
                          stackId="a"
                          fill="#f28e2c"
                        />
                        <Line
                          type="monotone"
                          dataKey="totalAmount"
                          name="合計"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 累計折れ線グラフ */}
                  <div className="print-section bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">累計推移</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={ordersCombined.cumulativeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v) => formatAmount(v)}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `${Number(value).toLocaleString()}円`,
                            String(name),
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="salesCumulative"
                          name="売上累計"
                          stroke="#4e79a7"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="orderCumulative"
                          name="受注残累計"
                          stroke="#f28e2c"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="totalCumulative"
                          name="合計累計"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 不正リスト明細 */}
                  <div className="print-section bg-white rounded-xl shadow-lg p-4 border border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <h3 className="text-sm font-bold text-red-800">
                        不正リスト（売上見込日が最終売上月以前の受注残）
                      </h3>
                      <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        {ordersCombined.irregularList.length}件
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-3">
                      最終売上月: {ordersCombined.latestSoldMonth
                        ? `${ordersCombined.latestSoldMonth.substring(0, 4)}年${ordersCombined.latestSoldMonth.substring(4)}月`
                        : "不明"}
                      {ordersCombined.latestSoldMonth && (
                        <span className="ml-2 text-gray-400">
                          （{ordersCombined.latestSoldMonth.substring(0, 4)}年{ordersCombined.latestSoldMonth.substring(4)}月以前の売上見込日を持つ未売上の受注残を表示）
                        </span>
                      )}
                    </div>
                    {ordersCombined.irregularList.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">不正な受注残はありません</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-red-50 border-b border-red-200">
                              <th className="px-3 py-2 text-left font-bold text-red-800">製番</th>
                              <th className="px-3 py-2 text-left font-bold text-red-800">得意先</th>
                              <th className="px-3 py-2 text-left font-bold text-red-800">担当者</th>
                              <th className="px-3 py-2 text-left font-bold text-red-800">営業所</th>
                              <th className="px-3 py-2 text-right font-bold text-red-800">受注金額</th>
                              <th className="px-3 py-2 text-left font-bold text-red-800">売上見込月</th>
                              <th className="px-3 py-2 text-left font-bold text-red-800">PJ区分</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ordersCombined.irregularList.map((item, idx) => (
                              <tr
                                key={`${item.seiban}-${idx}`}
                                className="border-b border-red-100 bg-red-50/50 hover:bg-red-100/50"
                              >
                                <td className="px-3 py-2 font-medium text-gray-800">{item.seiban}</td>
                                <td className="px-3 py-2 text-gray-700">{item.customer}</td>
                                <td className="px-3 py-2 text-gray-700">{item.tantousha}</td>
                                <td className="px-3 py-2 text-gray-700">{item.office}</td>
                                <td className="px-3 py-2 text-right font-medium text-red-700">
                                  {item.amount.toLocaleString()}円
                                </td>
                                <td className="px-3 py-2 text-gray-700">{item.expectedMonth}</td>
                                <td className="px-3 py-2 text-gray-700">{item.pjCategory}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-red-100 border-t-2 border-red-300">
                              <td colSpan={4} className="px-3 py-2 font-bold text-red-800">
                                合計 ({ordersCombined.irregularList.length}件)
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-red-800">
                                {ordersCombined.irregularList.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}円
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* エリア別タブ */}
              {activeTab === "region" && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.region}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
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
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.office}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
                  {/* 営業所選択 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-500" />
                        営業所別分析
                      </h3>
                      <div className="flex items-center gap-2 no-print">
                        <select
                          value={selectedOfficeForDetail}
                          onChange={(e) => setSelectedOfficeForDetail(e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                        >
                          <option value="">営業所を選択してください</option>
                          {currentData.officeSummary.map((office) => (
                            <option key={office.name} value={office.name}>{office.name}</option>
                          ))}
                        </select>
                        {selectedOfficeForDetail && (
                          <button
                            onClick={() => setSelectedOfficeForDetail("")}
                            className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 営業所詳細（選択時） */}
                    {selectedOfficeDetailData ? (
                      <div className="space-y-4">
                        {/* KPIカード */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">売上金額</span>
                              <span className={`text-xs font-bold ${selectedOfficeDetailData.yoyAmountChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {selectedOfficeDetailData.yoyAmountChange >= 0 ? "+" : ""}{selectedOfficeDetailData.yoyAmountChange.toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-2xl font-bold text-indigo-600">{formatAmount(selectedOfficeDetailData.amount)}円</div>
                            {selectedOfficeDetailData.yearlyBudget > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>年間予算: {formatAmount(selectedOfficeDetailData.yearlyBudget)}円</span>
                                  <span className={`font-bold ${selectedOfficeDetailData.achievementRate >= 100 ? "text-green-600" : selectedOfficeDetailData.achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                    {selectedOfficeDetailData.achievementRate.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${selectedOfficeDetailData.achievementRate >= 100 ? "bg-green-500" : selectedOfficeDetailData.achievementRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedOfficeDetailData.achievementRate, 100)}%` }} />
                                </div>
                                {selectedOfficeDetailData.ytdBudgetAmount > 0 && (
                                  <>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                      <span>累計予算{selectedOfficeDetailData.lastMonthLabel ? `（${selectedOfficeDetailData.lastMonthLabel}まで）` : ""}: {formatAmount(selectedOfficeDetailData.ytdBudgetAmount)}円</span>
                                      <span className={`font-bold ${selectedOfficeDetailData.ytdAchievementRate >= 100 ? "text-green-600" : selectedOfficeDetailData.ytdAchievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                        {selectedOfficeDetailData.ytdAchievementRate.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${selectedOfficeDetailData.ytdAchievementRate >= 100 ? "bg-green-500" : selectedOfficeDetailData.ytdAchievementRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedOfficeDetailData.ytdAchievementRate, 100)}%` }} />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">粗利</span>
                              <span className={`text-xs font-bold ${selectedOfficeDetailData.yoyProfitChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {selectedOfficeDetailData.yoyProfitChange >= 0 ? "+" : ""}{selectedOfficeDetailData.yoyProfitChange.toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-2xl font-bold text-emerald-600">{formatAmount(selectedOfficeDetailData.profit)}円</div>
                            {selectedOfficeDetailData.yearlyProfitBudget > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>年間粗利予算: {formatAmount(selectedOfficeDetailData.yearlyProfitBudget)}円</span>
                                  <span className={`font-bold ${(selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100 >= 100 ? "text-green-600" : (selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                    {((selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${(selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100 >= 100 ? "bg-green-500" : (selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedOfficeDetailData.profit / selectedOfficeDetailData.yearlyProfitBudget) * 100, 100)}%` }} />
                                </div>
                                {selectedOfficeDetailData.ytdProfitBudget > 0 && (
                                  <>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                      <span>累計粗利予算{selectedOfficeDetailData.lastMonthLabel ? `（${selectedOfficeDetailData.lastMonthLabel}まで）` : ""}: {formatAmount(selectedOfficeDetailData.ytdProfitBudget)}円</span>
                                      <span className={`font-bold ${(selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100 >= 100 ? "text-green-600" : (selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100 >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                        {((selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${(selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100 >= 100 ? "bg-green-500" : (selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100 >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min((selectedOfficeDetailData.profit / selectedOfficeDetailData.ytdProfitBudget) * 100, 100)}%` }} />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">粗利率</span>
                            </div>
                            <div className={`text-2xl font-bold ${selectedOfficeDetailData.profitRate >= selectedOfficeDetailData.targetProfitRate ? "text-green-600" : selectedOfficeDetailData.profitRate >= selectedOfficeDetailData.targetProfitRate - 5 ? "text-yellow-600" : "text-red-600"}`}>
                              {selectedOfficeDetailData.profitRate.toFixed(1)}%
                            </div>
                            {selectedOfficeDetailData.targetProfitRate > 0 && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>目標: {selectedOfficeDetailData.targetProfitRate.toFixed(1)}%</span>
                                  <span className={`font-bold ${selectedOfficeDetailData.profitRate >= selectedOfficeDetailData.targetProfitRate ? "text-green-600" : "text-red-600"}`}>
                                    {selectedOfficeDetailData.profitRate >= selectedOfficeDetailData.targetProfitRate ? "+" : ""}{(selectedOfficeDetailData.profitRate - selectedOfficeDetailData.targetProfitRate).toFixed(1)}pt
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                                  <div className="absolute h-full w-0.5 bg-purple-600 z-10" style={{ left: `${Math.min(selectedOfficeDetailData.targetProfitRate, 100)}%` }} />
                                  <div className={`h-full rounded-full ${selectedOfficeDetailData.profitRate >= selectedOfficeDetailData.targetProfitRate ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedOfficeDetailData.profitRate, 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">受注件数</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-600">{selectedOfficeDetailData.count.toLocaleString()}件</div>
                            <div className="mt-2 text-xs text-gray-500">
                              平均単価: {formatAmount(selectedOfficeDetailData.avgUnitPrice)}円
                            </div>
                            {selectedOfficeDetailData.avgUnitPrices && selectedOfficeDetailData.avgUnitPrices.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-orange-100">
                                <div className="text-[10px] text-gray-500 mb-1">平均単価（3年間）</div>
                                <div className="flex gap-1">
                                  {selectedOfficeDetailData.avgUnitPrices.map((item, i) => (
                                    <div key={item.period} className={`flex-1 text-center py-1 rounded ${i === 0 ? "bg-orange-100" : "bg-gray-100"}`}>
                                      <div className="text-[9px] text-gray-400">{item.period}期</div>
                                      <div className={`text-[10px] font-bold ${i === 0 ? "text-orange-600" : "text-gray-600"}`}>
                                        {formatAmount(item.value)}円
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 月次推移・累計グラフ */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3">月次売上推移（粗利・原価構成）</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={selectedOfficeDetailData.monthlyComparisonData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3">累計売上推移（粗利・原価構成）</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={selectedOfficeDetailData.cumulativeComparisonData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                                                <p className="text-sm text-purple-600">累計予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
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

                        {/* 3期比較グラフ */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3">売上推移（3期比較）</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedOfficeDetailData.salesTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend />
                                  <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.quaternary} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3">粗利推移（3期比較）</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedOfficeDetailData.profitTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
                                  <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                                  <Legend />
                                  <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.profit} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                                  <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.quaternary} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* 四半期グラフ（2列） */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* 四半期売上（粗利・原価構成） */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-green-500" />
                              四半期売上（粗利・原価構成）
                            </h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={selectedOfficeDetailData.quarterlyComparisonData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                            <p className="font-bold text-gray-800 mb-2">{label}</p>
                                            <p className="text-gray-600">売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                            <p className="text-green-600">粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                            <p className="text-orange-600">原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                            <p className={`font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                              粗利率: {profitRate.toFixed(1)}%
                                            </p>
                                            {budgetVal > 0 && (
                                              <>
                                                <hr className="my-2 border-gray-200" />
                                                <p className="text-purple-600">予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                                <p className={`font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
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
                                  <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={{ r: 3 }} name="予算" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 四半期売上推移（3期比較） */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-500" />
                              四半期売上推移（3期比較）
                            </h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedOfficeDetailData.quarterlySalesTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                                  <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                        </div>

                        {/* 所属担当者一覧（ドリルダウン） */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                            <h4 className="text-sm font-bold text-white">所属担当者（クリックで詳細へ）</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">担当者</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">売上金額</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">粗利</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">粗利率</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">件数</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">構成比</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {selectedOfficeDetailData.salesPersons
                                  .sort((a, b) => b.amount - a.amount)
                                  .map((person, i) => {
                                    const profitRate = person.amount > 0 ? (person.profit / person.amount) * 100 : 0;
                                    const shareRate = selectedOfficeDetailData.amount > 0 ? (person.amount / selectedOfficeDetailData.amount) * 100 : 0;
                                    return (
                                      <tr
                                        key={person.name}
                                        onClick={() => handleDrilldownToPerson(person.name)}
                                        className={`cursor-pointer hover:bg-indigo-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                                      >
                                        <td className="px-4 py-2 text-sm font-medium text-indigo-600 hover:underline">{person.name}</td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{formatAmount(person.amount)}円</td>
                                        <td className="px-4 py-2 text-sm text-right text-green-600">{formatAmount(person.profit)}円</td>
                                        <td className={`px-4 py-2 text-sm text-right font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                          {profitRate.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{person.count}件</td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{shareRate.toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 営業所未選択時：ランキング表示 */
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
                    )}
                  </div>

                  {/* 営業所別詳細テーブル（常時表示） */}
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
                              <tr
                                key={office.name}
                                onClick={() => setSelectedOfficeForDetail(office.name)}
                                className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedOfficeForDetail === office.name ? "bg-blue-100" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                              >
                                <td className="px-4 py-3 text-sm font-medium text-blue-600 hover:underline">{office.name}</td>
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

                  {/* AI分析（営業所別） */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI営業所分析
                      </h3>
                      <button
                        onClick={async () => {
                          if (!currentData) return;
                          setIsOfficeAnalyzing(true);
                          setOfficeAiAnalysis("");
                          try {
                            const analysisData = {
                              period: selectedPeriod,
                              selectedOffice: selectedOfficeForDetail || "全営業所",
                              selectedOfficeData: selectedOfficeDetailData ? {
                                office: selectedOfficeDetailData.office,
                                amount: selectedOfficeDetailData.amount,
                                profit: selectedOfficeDetailData.profit,
                                profitRate: selectedOfficeDetailData.profitRate,
                                count: selectedOfficeDetailData.count,
                                avgUnitPrice: selectedOfficeDetailData.avgUnitPrice,
                                yearlyBudget: selectedOfficeDetailData.yearlyBudget,
                                achievementRate: selectedOfficeDetailData.achievementRate,
                                ytdBudgetAmount: selectedOfficeDetailData.ytdBudgetAmount,
                                ytdAchievementRate: selectedOfficeDetailData.ytdAchievementRate,
                                yoyAmountChange: selectedOfficeDetailData.yoyAmountChange,
                                yoyProfitChange: selectedOfficeDetailData.yoyProfitChange,
                                salesPersons: selectedOfficeDetailData.salesPersons.slice(0, 5).map((sp: { name: string; amount: number; profit: number; count: number }) => ({
                                  name: sp.name,
                                  amount: sp.amount,
                                  profit: sp.profit,
                                  profitRate: sp.amount > 0 ? (sp.profit / sp.amount) * 100 : 0,
                                  count: sp.count,
                                })),
                                quarterlyData: selectedOfficeDetailData.quarterlyData,
                              } : null,
                              officeSummary: currentData.officeSummary.slice(0, 10).map(o => ({
                                office: o.name,
                                amount: o.amount,
                                profit: o.profit,
                                profitRate: o.amount > 0 ? (o.profit / o.amount) * 100 : 0,
                                count: o.count,
                              })),
                              companyKPI: companyKPI ? {
                                salesTarget: companyKPI.salesTarget * 1000,
                                costOfSalesRate: companyKPI.costOfSalesRate,
                              } : null,
                            };
                            const res = await fetch("/api/ai-analysis", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "sales-office", data: analysisData }),
                            });
                            const result = await res.json();
                            if (result.success) {
                              setOfficeAiAnalysis(result.analysis);
                            } else {
                              setOfficeAiAnalysis("分析の取得に失敗しました。");
                            }
                          } catch (e) {
                            setOfficeAiAnalysis("分析中にエラーが発生しました。");
                          } finally {
                            setIsOfficeAnalyzing(false);
                          }
                        }}
                        disabled={isOfficeAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                      >
                        {isOfficeAnalyzing ? (
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
                    {officeAiAnalysis ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                          {officeAiAnalysis}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {selectedOfficeForDetail
                            ? `「AI分析を実行」で${selectedOfficeForDetail}の詳細分析を行います`
                            : "「AI分析を実行」ボタンを押すと、営業所別データをAIが分析します"}
                        </p>
                      </div>
                    )}
                  </div>

                </>
              )}

              {/* 営業担当者別タブ */}
              {activeTab === "salesperson" && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.salesperson}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
                  {/* フィルター */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 no-print">
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
                  {selectedPersonDetailData && (
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        {selectedPersonDetailData.name} の売上詳細
                        <span className="text-sm font-normal text-gray-500">（{selectedPersonDetailData.office}）</span>
                      </h3>

                      {/* KPIカード */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* 売上金額 */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">売上金額</span>
                            <span className={`text-xs font-bold ${selectedPersonDetailData.yoyAmountChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                              前年比 {selectedPersonDetailData.yoyAmountChange >= 0 ? "+" : ""}{selectedPersonDetailData.yoyAmountChange.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-indigo-600">{formatAmount(selectedPersonDetailData.amount)}円</div>
                          {selectedPersonDetailData.yearlyBudget > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>年間予算: {formatAmount(selectedPersonDetailData.yearlyBudget)}円</span>
                                <span className={`font-bold ${selectedPersonDetailData.achievementRate >= 100 ? "text-green-600" : selectedPersonDetailData.achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                  {selectedPersonDetailData.achievementRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${selectedPersonDetailData.achievementRate >= 100 ? "bg-green-500" : selectedPersonDetailData.achievementRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedPersonDetailData.achievementRate, 100)}%` }} />
                              </div>
                              {selectedPersonDetailData.ytdBudgetAmount > 0 && (
                                <>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>累計予算{selectedPersonDetailData.lastMonthLabel ? `（${selectedPersonDetailData.lastMonthLabel}まで）` : ""}: {formatAmount(selectedPersonDetailData.ytdBudgetAmount)}円</span>
                                    <span className={`font-bold ${selectedPersonDetailData.ytdAchievementRate >= 100 ? "text-green-600" : selectedPersonDetailData.ytdAchievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                      {selectedPersonDetailData.ytdAchievementRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${selectedPersonDetailData.ytdAchievementRate >= 100 ? "bg-green-500" : selectedPersonDetailData.ytdAchievementRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedPersonDetailData.ytdAchievementRate, 100)}%` }} />
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 粗利 */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">粗利</span>
                            <span className={`text-xs font-bold ${selectedPersonDetailData.yoyProfitChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                              前年比 {selectedPersonDetailData.yoyProfitChange >= 0 ? "+" : ""}{selectedPersonDetailData.yoyProfitChange.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-emerald-600">{formatAmount(selectedPersonDetailData.profit)}円</div>
                          {selectedPersonDetailData.yearlyProfitBudget > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>年間粗利予算: {formatAmount(selectedPersonDetailData.yearlyProfitBudget)}円</span>
                                <span className={`font-bold ${(selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100) >= 100 ? "text-green-600" : (selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100) >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                  {(selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${(selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100) >= 100 ? "bg-green-500" : (selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100) >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(selectedPersonDetailData.profit / selectedPersonDetailData.yearlyProfitBudget * 100, 100)}%` }} />
                              </div>
                              {selectedPersonDetailData.ytdProfitBudget > 0 && (
                                <>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>累計粗利予算{selectedPersonDetailData.lastMonthLabel ? `（${selectedPersonDetailData.lastMonthLabel}まで）` : ""}: {formatAmount(selectedPersonDetailData.ytdProfitBudget)}円</span>
                                    {(() => {
                                      const ytdProfit = selectedPersonDetailData.cumulativeData[selectedPersonDetailData.cumulativeData.findIndex((c: { month: string }) => c.month === selectedPersonDetailData.lastMonthLabel)]?.profit || 0;
                                      const ytdProfitAchRate = selectedPersonDetailData.ytdProfitBudget > 0 ? (ytdProfit / selectedPersonDetailData.ytdProfitBudget * 100) : 0;
                                      return (
                                        <span className={`font-bold ${ytdProfitAchRate >= 100 ? "text-green-600" : ytdProfitAchRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                                          {ytdProfitAchRate.toFixed(1)}%
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    {(() => {
                                      const ytdProfit = selectedPersonDetailData.cumulativeData[selectedPersonDetailData.cumulativeData.findIndex((c: { month: string }) => c.month === selectedPersonDetailData.lastMonthLabel)]?.profit || 0;
                                      const ytdProfitAchRate = selectedPersonDetailData.ytdProfitBudget > 0 ? (ytdProfit / selectedPersonDetailData.ytdProfitBudget * 100) : 0;
                                      return (
                                        <div className={`h-full rounded-full ${ytdProfitAchRate >= 100 ? "bg-green-500" : ytdProfitAchRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(ytdProfitAchRate, 100)}%` }} />
                                      );
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 粗利率 */}
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">粗利率</span>
                            <span className="text-xs text-purple-600">目標: {selectedPersonDetailData.targetProfitRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className={`text-2xl font-bold ${selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate ? "text-green-600" : selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate * 0.9 ? "text-yellow-600" : "text-red-600"}`}>
                              {selectedPersonDetailData.profitRate.toFixed(1)}%
                            </div>
                            <div className={`text-sm mb-1 ${selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate ? "text-green-600" : "text-red-600"}`}>
                              ({selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate ? "+" : ""}{(selectedPersonDetailData.profitRate - selectedPersonDetailData.targetProfitRate).toFixed(1)}pt)
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-purple-100">
                            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
                              <div
                                className={`absolute h-full rounded-full transition-all ${selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate ? "bg-green-500" : selectedPersonDetailData.profitRate >= selectedPersonDetailData.targetProfitRate * 0.9 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(selectedPersonDetailData.profitRate / 50 * 100, 100)}%` }}
                              />
                              <div
                                className="absolute w-0.5 h-5 bg-purple-800 -top-1"
                                style={{ left: `${selectedPersonDetailData.targetProfitRate / 50 * 100}%` }}
                                title={`目標: ${selectedPersonDetailData.targetProfitRate}%`}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>0%</span>
                              <span>50%</span>
                            </div>
                          </div>
                        </div>

                        {/* 受注件数 */}
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">受注件数</span>
                          </div>
                          <div className="text-2xl font-bold text-orange-600">{selectedPersonDetailData.count.toLocaleString()}件</div>
                          <div className="mt-2 text-xs text-gray-500">
                            平均単価: {formatAmount(selectedPersonDetailData.avgUnitPrice)}円
                          </div>
                          {selectedPersonDetailData.avgUnitPrices.length > 1 && (
                            <div className="mt-3 pt-3 border-t border-orange-100">
                              <div className="text-xs text-gray-600 mb-2">平均単価推移（3期）</div>
                              <div className="space-y-1">
                                {selectedPersonDetailData.avgUnitPrices.map((item: { period: number; value: number }) => (
                                  <div key={item.period} className="flex justify-between text-xs">
                                    <span className={item.period === selectedPeriod ? "font-bold text-orange-600" : "text-gray-500"}>{item.period}期</span>
                                    <span className={item.period === selectedPeriod ? "font-bold text-orange-600" : "text-gray-600"}>{formatAmount(item.value)}円</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 月次売上推移（粗利・原価構成） */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            月次売上推移（粗利・原価構成）
                          </h4>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={selectedPersonDetailData.monthlyComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                          <p className="font-bold text-gray-800 mb-2">{label}</p>
                                          <p className="text-gray-600">売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                          <p className="text-green-600">粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                          <p className="text-orange-600">原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                          <p className={`font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                            粗利率: {profitRate.toFixed(1)}%
                                          </p>
                                          {budgetVal > 0 && (
                                            <>
                                              <hr className="my-2 border-gray-200" />
                                              <p className="text-purple-600">予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                              <p className={`font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
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
                                <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={{ r: 3 }} name="予算" />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* 累計売上推移（粗利・原価構成） */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            累計売上推移（粗利・原価構成）
                          </h4>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={selectedPersonDetailData.cumulativeComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                          <p className="font-bold text-gray-800 mb-2">{label}（累計）</p>
                                          <p className="text-gray-600">売上累計: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                          <p className="text-green-600">粗利累計: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                          <p className="text-orange-600">原価累計: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                          <p className={`font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                            粗利率: {profitRate.toFixed(1)}%
                                          </p>
                                          {budgetVal > 0 && (
                                            <>
                                              <hr className="my-2 border-gray-200" />
                                              <p className="text-purple-600">予算累計: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                              <p className={`font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
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
                                <Line type="monotone" dataKey="予算累計" stroke={COLORS.budget} strokeWidth={2} dot={{ r: 3 }} name="予算累計" />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* 3期比較グラフ */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" />
                            売上推移（3期比較）
                          </h4>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedPersonDetailData.salesTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                                <Legend />
                                <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.primary} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.denary} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-green-500" />
                            粗利推移（3期比較）
                          </h4>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedPersonDetailData.profitTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                                <Legend />
                                <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.profit} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.denary} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* 四半期グラフ（2列） */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* 四半期売上（粗利・原価構成） */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-green-500" />
                            四半期売上（粗利・原価構成）
                          </h4>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={selectedPersonDetailData.quarterlyComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
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
                                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                          <p className="font-bold text-gray-800 mb-2">{label}</p>
                                          <p className="text-gray-600">売上: <span className="font-medium">{total.toLocaleString()}円</span></p>
                                          <p className="text-green-600">粗利: <span className="font-medium">{profit.toLocaleString()}円</span></p>
                                          <p className="text-orange-600">原価: <span className="font-medium">{cost.toLocaleString()}円</span></p>
                                          <p className={`font-bold mt-1 ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                            粗利率: {profitRate.toFixed(1)}%
                                          </p>
                                          {budgetVal > 0 && (
                                            <>
                                              <hr className="my-2 border-gray-200" />
                                              <p className="text-purple-600">予算: <span className="font-medium">{budgetVal.toLocaleString()}円</span></p>
                                              <p className={`font-bold ${achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
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
                                <Line type="monotone" dataKey="予算" stroke={COLORS.budget} strokeWidth={2} dot={{ r: 3 }} name="予算" />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* 四半期売上推移（3期比較） */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            四半期売上推移（3期比較）
                          </h4>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedPersonDetailData.quarterlySalesTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}円`, name]} />
                                <Legend />
                                <Line type="monotone" dataKey={`${selectedPeriod}期`} stroke={COLORS.primary} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 1}期`} stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey={`${selectedPeriod - 2}期`} stroke={COLORS.denary} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
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

                  {/* AI分析（担当者別） */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI担当者分析
                      </h3>
                      <button
                        onClick={async () => {
                          if (!currentData) return;
                          setIsPersonAnalyzing(true);
                          setPersonAiAnalysis("");
                          try {
                            const analysisData = {
                              period: selectedPeriod,
                              selectedPerson: selectedSalesPerson || "全担当者",
                              selectedOffice: selectedOffice || "全営業所",
                              selectedPersonData: selectedPersonDetailData ? {
                                name: selectedPersonDetailData.name,
                                office: selectedPersonDetailData.office,
                                amount: selectedPersonDetailData.amount,
                                profit: selectedPersonDetailData.profit,
                                profitRate: selectedPersonDetailData.profitRate,
                                count: selectedPersonDetailData.count,
                                avgUnitPrice: selectedPersonDetailData.avgUnitPrice,
                                yearlyBudget: selectedPersonDetailData.yearlyBudget,
                                achievementRate: selectedPersonDetailData.achievementRate,
                                ytdBudgetAmount: selectedPersonDetailData.ytdBudgetAmount,
                                ytdAchievementRate: selectedPersonDetailData.ytdAchievementRate,
                                yoyAmountChange: selectedPersonDetailData.yoyAmountChange,
                                yoyProfitChange: selectedPersonDetailData.yoyProfitChange,
                                targetProfitRate: selectedPersonDetailData.targetProfitRate,
                                quarterlyData: selectedPersonDetailData.quarterlyData,
                              } : null,
                              salesPersonSummary: filteredSalesPersonSummary.slice(0, 10).map(p => ({
                                name: p.name,
                                office: p.office,
                                amount: p.amount,
                                profit: p.profit,
                                profitRate: p.amount > 0 ? (p.profit / p.amount) * 100 : 0,
                                count: p.count,
                              })),
                              companyKPI: companyKPI ? {
                                salesTarget: companyKPI.salesTarget * 1000,
                                costOfSalesRate: companyKPI.costOfSalesRate,
                              } : null,
                            };
                            const res = await fetch("/api/ai-analysis", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "sales-person", data: analysisData }),
                            });
                            const result = await res.json();
                            if (result.success) {
                              setPersonAiAnalysis(result.analysis);
                            } else {
                              setPersonAiAnalysis("分析の取得に失敗しました。");
                            }
                          } catch (e) {
                            setPersonAiAnalysis("分析中にエラーが発生しました。");
                          } finally {
                            setIsPersonAnalyzing(false);
                          }
                        }}
                        disabled={isPersonAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                      >
                        {isPersonAnalyzing ? (
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
                    {personAiAnalysis ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                          {personAiAnalysis}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {selectedSalesPerson
                            ? `「AI分析を実行」で${selectedSalesPerson}の詳細分析を行います`
                            : "「AI分析を実行」ボタンを押すと、担当者別データをAIが分析します"}
                        </p>
                      </div>
                    )}
                  </div>

                </>
              )}

              {/* 区分別タブ */}
              {activeTab === "category" && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.category}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PJ区分 バブルチャート */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        PJ区分 売上・利益分析
                        <span className="text-xs font-normal text-gray-500">（上位10件・横軸: 売上高、縦軸: 粗利、円の大きさ: 件数）</span>
                      </h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              type="number"
                              dataKey="amount"
                              name="売上高"
                              tickFormatter={(v) => formatAmount(v)}
                              tick={{ fontSize: 10 }}
                              label={{ value: "売上高", position: "bottom", offset: 0, fontSize: 11 }}
                            />
                            <YAxis
                              type="number"
                              dataKey="profit"
                              name="粗利"
                              tickFormatter={(v) => formatAmount(v)}
                              tick={{ fontSize: 10 }}
                              label={{ value: "粗利", angle: -90, position: "insideLeft", fontSize: 11 }}
                            />
                            <ZAxis
                              type="number"
                              dataKey="count"
                              range={[100, 1500]}
                              name="件数"
                            />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const profitRate = data.amount > 0 ? (data.profit / data.amount) * 100 : 0;
                                  return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                      <p className="font-bold text-gray-800 mb-2">{data.name}</p>
                                      <p className="text-blue-600">売上高: <span className="font-medium">{data.amount.toLocaleString()}円</span></p>
                                      <p className="text-green-600">粗利: <span className="font-medium">{data.profit.toLocaleString()}円</span></p>
                                      <p className={`font-bold ${profitRate >= 30 ? "text-green-600" : profitRate >= 20 ? "text-yellow-600" : "text-red-600"}`}>
                                        粗利率: {profitRate.toFixed(1)}%
                                      </p>
                                      <p className="text-orange-600">件数: <span className="font-medium">{data.count}件</span></p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Scatter
                              name="PJ区分"
                              data={currentData.pjCategorySummary.filter(d => d.amount > 0).slice(0, 10)}
                              fill={COLORS.primary}
                            >
                              {currentData.pjCategorySummary.filter(d => d.amount > 0).slice(0, 10).map((_, i) => (
                                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 凡例 */}
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {currentData.pjCategorySummary.filter(d => d.amount > 0).slice(0, 10).map((item, i) => (
                          <div key={item.name} className="flex items-center gap-1 text-xs">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="text-gray-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PJ区分 売上高 TOP5 3期比較（表） */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">PJ区分 売上高TOP5 3期比較</h3>
                      {(() => {
                        // 各期のTOP5を取得し、重複を除いて統合
                        const prev2Data = data.find(d => d.period === selectedPeriod - 2);
                        const prev1Data = data.find(d => d.period === selectedPeriod - 1);

                        const top5Current = currentData.pjCategorySummary.slice(0, 5).map(c => c.name);
                        const top5Prev1 = prev1Data?.pjCategorySummary.slice(0, 5).map(c => c.name) || [];
                        const top5Prev2 = prev2Data?.pjCategorySummary.slice(0, 5).map(c => c.name) || [];

                        // 重複を除いて統合
                        const allCategories = [...new Set([...top5Prev2, ...top5Prev1, ...top5Current])];

                        // 表データ作成
                        const tableData = allCategories.map(cat => {
                          const p2Amount = prev2Data?.pjCategorySummary.find(c => c.name === cat)?.amount || 0;
                          const p1Amount = prev1Data?.pjCategorySummary.find(c => c.name === cat)?.amount || 0;
                          const p0Amount = currentData.pjCategorySummary.find(c => c.name === cat)?.amount || 0;
                          const yoyChange = p1Amount > 0 ? ((p0Amount - p1Amount) / p1Amount) * 100 : 0;
                          return { name: cat, p2Amount, p1Amount, p0Amount, yoyChange };
                        }).sort((a, b) => b.p0Amount - a.p0Amount);

                        return (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">PJ区分</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 2}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 1}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-blue-700">{selectedPeriod}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">前年比</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {tableData.map((row, i) => (
                                    <tr key={row.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                      <td className="px-3 py-2 text-xs font-medium text-gray-800">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                          {row.name}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p2Amount)}円</td>
                                      <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p1Amount)}円</td>
                                      <td className="px-3 py-2 text-xs text-right text-blue-600 font-bold">{formatAmount(row.p0Amount)}円</td>
                                      <td className={`px-3 py-2 text-xs text-right font-bold ${row.yoyChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {row.p1Amount > 0 ? `${row.yoyChange >= 0 ? "+" : ""}${row.yoyChange.toFixed(1)}%` : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 text-center">
                              ※ 各期のTOP5を統合（{allCategories.length}カテゴリ）
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* PJ区分詳細データ（折りたたみ可能） */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setIsPjCategoryDetailExpanded(!isPjCategoryDetailExpanded)}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 flex items-center justify-between hover:from-blue-600 hover:to-cyan-600 transition-colors"
                    >
                      <h3 className="text-base font-bold text-white">PJ区分 詳細データ</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-100">{isPjCategoryDetailExpanded ? "折りたたむ" : "展開する"}</span>
                        {isPjCategoryDetailExpanded ? (
                          <ChevronUp className="w-5 h-5 text-white" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </button>
                    {isPjCategoryDetailExpanded && (
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
                    )}
                  </div>

                  {/* 県別 TOP5 & WEB新規 横並びレイアウト */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 県別 TOP5 3期比較（表） */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">納入先県別売上 TOP5 3期比較</h3>
                    {(() => {
                      // 各期のTOP5を取得し、重複を除いて統合
                      const prev2Data = data.find(d => d.period === selectedPeriod - 2);
                      const prev1Data = data.find(d => d.period === selectedPeriod - 1);

                      const top5Current = currentData.prefectureSummary.slice(0, 5).map(c => c.name);
                      const top5Prev1 = prev1Data?.prefectureSummary.slice(0, 5).map(c => c.name) || [];
                      const top5Prev2 = prev2Data?.prefectureSummary.slice(0, 5).map(c => c.name) || [];

                      // 重複を除いて統合
                      const allPrefectures = [...new Set([...top5Prev2, ...top5Prev1, ...top5Current])];

                      // 表データ作成
                      const tableData = allPrefectures.map(pref => {
                        const p2Amount = prev2Data?.prefectureSummary.find(c => c.name === pref)?.amount || 0;
                        const p1Amount = prev1Data?.prefectureSummary.find(c => c.name === pref)?.amount || 0;
                        const p0Amount = currentData.prefectureSummary.find(c => c.name === pref)?.amount || 0;
                        const yoyChange = p1Amount > 0 ? ((p0Amount - p1Amount) / p1Amount) * 100 : 0;
                        return { name: pref, p2Amount, p1Amount, p0Amount, yoyChange };
                      }).sort((a, b) => b.p0Amount - a.p0Amount);

                      return (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">県名</th>
                                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 2}期</th>
                                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 1}期</th>
                                  <th className="px-3 py-2 text-right text-xs font-bold text-blue-700">{selectedPeriod}期</th>
                                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">前年比</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {tableData.map((row, i) => (
                                  <tr key={row.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                    <td className="px-3 py-2 text-xs font-medium text-gray-800">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        {row.name}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p2Amount)}円</td>
                                    <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p1Amount)}円</td>
                                    <td className="px-3 py-2 text-xs text-right text-blue-600 font-bold">{formatAmount(row.p0Amount)}円</td>
                                    <td className={`px-3 py-2 text-xs text-right font-bold ${row.yoyChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {row.p1Amount > 0 ? `${row.yoyChange >= 0 ? "+" : ""}${row.yoyChange.toFixed(1)}%` : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-2 text-xs text-gray-500 text-center">
                            ※ 各期のTOP5を統合（{allPrefectures.length}県）
                          </div>
                        </>
                      );
                    })()}
                  </div>

                    {/* WEB新規 月別売上推移 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">WEB新規 月別売上推移</h3>
                    {(() => {
                      const webNewData = currentData.webNewMonthlyData || [];
                      // 累計データを作成
                      let cumulative = 0;
                      const chartData = webNewData.map(d => {
                        cumulative += d.webNew;
                        return {
                          month: d.month,
                          webNew: d.webNew,
                          cumulative: cumulative,
                        };
                      });
                      const webNewTotal = webNewData.reduce((sum, d) => sum + d.webNew, 0);
                      const webNewCount = webNewData.reduce((sum, d) => sum + d.webNewCount, 0);

                      return (
                        <>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis
                                  yAxisId="left"
                                  tickFormatter={(v) => formatAmount(v)}
                                  tick={{ fontSize: 10 }}
                                  orientation="left"
                                />
                                <YAxis
                                  yAxisId="right"
                                  tickFormatter={(v) => formatAmount(v)}
                                  tick={{ fontSize: 10 }}
                                  orientation="right"
                                />
                                <Tooltip
                                  formatter={(value, name) => {
                                    const label = name === "webNew" ? "月次売上" : "累計売上";
                                    return [`${Number(value).toLocaleString()}円`, label];
                                  }}
                                />
                                <Legend
                                  formatter={(value) => value === "webNew" ? "月次売上" : "累計売上"}
                                />
                                <Bar yAxisId="left" dataKey="webNew" name="webNew" fill="#22c55e" />
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="cumulative"
                                  name="cumulative"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  dot={{ r: 4 }}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                          {/* WEB新規サマリー */}
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-green-600 font-medium">WEB新規 売上合計</p>
                              <p className="text-lg font-bold text-green-700">{formatAmount(webNewTotal)}円</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-blue-600 font-medium">WEB新規 件数</p>
                              <p className="text-lg font-bold text-blue-700">{webNewCount}件</p>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-purple-600 font-medium">平均単価</p>
                              <p className="text-lg font-bold text-purple-700">
                                {webNewCount > 0 ? formatAmount(Math.round(webNewTotal / webNewCount)) : 0}円
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    </div>
                  </div>

                  {/* 産業分類別売上 TOP5（円グラフ & 3期比較） */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 円グラフ */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">産業分類別売上 TOP5</h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={currentData.industrySummary.slice(0, 5)}
                              dataKey="amount"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                              labelLine={{ stroke: "#666", strokeWidth: 1 }}
                            >
                              {currentData.industrySummary.slice(0, 5).map((_, i) => (
                                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, "売上"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {currentData.industrySummary.slice(0, 5).map((item, i) => (
                          <div key={item.name} className="flex items-center gap-1 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-gray-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3期比較表 */}
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800">産業分類別売上 TOP5 3期比較</h3>
                      {(() => {
                        // 各期のTOP5を取得し、重複を除いて統合
                        const prev2Data = data.find(d => d.period === selectedPeriod - 2);
                        const prev1Data = data.find(d => d.period === selectedPeriod - 1);

                        const top5Current = currentData.industrySummary.slice(0, 5).map(c => c.name);
                        const top5Prev1 = prev1Data?.industrySummary.slice(0, 5).map(c => c.name) || [];
                        const top5Prev2 = prev2Data?.industrySummary.slice(0, 5).map(c => c.name) || [];

                        // 重複を除いて統合
                        const allIndustries = [...new Set([...top5Prev2, ...top5Prev1, ...top5Current])];

                        // 表データ作成
                        const tableData = allIndustries.map(ind => {
                          const p2Amount = prev2Data?.industrySummary.find(c => c.name === ind)?.amount || 0;
                          const p1Amount = prev1Data?.industrySummary.find(c => c.name === ind)?.amount || 0;
                          const p0Amount = currentData.industrySummary.find(c => c.name === ind)?.amount || 0;
                          const yoyChange = p1Amount > 0 ? ((p0Amount - p1Amount) / p1Amount) * 100 : 0;
                          return { name: ind, p2Amount, p1Amount, p0Amount, yoyChange };
                        }).sort((a, b) => b.p0Amount - a.p0Amount);

                        return (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">産業分類</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 2}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">{selectedPeriod - 1}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-blue-700">{selectedPeriod}期</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">前年比</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {tableData.map((row, i) => (
                                    <tr key={row.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                      <td className="px-3 py-2 text-xs font-medium text-gray-800">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                          {row.name}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p2Amount)}円</td>
                                      <td className="px-3 py-2 text-xs text-right text-gray-600">{formatAmount(row.p1Amount)}円</td>
                                      <td className="px-3 py-2 text-xs text-right text-blue-600 font-bold">{formatAmount(row.p0Amount)}円</td>
                                      <td className={`px-3 py-2 text-xs text-right font-bold ${row.yoyChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {row.p1Amount > 0 ? `${row.yoyChange >= 0 ? "+" : ""}${row.yoyChange.toFixed(1)}%` : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 text-center">
                              ※ 各期のTOP5を統合（{allIndustries.length}分類）
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 産業分類別詳細テーブル（折りたたみ可能） */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setIsIndustryDetailExpanded(!isIndustryDetailExpanded)}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 flex items-center justify-between hover:from-green-600 hover:to-emerald-600 transition-colors"
                    >
                      <h3 className="text-base font-bold text-white">産業分類別 詳細データ</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-100">{isIndustryDetailExpanded ? "折りたたむ" : "展開する"}</span>
                        {isIndustryDetailExpanded ? (
                          <ChevronUp className="w-5 h-5 text-white" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </button>
                    {isIndustryDetailExpanded && (
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
                    )}
                  </div>

                </>
              )}

              {/* 予実管理タブ */}
              {activeTab === "budget" && budget && (
                <>
                  {/* 印刷ボタン */}
                  <div className="flex justify-end mb-4 no-print">
                    <PrintButton
                      tabName={TAB_NAMES.budget}
                      period={selectedPeriod}
                      dateRange={currentData.dateRange}
                    />
                  </div>
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
