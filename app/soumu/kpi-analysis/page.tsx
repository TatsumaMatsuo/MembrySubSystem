"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  RefreshCw,
  Loader2,
  FileText,
  Phone,
  Zap,
  ShoppingBag,
  ChevronRight,
  DollarSign,
  Hash,
  Sparkles,
  Building2,
  Printer,
} from "lucide-react";

// 型定義
interface MonthlyExpense {
  month: string;
  monthIndex: number;
  count: number;
  amount: number;
  sheets: number;
}

interface QuarterlyExpense {
  quarter: string;
  count: number;
  amount: number;
  sheets: number;
}

interface ExpenseRecord {
  date: string | null;
  month: string | null;
  amount: number;
  sheets: number;
  category: string;
  department: string;
}

interface CopyExpenseData {
  success: boolean;
  period: number;
  currentPeriod: number;
  dateRange: { start: string; end: string };
  totalExpense: number;
  totalCount: number;
  totalSheets: number;
  monthlyAverage: number;
  maxMonth: { month: string; amount: number };
  monthlyData: MonthlyExpense[];
  quarterlyData: QuarterlyExpense[];
  records: ExpenseRecord[];
}

// カラーパレット
const COLORS = {
  primary: "#4e79a7",
  secondary: "#f28e2c",
  tertiary: "#e15759",
  quaternary: "#76b7b2",
  accent: "#59a14f",
  line: "#af7aa1",
};

const PIE_COLORS = [
  "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
  "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab",
];

// 金額フォーマット
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}億`;
  } else if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}千万`;
  } else if (amount >= 10000) {
    return `${Math.round(amount / 10000)}万`;
  }
  return amount.toLocaleString();
}

// カテゴリメニュー定義
type CategoryType = "copy" | "telecom" | "utility" | "supplies";

const CATEGORIES: { id: CategoryType; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: "copy", label: "コピー経費", icon: <FileText className="w-4 h-4" />, enabled: true },
  { id: "telecom", label: "通信費", icon: <Phone className="w-4 h-4" />, enabled: false },
  { id: "utility", label: "光熱費", icon: <Zap className="w-4 h-4" />, enabled: false },
  { id: "supplies", label: "消耗品費", icon: <ShoppingBag className="w-4 h-4" />, enabled: false },
];

// スケルトンコンポーネント
function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className || ""}`} />;
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <SkeletonPulse className="h-4 w-20" />
        <SkeletonPulse className="h-10 w-10 rounded-lg" />
      </div>
      <SkeletonPulse className="h-8 w-32" />
      <SkeletonPulse className="h-3 w-24 mt-2" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <SkeletonPulse className="h-5 w-40 mb-4" />
      <SkeletonPulse className="h-64 w-full" />
    </div>
  );
}

// KPIカードコンポーネント（簡易版）
function KPICard({
  title,
  value,
  unit,
  icon,
  color = "emerald",
  subText,
}: {
  title: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
  subText?: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-indigo-500",
    purple: "from-purple-500 to-pink-500",
    orange: "from-orange-500 to-amber-500",
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color] || colorClasses.emerald}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {unit && <span className="text-sm text-gray-500 mb-1">{unit}</span>}
      </div>
      {subText && (
        <p className="text-xs text-gray-400 mt-1">{subText}</p>
      )}
    </div>
  );
}

export default function SoumuKPIAnalysisPage() {
  const { status } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("copy");
  const [selectedPeriod, setSelectedPeriod] = useState<number>(50);
  const [activeTab, setActiveTab] = useState<"overview" | "offices">("overview");
  const [data, setData] = useState<CopyExpenseData | null>(null);
  const [comparisonData, setComparisonData] = useState<CopyExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // 単一期のデータ取得
  const fetchPeriod = async (period: number, noCache = false): Promise<CopyExpenseData | null> => {
    const params = new URLSearchParams({ period: String(period) });
    if (noCache) params.set("noCache", "true");
    const response = await fetch(`/api/copy-expense?${params}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.error) return null;
    return result;
  };

  // データ取得（選択期 + 過去2期）
  const fetchData = async (noCache = false) => {
    setLoading(true);
    setError(null);
    try {
      // 選択期と過去4期を並列取得（5年分）
      const periods = [selectedPeriod, selectedPeriod - 1, selectedPeriod - 2, selectedPeriod - 3, selectedPeriod - 4];
      const results = await Promise.all(periods.map((p) => fetchPeriod(p, noCache)));

      const current = results[0];
      if (!current) {
        throw new Error("選択期のデータ取得に失敗しました");
      }
      setData(current);
      // 期の昇順でソート
      setComparisonData(
        results.filter((r): r is CopyExpenseData => r !== null).sort((a, b) => a.period - b.period)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 期変更時にデータ再取得
  useEffect(() => {
    if (status === "authenticated" && selectedCategory === "copy") {
      fetchData();
    }
  }, [selectedPeriod, selectedCategory, status]);

  // 期選択肢を生成（45期〜現在期）
  const periodOptions = [];
  const currentPeriod = data?.currentPeriod || 50;
  for (let p = currentPeriod; p >= 45; p--) {
    const startYear = p + 1975;
    periodOptions.push({
      value: p,
      label: `第${p}期 (${startYear}/${startYear + 1})`,
    });
  }

  // 累計データを計算
  const cumulativeData = data?.monthlyData
    ? data.monthlyData.reduce((acc: any[], m, i) => {
        const prev = i > 0 ? acc[i - 1].cumAmount : 0;
        acc.push({
          ...m,
          cumAmount: prev + m.amount,
        });
        return acc;
      }, [])
    : [];

  // 3年比較用データ（直近3期、昇順）
  const chart3Years = comparisonData.slice(-3);

  const yearComparisonData = (() => {
    if (chart3Years.length === 0) return [];
    const months = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
    return months.map((month, i) => {
      const row: any = { month };
      for (const pd of chart3Years) {
        const m = pd.monthlyData.find((md) => md.monthIndex === i);
        row[`${pd.period}期`] = m?.amount || 0;
      }
      return row;
    });
  })();

  // 5年分の期別総額サマリー（昇順）
  const yearlySummary = comparisonData.map((pd, idx) => {
    const prev = idx > 0 ? comparisonData[idx - 1] : null;
    const diff = prev ? pd.totalExpense - prev.totalExpense : null;
    const changeRate = prev && prev.totalExpense > 0
      ? ((pd.totalExpense - prev.totalExpense) / prev.totalExpense) * 100
      : null;
    return {
      period: pd.period,
      totalExpense: pd.totalExpense,
      diff,
      changeRate,
    };
  });

  // 事業所別集計（全件）
  const departmentDataAll = (() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const r of data.records) {
      const dept = r.department || "不明";
      map.set(dept, (map.get(dept) || 0) + r.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        ratio: data.totalExpense > 0 ? (amount / data.totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  })();

  // 印刷種別集計（全件）
  const categoryDataAll = (() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const r of data.records) {
      const cat = r.category || "不明";
      map.set(cat, (map.get(cat) || 0) + r.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        ratio: data.totalExpense > 0 ? (amount / data.totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  })();

  // 印刷種別 円グラフ用
  const categoryPieData = (() => {
    if (categoryDataAll.length <= 8) return categoryDataAll;
    const top = categoryDataAll.slice(0, 7);
    const others = categoryDataAll.slice(7);
    const othersAmount = others.reduce((sum, d) => sum + d.amount, 0);
    const total = data?.totalExpense || 1;
    return [
      ...top,
      { name: `その他(${others.length}件)`, amount: othersAmount, ratio: (othersAmount / total) * 100 },
    ];
  })();

  // 印刷種別ごとの上位7事業所
  const categoryByDept = (() => {
    if (!data) return new Map<string, { name: string; amount: number }[]>();
    const map = new Map<string, Map<string, number>>();
    for (const r of data.records) {
      const cat = r.category || "不明";
      const dept = r.department || "不明";
      if (!map.has(cat)) map.set(cat, new Map());
      const deptMap = map.get(cat)!;
      deptMap.set(dept, (deptMap.get(dept) || 0) + r.amount);
    }
    const result = new Map<string, { name: string; amount: number }[]>();
    for (const [cat, deptMap] of map) {
      result.set(
        cat,
        Array.from(deptMap.entries())
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
      );
    }
    return result;
  })();

  // 四半期×印刷種別 集計（積み上げ棒グラフ用）
  // 月名→四半期マッピング（Q1:8-10月, Q2:11-1月, Q3:2-4月, Q4:5-7月）
  const monthToQuarter: Record<string, string> = {
    "8月": "Q1", "9月": "Q1", "10月": "Q1",
    "11月": "Q2", "12月": "Q2", "1月": "Q2",
    "2月": "Q3", "3月": "Q3", "4月": "Q3",
    "5月": "Q4", "6月": "Q4", "7月": "Q4",
  };
  const quarterByCategoryData = (() => {
    if (!data) return { chartData: [] as any[], categories: [] as string[] };
    const qMap = new Map<string, Map<string, number>>();
    for (const r of data.records) {
      const q = r.month ? monthToQuarter[r.month] : null;
      if (!q) continue;
      const cat = r.category || "不明";
      if (!qMap.has(q)) qMap.set(q, new Map());
      const catMap = qMap.get(q)!;
      catMap.set(cat, (catMap.get(cat) || 0) + r.amount);
    }
    // 全カテゴリ一覧（金額降順）
    const allCats = new Map<string, number>();
    for (const catMap of qMap.values()) {
      for (const [cat, amount] of catMap) {
        allCats.set(cat, (allCats.get(cat) || 0) + amount);
      }
    }
    const categories = Array.from(allCats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    // チャートデータ
    const chartData = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
      const row: any = { quarter: q };
      const catMap = qMap.get(q);
      for (const cat of categories) {
        row[cat] = catMap?.get(cat) || 0;
      }
      return row;
    });
    return { chartData, categories };
  })();

  // 事業所別タブ用: 事業所→月→印刷種別→枚数
  const OFFICE_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
  const PRINT_TYPES = ["カラー", "2色", "モノクロ"];
  const officeData = (() => {
    if (!data) return [];
    const deptMap = new Map<string, Map<string, Map<string, number>>>();
    for (const r of data.records) {
      const dept = r.department || "不明";
      const month = r.month;
      const cat = r.category || "不明";
      if (!month) continue;
      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const monthMap = deptMap.get(dept)!;
      if (!monthMap.has(month)) monthMap.set(month, new Map());
      const catMap = monthMap.get(month)!;
      catMap.set(cat, (catMap.get(cat) || 0) + r.sheets);
    }
    return Array.from(deptMap.entries()).map(([dept, monthMap]) => {
      let totalSheets = 0;
      for (const catMap of monthMap.values()) {
        for (const sheets of catMap.values()) {
          totalSheets += sheets;
        }
      }
      const byType = PRINT_TYPES.map((type) => {
        const months = OFFICE_MONTHS.map((month, i) => {
          const sheets = monthMap.get(month)?.get(type) || 0;
          const prevMonth = i > 0 ? OFFICE_MONTHS[i - 1] : null;
          const prevSheets = prevMonth !== null ? (monthMap.get(prevMonth)?.get(type) || 0) : null;
          const diff = prevSheets !== null ? sheets - prevSheets : null;
          return { month, sheets, diff };
        });
        const total = months.reduce((sum, m) => sum + m.sheets, 0);
        return { type, months, total };
      });
      return { dept, totalSheets, byType };
    }).sort((a, b) => b.totalSheets - a.totalSheets);
  })();

  // 円グラフ用: 上位7件 + その他にまとめる
  const departmentPieData = (() => {
    if (departmentDataAll.length <= 8) return departmentDataAll;
    const top = departmentDataAll.slice(0, 7);
    const others = departmentDataAll.slice(7);
    const othersAmount = others.reduce((sum, d) => sum + d.amount, 0);
    const total = data?.totalExpense || 1;
    return [
      ...top,
      { name: `その他(${others.length}件)`, amount: othersAmount, ratio: (othersAmount / total) * 100 },
    ];
  })();

  // 事業所別印刷（A4横）
  const handlePrintOffices = () => {
    // @page は top-level でないと効かないため動的に注入
    const style = document.createElement("style");
    style.id = "print-landscape-page";
    style.textContent = "@page { size: A4 landscape; margin: 8mm 10mm; }";
    document.head.appendChild(style);
    document.body.classList.add("print-landscape");
    const cleanup = () => {
      document.body.classList.remove("print-landscape");
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  // AI分析を実行
  const runAiAnalysis = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "copy-expense",
          data: {
            period: selectedPeriod,
            totalExpense: data.totalExpense,
            totalCount: data.totalCount,
            totalSheets: data.totalSheets,
            monthlyAverage: data.monthlyAverage,
            maxMonth: data.maxMonth,
            monthlyData: data.monthlyData.map((m) => ({
              month: m.month,
              amount: m.amount,
              sheets: m.sheets,
            })),
            quarterlyData: data.quarterlyData.map((q) => ({
              quarter: q.quarter,
              amount: q.amount,
              sheets: q.sheets,
            })),
            departmentBreakdown: departmentDataAll.slice(0, 10).map((d) => ({
              name: d.name,
              amount: d.amount,
              ratio: d.ratio,
            })),
            categoryBreakdown: categoryDataAll.map((c) => ({
              name: c.name,
              amount: c.amount,
              ratio: c.ratio,
            })),
            yearlySummary,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setAiError(result.error || "AI分析の取得に失敗しました");
      } else {
        setAiAnalysis(result.analysis);
      }
    } catch (err) {
      setAiError("AI分析の実行に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>総務部</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-800 font-medium">KPI分析</span>
            </div>
            <div className="flex items-center gap-3">
              {/* 期セレクタ */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value, 10))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* 更新ボタン */}
              <button
                onClick={() => fetchData(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                更新
              </button>
            </div>
          </div>
          {/* タブ */}
          {selectedCategory === "copy" && (
            <div className="flex gap-1 mt-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  activeTab === "overview"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                概要
              </button>
              <button
                onClick={() => setActiveTab("offices")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  activeTab === "offices"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Building2 className="w-3 h-3" />
                事業所別
              </button>
            </div>
          )}
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左カテゴリメニュー */}
          <div className="w-48 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-3 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
              経費カテゴリ
            </h3>
            <nav className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => cat.enabled && setSelectedCategory(cat.id)}
                  disabled={!cat.enabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : cat.enabled
                        ? "text-gray-600 hover:bg-gray-100"
                        : "text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  {!cat.enabled && (
                    <span className="ml-auto text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded">
                      準備中
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* 右メインコンテンツ */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* ローディング状態 */}
            {loading && !data && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <KPICardSkeleton key={i} />
                  ))}
                </div>
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            )}

            {/* データ表示: 概要タブ */}
            {activeTab === "overview" && data && (
              <div className="space-y-6">
                {/* KPIカード x4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="年間合計"
                    value={formatAmount(data.totalExpense)}
                    unit="円"
                    icon={<DollarSign className="w-5 h-5 text-white" />}
                    color="emerald"
                    subText={`第${data.period}期 (${data.dateRange.start} 〜 ${data.dateRange.end})`}
                  />
                  <KPICard
                    title="月間平均"
                    value={formatAmount(data.monthlyAverage)}
                    unit="円/月"
                    icon={<BarChart3 className="w-5 h-5 text-white" />}
                    color="blue"
                    subText={`データ有 ${data.monthlyData.filter((m) => m.count > 0).length} ヶ月`}
                  />
                  <KPICard
                    title="最高月"
                    value={data.maxMonth.month || "-"}
                    unit={data.maxMonth.amount > 0 ? `${formatAmount(data.maxMonth.amount)}円` : ""}
                    icon={<TrendingUp className="w-5 h-5 text-white" />}
                    color="orange"
                  />
                  <KPICard
                    title="印刷枚数合計"
                    value={data.totalSheets.toLocaleString()}
                    unit="枚"
                    icon={<Hash className="w-5 h-5 text-white" />}
                    color="purple"
                    subText={`${data.totalCount}レコード`}
                  />
                </div>

                {/* 月次コピー経費推移 - 左右2分割 */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    月次コピー経費推移
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左: 月別経費 */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <h4 className="text-sm font-medium text-gray-500 mb-3">月別経費</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(v) => formatAmount(v)}
                          />
                          <Tooltip content={<MonthlyChartTooltip />} />
                          <Bar
                            dataKey="amount"
                            name="月次経費"
                            fill={COLORS.primary}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 右: 累計経費 */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <h4 className="text-sm font-medium text-gray-500 mb-3">累計経費</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={cumulativeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(v) => formatAmount(v)}
                          />
                          <Tooltip content={<MonthlyChartTooltip />} />
                          <Bar
                            dataKey="cumAmount"
                            name="累計経費"
                            fill={COLORS.secondary}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 年度別コピー経費比較 */}
                {comparisonData.length > 1 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      年度別コピー経費比較
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* 左: 過去5年分の期別総額テーブル */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">期別総額推移</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 text-gray-500 font-medium">期</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">年間経費</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">削減額</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">前年比</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearlySummary.map((row) => (
                              <tr
                                key={row.period}
                                className={`border-b border-gray-50 ${row.period === selectedPeriod ? "bg-indigo-50" : ""}`}
                              >
                                <td className="py-2.5 px-2 text-gray-700 font-medium">
                                  第{row.period}期
                                </td>
                                <td className="py-2.5 px-2 text-right text-gray-800 font-medium whitespace-nowrap">
                                  {formatAmount(row.totalExpense)}円
                                </td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                  {row.diff !== null ? (
                                    <span className={`font-medium ${row.diff <= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {row.diff <= 0 ? "-" : "+"}{formatAmount(Math.abs(row.diff))}円
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                  {row.changeRate !== null ? (
                                    <span className={`font-bold ${row.changeRate <= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {row.changeRate <= 0 ? "" : "+"}{row.changeRate.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 右: 3年月別比較チャート */}
                      <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">
                          月別比較（{chart3Years.map((d) => `${d.period}期`).join(" / ")}）
                        </h4>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={yearComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 11, fill: "#6b7280" }}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "#6b7280" }}
                              tickFormatter={(v) => formatAmount(v)}
                            />
                            <Tooltip content={<MonthlyChartTooltip />} />
                            <Legend />
                            {chart3Years.map((pd, idx) => (
                              <Bar
                                key={pd.period}
                                dataKey={`${pd.period}期`}
                                name={`第${pd.period}期`}
                                fill={[COLORS.quaternary, COLORS.secondary, COLORS.primary][idx] || COLORS.primary}
                                radius={[3, 3, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* 事業所別経費割合 */}
                {departmentDataAll.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-500" />
                      事業所別コピー経費割合
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* 円グラフ */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">経費割合</h4>
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart>
                            <Pie
                              data={departmentPieData}
                              dataKey="amount"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={120}
                              innerRadius={60}
                              paddingAngle={1}
                              label={({ name, percent }: any) => {
                                const p = (percent * 100);
                                if (p < 3) return "";
                                return `${name} ${p.toFixed(1)}%`;
                              }}
                              labelLine={{ strokeWidth: 1 }}
                              style={{ fontSize: 11 }}
                            >
                              {departmentPieData.map((_, idx) => (
                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: any, name: any) => [`${Number(value).toLocaleString()}円`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 内訳テーブル */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">事業所別内訳</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 text-gray-500 font-medium">事業所</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">金額</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">割合</th>
                            </tr>
                          </thead>
                          <tbody>
                            {departmentDataAll.map((d, idx) => (
                              <tr key={d.name} className="border-b border-gray-50">
                                <td className="py-2 px-2 text-gray-700 flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                  />
                                  {d.name}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-800 font-medium whitespace-nowrap">
                                  {formatAmount(d.amount)}円
                                </td>
                                <td className="py-2 px-2 text-right text-gray-600 whitespace-nowrap">
                                  {d.ratio.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 印刷種別経費割合 */}
                {categoryDataAll.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      印刷種別コピー経費割合
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* 左: 円グラフ */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">経費割合</h4>
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart>
                            <Pie
                              data={categoryPieData}
                              dataKey="amount"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              innerRadius={50}
                              paddingAngle={1}
                              label={({ name, percent }: any) => {
                                const p = (percent * 100);
                                if (p < 3) return "";
                                return `${name} ${p.toFixed(1)}%`;
                              }}
                              labelLine={{ strokeWidth: 1 }}
                              style={{ fontSize: 11 }}
                            >
                              {categoryPieData.map((_, idx) => (
                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: any, name: any) => [`${Number(value).toLocaleString()}円`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 中: 内訳テーブル */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">印刷種別内訳</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 text-gray-500 font-medium">印刷種別</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">金額</th>
                              <th className="text-right py-2 px-2 text-gray-500 font-medium">割合</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryDataAll.map((d, idx) => (
                              <tr key={d.name} className="border-b border-gray-50">
                                <td className="py-2 px-2 text-gray-700 flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                  />
                                  {d.name}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-800 font-medium whitespace-nowrap">
                                  {formatAmount(d.amount)}円
                                </td>
                                <td className="py-2 px-2 text-right text-gray-600 whitespace-nowrap">
                                  {d.ratio.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* 右: 印刷種別ごとの上位7事業所 */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 overflow-y-auto max-h-[420px]">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">種別ごと上位事業所</h4>
                        <div className="space-y-4">
                          {categoryDataAll.map((cat, catIdx) => {
                            const depts = categoryByDept.get(cat.name) || [];
                            if (depts.length === 0) return null;
                            return (
                              <div key={cat.name}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span
                                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: PIE_COLORS[catIdx % PIE_COLORS.length] }}
                                  />
                                  <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                                </div>
                                <table className="w-full text-xs">
                                  <tbody>
                                    {depts.map((d, i) => (
                                      <tr key={d.name} className="border-b border-gray-50">
                                        <td className="py-1 px-1 text-gray-500 w-5">{i + 1}</td>
                                        <td className="py-1 px-1 text-gray-700">{d.name}</td>
                                        <td className="py-1 px-1 text-right text-gray-800 font-medium whitespace-nowrap">
                                          {formatAmount(d.amount)}円
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 四半期サマリー（積み上げ棒グラフ） */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    四半期サマリー（印刷種別）
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 棒グラフ */}
                    <div className="lg:col-span-2" style={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={quarterByCategoryData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="quarter" tick={{ fontSize: 13 }} />
                          <YAxis
                            tickFormatter={(v) => formatAmount(v)}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [
                              `${Number(value).toLocaleString()}円`,
                              name,
                            ]}
                            labelFormatter={(label) => `${label}（${selectedPeriod}期）`}
                          />
                          <Legend />
                          {quarterByCategoryData.categories.map((cat, idx) => (
                            <Bar
                              key={cat}
                              dataKey={cat}
                              stackId="a"
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 四半期合計テーブル */}
                    <div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 text-gray-500 font-medium">四半期</th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">合計金額</th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">構成比</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.quarterlyData.map((q) => {
                            const ratio = data.totalExpense > 0
                              ? ((q.amount / data.totalExpense) * 100).toFixed(1)
                              : "0.0";
                            return (
                              <tr key={q.quarter} className="border-b border-gray-50">
                                <td className="py-2 px-2 font-medium text-gray-700">{q.quarter}</td>
                                <td className="py-2 px-2 text-right text-gray-800">
                                  {q.amount.toLocaleString()}円
                                </td>
                                <td className="py-2 px-2 text-right text-indigo-600 font-medium">
                                  {ratio}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-300">
                            <td className="py-2 px-2 font-bold text-gray-800">合計</td>
                            <td className="py-2 px-2 text-right font-bold text-gray-800">
                              {data.totalExpense.toLocaleString()}円
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-indigo-600">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* AI分析 */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      AI経費分析
                    </h3>
                    <button
                      onClick={runAiAnalysis}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {aiLoading ? (
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
                  {!aiAnalysis && !aiLoading && !aiError && (
                    <div className="text-center py-8 text-gray-400">
                      <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        「AI分析を実行」をクリックすると、コピー経費データをAIが分析し
                        <br />
                        経費削減の提案やトレンド分析を行います
                      </p>
                    </div>
                  )}
                  {aiLoading && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-amber-500" />
                      <p className="text-sm text-gray-500">AIがデータを分析しています...</p>
                    </div>
                  )}
                  {aiError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                      {aiError}
                    </div>
                  )}
                  {aiAnalysis && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {aiAnalysis}
                      </div>
                    </div>
                  )}
                </div>

                {/* 経費明細テーブル */}
                {(() => {
                  const deptOptions = Array.from(new Set(data.records.map((r) => r.department).filter(Boolean))).sort();
                  const catOptions = Array.from(new Set(data.records.map((r) => r.category).filter(Boolean))).sort();
                  const filtered = data.records.filter((r) => {
                    if (filterDept !== "all" && r.department !== filterDept) return false;
                    if (filterCategory !== "all" && r.category !== filterCategory) return false;
                    return true;
                  });
                  const filteredTotal = filtered.reduce((sum, r) => sum + r.amount, 0);
                  const filteredSheets = filtered.reduce((sum, r) => sum + r.sheets, 0);
                  return (
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-500" />
                          経費明細
                          <span className="text-xs text-gray-400 font-normal ml-2">
                            ({filtered.length}件
                            {(filterDept !== "all" || filterCategory !== "all") && ` / 全${data.records.length}件`})
                          </span>
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500">事業所:</label>
                            <select
                              value={filterDept}
                              onChange={(e) => setFilterDept(e.target.value)}
                              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                            >
                              <option value="all">すべて</option>
                              {deptOptions.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500">印刷種別:</label>
                            <select
                              value={filterCategory}
                              onChange={(e) => setFilterCategory(e.target.value)}
                              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                            >
                              <option value="all">すべて</option>
                              {catOptions.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          {(filterDept !== "all" || filterCategory !== "all") && (
                            <button
                              onClick={() => { setFilterDept("all"); setFilterCategory("all"); }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                            >
                              リセット
                            </button>
                          )}
                        </div>
                      </div>
                      {(filterDept !== "all" || filterCategory !== "all") && (
                        <div className="flex gap-4 mb-3 text-sm">
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                            合計金額: <span className="font-bold">{filteredTotal.toLocaleString()}円</span>
                          </span>
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                            合計枚数: <span className="font-bold">{filteredSheets.toLocaleString()}枚</span>
                          </span>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-gray-500 font-medium">年月</th>
                              <th className="text-left py-2 px-3 text-gray-500 font-medium">事業所</th>
                              <th className="text-left py-2 px-3 text-gray-500 font-medium">印刷種別</th>
                              <th className="text-right py-2 px-3 text-gray-500 font-medium">印刷枚数</th>
                              <th className="text-right py-2 px-3 text-gray-500 font-medium">金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-400">
                                  該当するデータがありません
                                </td>
                              </tr>
                            ) : (
                              filtered.slice(0, 100).map((record, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{record.date || "-"}</td>
                                  <td className="py-2 px-3 text-gray-600">{record.department || "-"}</td>
                                  <td className="py-2 px-3 text-gray-600">{record.category || "-"}</td>
                                  <td className="py-2 px-3 text-right text-gray-700 whitespace-nowrap">{record.sheets.toLocaleString()}枚</td>
                                  <td className="py-2 px-3 text-right font-medium text-gray-800 whitespace-nowrap">{record.amount.toLocaleString()}円</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {filtered.length > 100 && (
                          <p className="text-center text-xs text-gray-400 mt-3">
                            先頭100件を表示中（全{filtered.length}件）
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* データ表示: 事業所別タブ */}
            {activeTab === "offices" && data && (
              <div className="space-y-6">
                {/* 印刷用ヘッダー（画面では非表示） */}
                <div className="print-landscape-header hidden">
                  <h1>コピー経費 事業所別レポート</h1>
                  <div className="print-meta">
                    第{data.period}期（{data.dateRange.start} 〜 {data.dateRange.end}） / 印刷日: {new Date().toLocaleDateString("ja-JP")}
                  </div>
                </div>

                {/* 印刷ボタン */}
                <div className="flex justify-end print-trigger-btn">
                  <button
                    onClick={handlePrintOffices}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    A4横で印刷
                  </button>
                </div>

                {/* サマリーKPIカード */}
                {officeData.length > 0 && (() => {
                  const totalAllSheets = officeData.reduce((sum, o) => sum + o.totalSheets, 0);
                  const topOffice = officeData[0];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 office-kpi-print">
                      <KPICard
                        title="事業所数"
                        value={String(officeData.length)}
                        unit="拠点"
                        icon={<Building2 className="w-5 h-5 text-white" />}
                        color="blue"
                      />
                      <KPICard
                        title="総印刷枚数"
                        value={totalAllSheets.toLocaleString()}
                        unit="枚"
                        icon={<Hash className="w-5 h-5 text-white" />}
                        color="purple"
                        subText={`第${data.period}期 全事業所合計`}
                      />
                      <KPICard
                        title="最多事業所"
                        value={topOffice?.dept || "-"}
                        unit={topOffice ? `${topOffice.totalSheets.toLocaleString()}枚` : ""}
                        icon={<TrendingUp className="w-5 h-5 text-white" />}
                        color="orange"
                      />
                    </div>
                  );
                })()}

                {/* 事業所カード一覧 */}
                {(() => {
                  const totalAllSheets = officeData.reduce((sum, o) => sum + o.totalSheets, 0);
                  const PRINT_TYPE_COLORS: Record<string, string> = {
                    "カラー": "#f43f5e",
                    "2色": "#f59e0b",
                    "モノクロ": "#64748b",
                  };
                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 office-print-grid">
                      {officeData.map((office, rank) => {
                        const ratio = totalAllSheets > 0 ? (office.totalSheets / totalAllSheets) * 100 : 0;
                        return (
                          <div key={office.dept} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                            {/* カードヘッダー */}
                            <div className="p-5 pb-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                                    rank === 0 ? "bg-amber-500" : rank === 1 ? "bg-gray-400" : rank === 2 ? "bg-orange-700" : "bg-gray-300"
                                  }`}>
                                    {rank + 1}
                                  </span>
                                  <Building2 className="w-5 h-5 text-indigo-500" />
                                  <h4 className="text-sm font-bold text-gray-800">{office.dept}</h4>
                                </div>
                                <span className="text-sm text-gray-500">
                                  合計 <span className="font-bold text-gray-800">{office.totalSheets.toLocaleString()}</span> 枚
                                  <span className="text-xs text-gray-400 ml-1">({ratio.toFixed(1)}%)</span>
                                </span>
                              </div>
                              {/* 構成比バー */}
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-indigo-400 h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(ratio, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* テーブル */}
                            <div className="px-5 pb-3 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 px-1.5 text-gray-400 font-medium w-20">種別</th>
                                    {OFFICE_MONTHS.map((m) => (
                                      <th key={m} className="text-center py-1.5 px-0.5 text-gray-400 font-medium min-w-[52px]">
                                        {m.replace("月", "")}月
                                      </th>
                                    ))}
                                    <th className="text-right py-1.5 px-1.5 text-gray-400 font-medium">計</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {office.byType.map((row) => (
                                    <tr key={row.type} className="border-b border-gray-50">
                                      <td className="py-2 px-1.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: PRINT_TYPE_COLORS[row.type] || "#94a3b8" }}
                                          />
                                          <span className="text-gray-600 font-medium">{row.type}</span>
                                        </div>
                                      </td>
                                      {row.months.map((m, i) => {
                                        const bgClass = m.diff !== null && m.diff > 0
                                          ? "bg-red-50"
                                          : m.diff !== null && m.diff < 0
                                            ? "bg-blue-50"
                                            : "";
                                        return (
                                          <td key={i} className={`text-center py-2 px-0.5 ${bgClass}`}>
                                            <div className="text-gray-700 leading-tight">
                                              {m.sheets > 0 ? m.sheets.toLocaleString() : <span className="text-gray-300">-</span>}
                                            </div>
                                            {m.diff !== null && (m.sheets > 0 || m.diff !== 0) ? (
                                              <div className={`text-xs leading-none mt-0.5 ${
                                                m.diff > 0 ? "text-red-500" : m.diff < 0 ? "text-blue-500" : "text-gray-300"
                                              }`}>
                                                {m.diff > 0 ? `↑+${m.diff.toLocaleString()}` : m.diff < 0 ? `↓${m.diff.toLocaleString()}` : "→"}
                                              </div>
                                            ) : null}
                                          </td>
                                        );
                                      })}
                                      <td className="text-right py-2 px-1.5 text-gray-800 font-bold whitespace-nowrap">
                                        {row.total > 0 ? row.total.toLocaleString() : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* ミニスパークライン */}
                            <div className="px-5 pb-4 pt-1 border-t border-gray-50">
                              <div className="text-[10px] text-gray-400 mb-1">月別推移</div>
                              <ResponsiveContainer width="100%" height={60}>
                                <LineChart data={OFFICE_MONTHS.map((month, i) => {
                                  const row: Record<string, string | number> = { month: month.replace("月", "") };
                                  office.byType.forEach((bt) => {
                                    row[bt.type] = bt.months[i].sheets;
                                  });
                                  return row;
                                })}>
                                  <XAxis dataKey="month" hide />
                                  <YAxis hide />
                                  <Tooltip
                                    contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                                    formatter={(value: any, name: any) => [`${Number(value).toLocaleString()}枚`, name]}
                                    labelFormatter={(label) => `${label}月`}
                                  />
                                  {office.byType.map((bt) => (
                                    <Line
                                      key={bt.type}
                                      type="monotone"
                                      dataKey={bt.type}
                                      stroke={PRINT_TYPE_COLORS[bt.type] || "#94a3b8"}
                                      strokeWidth={1.5}
                                      dot={false}
                                    />
                                  ))}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {officeData.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">事業所別のデータがありません</p>
                  </div>
                )}
              </div>
            )}

            {/* 未実装カテゴリ */}
            {selectedCategory !== "copy" && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-500 mb-1">準備中</h3>
                  <p className="text-sm text-gray-400">
                    このカテゴリのデータは現在準備中です
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// 月次チャート用ツールチップ
function MonthlyChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}円
        </p>
      ))}
    </div>
  );
}
