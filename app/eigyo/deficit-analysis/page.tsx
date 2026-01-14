"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import {
  TrendingDown,
  RefreshCw,
  Gauge,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Shield,
  Printer,
  Sparkles,
  Loader2,
} from "lucide-react";

// 型定義
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

interface PeriodData {
  period: number;
  dateRange: { start: string; end: string };
  deficitAnalysis?: DeficitAnalysis;
}

// 金額フォーマット
function formatAmount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${Math.round(value / 10000)}万`;
  return value.toLocaleString();
}

// 印刷ボタンコンポーネント
function PrintButton({ period, dateRange }: { period: number; dateRange?: { start: string; end: string } }) {
  const handlePrint = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1000);
  };

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
    >
      <Printer className="w-4 h-4" />
      印刷
    </button>
  );
}

// ローディングスケルトン
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-200 rounded-xl"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  );
}

// クライアントサイドキャッシュキー
const CLIENT_CACHE_KEY = "deficit_analysis_cache";
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10分

function getClientCache(period: number): { data: PeriodData[]; timestamp: number } | null {
  try {
    const cached = sessionStorage.getItem(`${CLIENT_CACHE_KEY}_${period}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CLIENT_CACHE_TTL) {
        return parsed;
      }
    }
  } catch (e) {
    // sessionStorage unavailable
  }
  return null;
}

function setClientCache(period: number, data: PeriodData[]): void {
  try {
    sessionStorage.setItem(`${CLIENT_CACHE_KEY}_${period}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // sessionStorage unavailable
  }
}

export default function DeficitAnalysisPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodData | null>(null);
  const [allData, setAllData] = useState<PeriodData[]>([]); // 3年分のデータ
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [selectedPeriod, setSelectedPeriod] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false); // バックグラウンド更新中
  // AI分析
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // データ取得（選択した期を基準に3年分）- 専用軽量APIを使用 + クライアントキャッシュ
  const fetchData = async (forceRefresh = false) => {
    setError(null);

    // クライアントキャッシュをチェック（強制更新でない場合）
    if (!forceRefresh) {
      const cached = getClientCache(selectedPeriod);
      if (cached) {
        // キャッシュがあれば即座に表示
        setAllData(cached.data);
        const periodData = cached.data.find((d: PeriodData) => d.period === selectedPeriod);
        if (periodData) {
          setData(periodData);
        }
        setLoading(false);
        // バックグラウンドで更新
        setIsRefreshing(true);
        fetchFromAPI().finally(() => setIsRefreshing(false));
        return;
      }
    }

    setLoading(true);
    await fetchFromAPI();
    setLoading(false);
  };

  // APIからデータ取得
  const fetchFromAPI = async () => {
    try {
      const fromPeriod = selectedPeriod - 2;
      const toPeriod = selectedPeriod;
      const response = await fetch(`/api/deficit-analysis?fromPeriod=${fromPeriod}&toPeriod=${toPeriod}`);
      if (!response.ok) throw new Error("データの取得に失敗しました");
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        setAllData(result.data);
        setClientCache(selectedPeriod, result.data); // キャッシュに保存
        const periodData = result.data.find((d: PeriodData) => d.period === selectedPeriod);
        if (periodData) {
          setData(periodData);
          setCurrentPeriod(result.currentPeriod || selectedPeriod);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const deficitAnalysis = data?.deficitAnalysis;

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-red-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-white no-print">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 flex items-center gap-1">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                赤字案件分析
                <span className="text-xs font-normal text-gray-500 ml-2">営業部</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-gray-600">期間:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {Array.from({ length: 10 }, (_, i) => currentPeriod - 5 + i).map((p) => (
                    <option key={p} value={p}>
                      第{p}期
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => fetchData(true)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded hover:from-red-700 hover:to-rose-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3 h-3 ${loading || isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "更新中..." : "更新"}
              </button>
            </div>
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

          {!loading && deficitAnalysis && (
            <>
              {/* 印刷ボタン */}
              <div className="flex justify-end mb-4 no-print">
                <PrintButton period={selectedPeriod} dateRange={data?.dateRange} />
              </div>

              {/* 赤字案件サマリーKPI */}
              <div className="text-sm text-gray-500 mb-2">
                第{selectedPeriod}期 ({data?.dateRange?.start} ～ {data?.dateRange?.end})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-100">赤字案件数</span>
                    <AlertTriangle className="w-5 h-5 text-red-200" />
                  </div>
                  <div className="text-2xl font-bold">{deficitAnalysis.totalCount}件</div>
                  <div className="text-sm text-red-200 mt-1">
                    全体の{deficitAnalysis.patterns.avgDeficitRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-100">赤字総額</span>
                    <TrendingDown className="w-5 h-5 text-orange-200" />
                  </div>
                  <div className="text-2xl font-bold">{formatAmount(deficitAnalysis.totalLoss)}円</div>
                  <div className="text-sm text-orange-200 mt-1">損失合計</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-100">平均赤字額</span>
                    <Gauge className="w-5 h-5 text-purple-200" />
                  </div>
                  <div className="text-2xl font-bold">
                    {deficitAnalysis.totalCount > 0
                      ? formatAmount(deficitAnalysis.totalLoss / deficitAnalysis.totalCount)
                      : "0"}
                    円
                  </div>
                  <div className="text-sm text-purple-200 mt-1">1件あたり</div>
                </div>
                <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">高リスク区分</span>
                    <Shield className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="text-2xl font-bold">
                    {deficitAnalysis.patterns.highRiskPjCategories.length}件
                  </div>
                  <div className="text-sm text-slate-300 mt-1">要注意PJ区分</div>
                </div>
              </div>

              {/* 3年間推移グラフ */}
              {allData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* 赤字件数推移 */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">
                        赤字件数 3期推移（第{selectedPeriod - 2}期～第{selectedPeriod}期）
                      </h3>
                    </div>
                    <div className="p-4" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={allData
                            .filter(d => d.deficitAnalysis)
                            .sort((a, b) => a.period - b.period)
                            .map(d => ({
                              period: `第${d.period}期`,
                              件数: d.deficitAnalysis?.totalCount || 0,
                            }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip formatter={(v) => [`${v}件`, "赤字件数"]} />
                          <Bar dataKey="件数" radius={[4, 4, 0, 0]}>
                            {allData.filter(d => d.deficitAnalysis).sort((a, b) => a.period - b.period).map((d) => (
                              <Cell
                                key={d.period}
                                fill={d.period === selectedPeriod ? "#ef4444" : "#fca5a5"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-4 pb-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        {allData
                          .filter(d => d.deficitAnalysis)
                          .sort((a, b) => a.period - b.period)
                          .map((d, i, arr) => {
                            const prevCount = i > 0 ? arr[i - 1].deficitAnalysis?.totalCount || 0 : 0;
                            const currCount = d.deficitAnalysis?.totalCount || 0;
                            const change = i > 0 && prevCount > 0
                              ? ((currCount - prevCount) / prevCount * 100).toFixed(1)
                              : null;
                            const isSelected = d.period === selectedPeriod;
                            return (
                              <div key={d.period} className={`text-center px-2 py-1 rounded ${isSelected ? 'bg-red-50 ring-1 ring-red-200' : ''}`}>
                                <div className="text-xs text-gray-500">第{d.period}期</div>
                                <div className={`font-bold ${isSelected ? 'text-red-600' : 'text-gray-700'}`}>{currCount}件</div>
                                {change !== null && (
                                  <div className={`text-xs ${parseFloat(change) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {parseFloat(change) >= 0 ? '+' : ''}{change}%
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* 赤字総額推移 */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
                      <h3 className="text-base font-bold text-white">
                        赤字総額 3期推移（第{selectedPeriod - 2}期～第{selectedPeriod}期）
                      </h3>
                    </div>
                    <div className="p-4" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={allData
                            .filter(d => d.deficitAnalysis)
                            .sort((a, b) => a.period - b.period)
                            .map(d => ({
                              period: `第${d.period}期`,
                              総額: d.deficitAnalysis?.totalLoss || 0,
                            }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis tickFormatter={(v) => formatAmount(v)} />
                          <Tooltip formatter={(v) => [`${formatAmount(v as number)}円`, "赤字総額"]} />
                          <Bar dataKey="総額" radius={[4, 4, 0, 0]}>
                            {allData.filter(d => d.deficitAnalysis).sort((a, b) => a.period - b.period).map((d) => (
                              <Cell
                                key={d.period}
                                fill={d.period === selectedPeriod ? "#f97316" : "#fdba74"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-4 pb-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        {allData
                          .filter(d => d.deficitAnalysis)
                          .sort((a, b) => a.period - b.period)
                          .map((d, i, arr) => {
                            const prevLoss = i > 0 ? arr[i - 1].deficitAnalysis?.totalLoss || 0 : 0;
                            const currLoss = d.deficitAnalysis?.totalLoss || 0;
                            const change = i > 0 && prevLoss > 0
                              ? ((currLoss - prevLoss) / prevLoss * 100).toFixed(1)
                              : null;
                            const isSelected = d.period === selectedPeriod;
                            return (
                              <div key={d.period} className={`text-center px-2 py-1 rounded ${isSelected ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}>
                                <div className="text-xs text-gray-500">第{d.period}期</div>
                                <div className={`font-bold ${isSelected ? 'text-orange-600' : 'text-gray-700'}`}>{formatAmount(currLoss)}円</div>
                                {change !== null && (
                                  <div className={`text-xs ${parseFloat(change) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {parseFloat(change) >= 0 ? '+' : ''}{change}%
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 傾向分析・対策セクション */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 傾向分析 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      傾向分析
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {deficitAnalysis.patterns.commonFactors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">共通要因</h4>
                        <ul className="space-y-2">
                          {deficitAnalysis.patterns.commonFactors.map((factor, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-gray-600 bg-amber-50 p-2 rounded-lg"
                            >
                              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {deficitAnalysis.patterns.highRiskPjCategories.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">高リスクPJ区分</h4>
                        <div className="flex flex-wrap gap-2">
                          {deficitAnalysis.patterns.highRiskPjCategories.map((cat) => (
                            <span
                              key={cat}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {deficitAnalysis.patterns.highRiskCustomers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">赤字リピート顧客</h4>
                        <div className="flex flex-wrap gap-2">
                          {deficitAnalysis.patterns.highRiskCustomers.map((cust) => (
                            <span
                              key={cust}
                              className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full"
                            >
                              {cust}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {deficitAnalysis.patterns.seasonalPattern && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h4 className="text-sm font-bold text-blue-700 mb-1">季節性パターン</h4>
                        <p className="text-sm text-blue-600">
                          {deficitAnalysis.patterns.seasonalPattern}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 対策提案 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      対策提案
                    </h3>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-3">
                      {deficitAnalysis.recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100"
                        >
                          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {i + 1}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* AI赤字分析 */}
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 mb-6 no-print">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    AI赤字分析
                  </h3>
                  <button
                    onClick={async () => {
                      if (!deficitAnalysis) return;
                      setIsAnalyzing(true);
                      setAiAnalysis("");
                      try {
                        const analysisData = {
                          period: selectedPeriod,
                          totalCount: deficitAnalysis.totalCount,
                          totalLoss: deficitAnalysis.totalLoss,
                          avgLoss: deficitAnalysis.totalCount > 0 ? deficitAnalysis.totalLoss / deficitAnalysis.totalCount : 0,
                          deficitRate: deficitAnalysis.patterns.avgDeficitRate,
                          highRiskPjCategories: deficitAnalysis.patterns.highRiskPjCategories,
                          highRiskCustomers: deficitAnalysis.patterns.highRiskCustomers,
                          commonFactors: deficitAnalysis.patterns.commonFactors,
                          seasonalPattern: deficitAnalysis.patterns.seasonalPattern,
                          byPjCategory: deficitAnalysis.byPjCategory.slice(0, 5).map(p => ({
                            name: p.name,
                            count: p.count,
                            loss: p.loss,
                            avgProfitRate: p.avgProfitRate,
                          })),
                          byTantousha: deficitAnalysis.byTantousha.slice(0, 5).map(t => ({
                            name: t.name,
                            office: t.office,
                            count: t.count,
                            loss: t.loss,
                          })),
                          byCustomer: deficitAnalysis.byCustomer.slice(0, 5).map(c => ({
                            name: c.name,
                            count: c.count,
                            loss: c.loss,
                          })),
                          monthlyTrend: deficitAnalysis.byMonth.map(m => ({
                            month: m.month,
                            count: m.count,
                            loss: m.loss,
                          })),
                          recommendations: deficitAnalysis.recommendations,
                          // 3年分のトレンド
                          yearlyTrend: allData
                            .filter(d => d.deficitAnalysis)
                            .sort((a, b) => a.period - b.period)
                            .map(d => ({
                              period: d.period,
                              count: d.deficitAnalysis?.totalCount || 0,
                              loss: d.deficitAnalysis?.totalLoss || 0,
                            })),
                        };
                        const res = await fetch("/api/ai-analysis", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "deficit-analysis", data: analysisData }),
                        });
                        const result = await res.json();
                        if (result.success) {
                          setAiAnalysis(result.analysis);
                        } else {
                          setAiAnalysis("分析の取得に失敗しました。");
                        }
                      } catch (e) {
                        setAiAnalysis("分析中にエラーが発生しました。");
                      } finally {
                        setIsAnalyzing(false);
                      }
                    }}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                  >
                    {isAnalyzing ? (
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
                {aiAnalysis ? (
                  <div className="prose prose-sm max-w-none">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {aiAnalysis}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">「AI分析を実行」ボタンを押すと、赤字案件データをAIが分析し改善提案を行います</p>
                  </div>
                )}
              </div>

              {/* グラフセクション */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 月別赤字推移 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">月別赤字推移</h3>
                  </div>
                  <div className="p-4" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={deficitAnalysis.byMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" tickFormatter={(v) => formatAmount(v)} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(v, name) => [
                            name === "件数" ? `${v}件` : `${(v as number).toLocaleString()}円`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="loss" name="損失額" fill="#ef4444" />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="count"
                          name="件数"
                          stroke="#f97316"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* PJ区分赤字 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">PJ区分 赤字</h3>
                  </div>
                  <div className="p-4" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deficitAnalysis.byPjCategory.slice(0, 8)}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatAmount(v)} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip
                          formatter={(v, name) => [
                            name === "件数"
                              ? `${v}件`
                              : name === "平均粗利率"
                              ? `${(v as number).toFixed(1)}%`
                              : `${(v as number).toLocaleString()}円`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="loss" name="損失額" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* 担当者別・顧客別 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 担当者別赤字 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">担当者別赤字TOP10</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">担当者</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">営業所</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">件数</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">損失額</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">平均粗利率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deficitAnalysis.byTantousha.slice(0, 10).map((t, i) => (
                          <tr key={t.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{t.office}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{t.count}件</td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                              -{formatAmount(t.loss)}円
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                              {t.avgProfitRate.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 顧客別赤字 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">顧客別赤字TOP10</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">顧客名</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">件数</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">損失額</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">平均粗利率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deficitAnalysis.byCustomer.slice(0, 10).map((c, i) => (
                          <tr key={c.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[200px] truncate">
                              {c.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{c.count}件</td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                              -{formatAmount(c.loss)}円
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                              {c.avgProfitRate.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 赤字案件一覧 */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
                  <h3 className="text-base font-bold text-white">赤字案件一覧（損失額順）</h3>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">製番</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">売上日</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">得意先</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">担当者</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">PJ区分</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-700">売上</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-700">原価</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-700">粗利</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-700">粗利率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deficitAnalysis.records.map((r, i) => (
                        <tr
                          key={`${r.seiban}-${i}`}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                        >
                          <td className="px-3 py-2 text-xs font-mono text-gray-700">{r.seiban || "-"}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{r.salesDate}</td>
                          <td className="px-3 py-2 text-xs text-gray-700 max-w-[150px] truncate" title={r.customer}>
                            {r.customer}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">{r.tantousha}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{r.pjCategory}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-700">
                            {r.amount.toLocaleString()}円
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-gray-700">
                            {r.cost.toLocaleString()}円
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-red-600 font-medium">
                            {r.profit.toLocaleString()}円
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-red-600 font-medium">
                            {r.profitRate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {deficitAnalysis.records.length === 100 && (
                  <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center border-t">
                    上位100件を表示しています
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !deficitAnalysis && !error && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-red-100 to-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">赤字案件データがありません</p>
            </div>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
