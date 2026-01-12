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
} from "lucide-react";

// 型定義
interface DimensionSummary {
  name: string;
  count: number;
  amount: number;
}

interface MonthlyData {
  month: string;
  monthIndex: number;
  count: number;
  amount: number;
}

interface QuarterlyData {
  quarter: string;
  count: number;
  amount: number;
}

interface RegionSummary {
  region: string;
  regionKey: "east" | "west" | "hq";
  count: number;
  amount: number;
  offices: DimensionSummary[];
}

interface SalesPersonSummary {
  name: string;
  office: string;
  count: number;
  amount: number;
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

interface BudgetData {
  period: number;
  office: string;
  monthlyBudget: number[];
  yearlyBudget: number;
  quarterlyBudget: number[];
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
  { id: "region", label: "地域別", icon: <MapPin className="w-4 h-4" /> },
  { id: "office", label: "営業所別", icon: <Building2 className="w-4 h-4" /> },
  { id: "salesperson", label: "担当者別", icon: <User className="w-4 h-4" /> },
  { id: "category", label: "区分別", icon: <Filter className="w-4 h-4" /> },
  { id: "industry", label: "産業別", icon: <Users className="w-4 h-4" /> },
  { id: "budget", label: "予実管理", icon: <Target className="w-4 h-4" /> },
];

// KPIカードコンポーネント
function KPICard({
  title,
  value,
  unit,
  change,
  icon,
  color = "emerald",
}: {
  title: string;
  value: string;
  unit?: string;
  change?: { value: number; trend: "up" | "down" | "flat" };
  icon: React.ReactNode;
  color?: string;
}) {
  const colorClasses = {
    emerald: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-indigo-500",
    purple: "from-purple-500 to-pink-500",
    orange: "from-orange-500 to-amber-500",
  };

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
            {change.value.toFixed(1)}% 前年比
          </span>
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

  // 営業担当者フィルター
  const [selectedOffice, setSelectedOffice] = useState<string>("");
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>("");
  const [filterInitialized, setFilterInitialized] = useState(false);

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

      const [dashboardRes, budgetRes] = await Promise.all([
        fetch(`/api/sales-dashboard?fromPeriod=${fromPeriod}&toPeriod=${toPeriod}`),
        fetch(`/api/sales-budget?period=${selectedPeriod}&office=全社`),
      ]);

      const dashboardData = await dashboardRes.json();
      const budgetData = await budgetRes.json();

      if (dashboardData.success) {
        setData(dashboardData.data);
        setCurrentPeriod(dashboardData.currentPeriod);
      } else {
        setError("データの取得に失敗しました");
      }

      if (budgetData.success) {
        setBudget(budgetData.data);
      }
    } catch (err) {
      setError("データの取得中にエラーが発生しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  // 月次比較データ作成
  const monthlyComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.monthlyData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.amount,
      [`${selectedPeriod - 1}期`]: previousData?.monthlyData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: data.find((d) => d.period === selectedPeriod - 2)?.monthlyData[i]?.amount || 0,
    }));
  }, [currentData, previousData, data, selectedPeriod]);

  // 累計比較データ作成
  const cumulativeComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.cumulativeData.map((m, i) => ({
      month: m.month,
      [`${selectedPeriod}期`]: m.amount,
      [`${selectedPeriod - 1}期`]: previousData?.cumulativeData[i]?.amount || 0,
      [`${selectedPeriod - 2}期`]: data.find((d) => d.period === selectedPeriod - 2)?.cumulativeData[i]?.amount || 0,
      予算累計: budget ? budget.monthlyBudget.slice(0, i + 1).reduce((a, b) => a + b, 0) : 0,
    }));
  }, [currentData, previousData, data, selectedPeriod, budget]);

  // 四半期比較データ作成
  const quarterlyComparisonData = useMemo(() => {
    if (!currentData) return [];
    return currentData.quarterlyData.map((q, i) => ({
      quarter: q.quarter,
      [`${selectedPeriod}期`]: q.amount,
      [`${selectedPeriod - 1}期`]: previousData?.quarterlyData[i]?.amount || 0,
      予算: budget?.quarterlyBudget?.[i] || 0,
    }));
  }, [currentData, previousData, selectedPeriod, budget]);

  // 地域別データ
  const regionData = useMemo(() => {
    if (!currentData) return [];
    return currentData.regionSummary.map((r) => ({
      name: r.region,
      value: r.amount,
      count: r.count,
      color: REGION_COLORS[r.regionKey],
    }));
  }, [currentData]);

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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                      title="売上金額"
                      value={formatAmount(currentData.totalAmount)}
                      unit="円"
                      change={previousData ? calcChange(currentData.totalAmount, previousData.totalAmount) : undefined}
                      icon={<TrendingUp className="w-5 h-5 text-white" />}
                      color="emerald"
                    />
                    <KPICard
                      title="受注件数"
                      value={currentData.totalCount.toLocaleString()}
                      unit="件"
                      change={previousData ? calcChange(currentData.totalCount, previousData.totalCount) : undefined}
                      icon={<BarChart3 className="w-5 h-5 text-white" />}
                      color="blue"
                    />
                    <KPICard
                      title="平均受注額"
                      value={formatAmount(currentData.totalCount > 0 ? currentData.totalAmount / currentData.totalCount : 0)}
                      unit="円/件"
                      icon={<Target className="w-5 h-5 text-white" />}
                      color="purple"
                    />
                    <KPICard
                      title="予算達成率"
                      value={budget ? `${((currentData.totalAmount / budget.yearlyBudget) * 100).toFixed(1)}` : "-"}
                      unit="%"
                      icon={<Gauge className="w-5 h-5 text-white" />}
                      color="orange"
                    />
                  </div>

                  {/* 月次推移グラフ */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        月次売上推移（3期比較）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod}期`}
                              stroke={COLORS.primary}
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 1}期`}
                              stroke={COLORS.secondary}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                            />
                            <Line
                              type="monotone"
                              dataKey={`${selectedPeriod - 2}期`}
                              stroke={COLORS.denary}
                              strokeWidth={1}
                              strokeDasharray="3 3"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-500" />
                        累計売上推移（予算対比）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cumulativeComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatAmount(v)} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey={`${selectedPeriod}期`}
                              fill={COLORS.primary}
                              fillOpacity={0.3}
                              stroke={COLORS.primary}
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="予算累計"
                              stroke={COLORS.tertiary}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 四半期 & 地域 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-500" />
                        四半期売上（予算対比）
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={quarterlyComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="quarter" />
                            <YAxis tickFormatter={(v) => formatAmount(v)} />
                            <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}円`, ""]} />
                            <Legend />
                            <Bar dataKey={`${selectedPeriod}期`} fill={COLORS.primary} />
                            <Bar dataKey={`${selectedPeriod - 1}期`} fill={COLORS.quaternary} />
                            <Line type="monotone" dataKey="予算" stroke={COLORS.tertiary} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                      <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        地域別売上構成
                      </h3>
                      <div className="h-72 flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                          <PieChart>
                            <Pie
                              data={regionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
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
                        <div className="w-40 space-y-2">
                          {regionData.map((r) => (
                            <div key={r.name} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700">{r.name}</div>
                                <div className="text-xs text-gray-500">{formatAmount(r.value)}円</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 地域別タブ */}
              {activeTab === "region" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentData.regionSummary.map((region) => (
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
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-600 mb-2">営業所内訳</div>
                          {region.offices.slice(0, 5).map((office) => (
                            <div key={office.name} className="flex justify-between text-sm">
                              <span className="text-gray-600">{office.name}</span>
                              <span className="font-medium text-gray-800">{formatAmount(office.amount)}円</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 地域別3期比較 */}
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                    <h3 className="text-base font-bold mb-4 text-gray-800">地域別 3期比較</h3>
                    <div className="h-80">
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
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">平均単価</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.officeSummary.map((office, i) => (
                            <tr key={office.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{office.name}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {formatAmount(office.amount)}円
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {office.count.toLocaleString()}件
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {formatAmount(office.count > 0 ? office.amount / office.count : 0)}円
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {((office.amount / currentData.totalAmount) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
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
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">平均単価</th>
                                <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredSalesPersonSummary.map((person, i) => (
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
                                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                                    {person.count.toLocaleString()}件
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                                    {formatAmount(person.count > 0 ? person.amount / person.count : 0)}円
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                                    {currentData && ((person.amount / currentData.totalAmount) * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
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
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">受注件数</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">平均単価</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">構成比</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentData.industrySummary.map((industry, i) => (
                            <tr key={industry.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{industry.name}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {formatAmount(industry.amount)}円
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {industry.count.toLocaleString()}件
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {formatAmount(industry.count > 0 ? industry.amount / industry.count : 0)}円
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {((industry.amount / currentData.totalAmount) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
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
