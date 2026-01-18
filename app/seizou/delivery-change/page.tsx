"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
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
  RefreshCw,
  Calendar,
  TrendingUp,
  Users,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Printer,
  Loader2,
} from "lucide-react";

// 型定義
interface MonthlySummary {
  month: string;
  monthIndex: number;
  yearMonth: string;
  changeCount: number;
  backlogCount: number;
  changeRate: number;
}

interface TantoushaSummary {
  name: string;
  office: string;
  region: string;
  totalChangeCount: number;
  totalBacklogCount: number;
  changeRate: number;
  monthlyData: MonthlySummary[];
}

interface OfficeSummary {
  name: string;
  region: string;
  totalChangeCount: number;
  totalBacklogCount: number;
  changeRate: number;
  tantoushaList: TantoushaSummary[];
}

interface DeliveryChangeRecord {
  recordId: string;
  tantousha: string;
  office: string;
  region: string;
  orderNumber: string;
  orderName: string;
  orderDate: string;
  constructionStartDate: string;
  daysDiff: number | null;
  beforeDate: string;
  beforeStatus: string;
  afterDate: string;
  afterStatus: string;
  applicationDate: string;
  applicationMonth: string;
  isCounted: boolean;
}

interface PeriodData {
  period: number;
  dateRange: { start: string; end: string };
  totalChangeCount: number;
  totalBacklogCount: number;
  overallChangeRate: number;
  monthlyData: MonthlySummary[];
  byRegion: {
    name: string;
    changeCount: number;
    backlogCount: number;
    changeRate: number;
  }[];
  byOffice: OfficeSummary[];
  byTantousha: TantoushaSummary[];
  records: DeliveryChangeRecord[];
}

// パーセント表示
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ローディングスケルトン
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 rounded-xl"></div>
        <div className="h-80 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  );
}

// 印刷ボタン
function PrintButton() {
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

export default function DeliveryChangePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodData | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [selectedPeriod, setSelectedPeriod] = useState(50);
  const [expandedOffices, setExpandedOffices] = useState<string[]>([]);
  const [showDetailTable, setShowDetailTable] = useState(false);

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/delivery-change?period=${selectedPeriod}`);
      if (!response.ok) throw new Error("データの取得に失敗しました");
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setCurrentPeriod(result.currentPeriod || selectedPeriod);
      } else {
        setError(result.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const toggleOffice = (officeName: string) => {
    setExpandedOffices((prev) =>
      prev.includes(officeName)
        ? prev.filter((o) => o !== officeName)
        : [...prev, officeName]
    );
  };

  // 変更率に応じた色
  const getRateColor = (rate: number): string => {
    if (rate >= 0.15) return "text-red-600";
    if (rate >= 0.10) return "text-orange-500";
    if (rate >= 0.05) return "text-yellow-600";
    return "text-green-600";
  };

  const getRateBgColor = (rate: number): string => {
    if (rate >= 0.15) return "bg-red-100";
    if (rate >= 0.10) return "bg-orange-100";
    if (rate >= 0.05) return "bg-yellow-100";
    return "bg-green-100";
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-white no-print">
          <p className="text-sm text-gray-500 mb-1">
            製造部 &gt; 納期変更分析
          </p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                納期変更分析
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
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 print:overflow-visible print:p-0">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {loading && <DashboardSkeleton />}

          {!loading && data && (
            <>
              {/* 印刷ボタン */}
              <div className="flex justify-between items-center mb-4 no-print">
                <div className="text-sm text-gray-500">
                  第{selectedPeriod}期 ({data.dateRange?.start} ～ {data.dateRange?.end})
                </div>
                <PrintButton />
              </div>

              {/* KPIカード */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-100">総変更回数</span>
                    <Calendar className="w-5 h-5 text-blue-200" />
                  </div>
                  <div className="text-2xl font-bold">{data.totalChangeCount}回</div>
                  <div className="text-sm text-blue-200 mt-1">期間累計</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-100">受注残数</span>
                    <TrendingUp className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div className="text-2xl font-bold">{data.totalBacklogCount}件</div>
                  <div className="text-sm text-emerald-200 mt-1">期間累計</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-100">変更率</span>
                    <AlertTriangle className="w-5 h-5 text-orange-200" />
                  </div>
                  <div className="text-2xl font-bold">{formatPercent(data.overallChangeRate)}</div>
                  <div className="text-sm text-orange-200 mt-1">全体平均</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-100">営業所数</span>
                    <Building2 className="w-5 h-5 text-purple-200" />
                  </div>
                  <div className="text-2xl font-bold">{data.byOffice.length}拠点</div>
                  <div className="text-sm text-purple-200 mt-1">対象営業所</div>
                </div>
              </div>

              {/* 月別推移グラフ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 変更回数・受注残数推移 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">月別 変更回数・受注残数</h3>
                  </div>
                  <div className="p-4" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value, name) => [
                            name === "変更率" ? formatPercent(value as number) : `${value}`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="changeCount" name="変更回数" fill="#3b82f6" />
                        <Bar yAxisId="left" dataKey="backlogCount" name="受注残数" fill="#10b981" />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="changeRate"
                          name="変更率"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ fill: "#f97316" }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 地域別変更率 */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3">
                    <h3 className="text-base font-bold text-white">地域別 変更率</h3>
                  </div>
                  <div className="p-4" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.byRegion}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatPercent(v)} />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip formatter={(v) => [formatPercent(v as number), "変更率"]} />
                        <Bar dataKey="changeRate" name="変更率" radius={[0, 4, 4, 0]}>
                          {data.byRegion.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.changeRate >= 0.1 ? "#ef4444" : entry.changeRate >= 0.05 ? "#f97316" : "#10b981"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* 営業所別・担当者別テーブル */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    担当者別 納期変更管理表
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-gray-700 sticky left-0 bg-gray-50">地域</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">営業所</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">担当者</th>
                        {data.monthlyData.slice(0, 1).map((m) => (
                          <th key={m.yearMonth} className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]" colSpan={3}>
                            {m.month}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-bold text-gray-700 bg-blue-50" colSpan={3}>
                          累計
                        </th>
                      </tr>
                      <tr className="text-xs">
                        <th className="px-3 py-1 sticky left-0 bg-gray-50"></th>
                        <th className="px-3 py-1"></th>
                        <th className="px-3 py-1"></th>
                        {data.monthlyData.slice(0, 1).map((m) => (
                          <React.Fragment key={`header-${m.yearMonth}`}>
                            <th className="px-1 py-1 text-center text-gray-500">変更</th>
                            <th className="px-1 py-1 text-center text-gray-500">残数</th>
                            <th className="px-1 py-1 text-center text-gray-500">率</th>
                          </React.Fragment>
                        ))}
                        <th className="px-1 py-1 text-center text-gray-500 bg-blue-50">変更</th>
                        <th className="px-1 py-1 text-center text-gray-500 bg-blue-50">残数</th>
                        <th className="px-1 py-1 text-center text-gray-500 bg-blue-50">率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.byOffice.map((office, oidx) => (
                        <React.Fragment key={office.name}>
                          {/* 営業所行 */}
                          <tr
                            className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleOffice(office.name)}
                          >
                            <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-gray-50">
                              {oidx === 0 || data.byOffice[oidx - 1].region !== office.region
                                ? office.region
                                : ""}
                            </td>
                            <td className="px-3 py-2 font-bold text-gray-800 flex items-center gap-1">
                              {expandedOffices.includes(office.name) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              {office.name}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              ({office.tantoushaList.length}名)
                            </td>
                            {/* 最初の月のみ表示 */}
                            {data.monthlyData.slice(0, 1).map((m) => {
                              const officeMonthly = office.tantoushaList.reduce(
                                (acc, t) => {
                                  const tm = t.monthlyData.find((md) => md.yearMonth === m.yearMonth);
                                  if (tm) {
                                    acc.changeCount += tm.changeCount;
                                    acc.backlogCount += tm.backlogCount;
                                  }
                                  return acc;
                                },
                                { changeCount: 0, backlogCount: 0 }
                              );
                              const rate = officeMonthly.backlogCount > 0
                                ? officeMonthly.changeCount / officeMonthly.backlogCount
                                : 0;
                              return (
                                <React.Fragment key={`office-${m.yearMonth}`}>
                                  <td className="px-1 py-2 text-center font-medium">{officeMonthly.changeCount}</td>
                                  <td className="px-1 py-2 text-center">{officeMonthly.backlogCount}</td>
                                  <td className={`px-1 py-2 text-center font-medium ${getRateColor(rate)}`}>
                                    {formatPercent(rate)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            <td className="px-1 py-2 text-center font-bold bg-blue-50">{office.totalChangeCount}</td>
                            <td className="px-1 py-2 text-center bg-blue-50">{office.totalBacklogCount}</td>
                            <td className={`px-1 py-2 text-center font-bold bg-blue-50 ${getRateColor(office.changeRate)}`}>
                              {formatPercent(office.changeRate)}
                            </td>
                          </tr>
                          {/* 担当者行（展開時） */}
                          {expandedOffices.includes(office.name) &&
                            office.tantoushaList.map((tantousha, tidx) => (
                              <tr key={tantousha.name} className={tidx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-3 py-2 sticky left-0 bg-inherit"></td>
                                <td className="px-3 py-2"></td>
                                <td className="px-3 py-2 text-gray-700">{tantousha.name}</td>
                                {tantousha.monthlyData.slice(0, 1).map((m) => (
                                  <React.Fragment key={`tan-${m.yearMonth}`}>
                                    <td className="px-1 py-2 text-center">{m.changeCount}</td>
                                    <td className="px-1 py-2 text-center text-gray-500">{m.backlogCount}</td>
                                    <td className={`px-1 py-2 text-center ${getRateColor(m.changeRate)}`}>
                                      {formatPercent(m.changeRate)}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="px-1 py-2 text-center font-medium bg-blue-50">{tantousha.totalChangeCount}</td>
                                <td className="px-1 py-2 text-center bg-blue-50">{tantousha.totalBacklogCount}</td>
                                <td className={`px-1 py-2 text-center font-medium bg-blue-50 ${getRateColor(tantousha.changeRate)}`}>
                                  {formatPercent(tantousha.changeRate)}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 変更詳細一覧 */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 cursor-pointer flex items-center justify-between"
                  onClick={() => setShowDetailTable(!showDetailTable)}
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    納期変更一覧（カウント対象）
                  </h3>
                  <div className="text-white">
                    {showDetailTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
                {showDetailTable && (
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">担当者</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">受注番号</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">受注件名</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-700">施工開始日</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-700">日数差</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-700">変更前</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-700">変更後</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-700">申請日</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.records.map((record, idx) => (
                          <tr key={record.recordId || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2 text-gray-700">{record.tantousha}</td>
                            <td className="px-3 py-2 text-gray-700 font-mono text-xs">{record.orderNumber}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={record.orderName}>
                              {record.orderName}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">{record.constructionStartDate}</td>
                            <td className={`px-3 py-2 text-center font-medium ${
                              record.daysDiff !== null && Math.abs(record.daysDiff) > 14
                                ? "text-red-600"
                                : "text-orange-500"
                            }`}>
                              {record.daysDiff !== null ? `${record.daysDiff}日` : "-"}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">
                              {record.beforeDate}
                              {record.beforeStatus && <span className="text-xs ml-1 text-gray-400">({record.beforeStatus})</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">
                              {record.afterDate}
                              {record.afterStatus && <span className="text-xs ml-1 text-gray-400">({record.afterStatus})</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">{record.applicationDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {showDetailTable && data.records.length >= 200 && (
                  <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center border-t">
                    上位200件を表示しています
                  </div>
                )}
              </div>

              {/* カウント定義説明 */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
                <h4 className="font-bold text-blue-800 mb-2">納期変更回数のカウント定義</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>・納期変更後の日程 － 施工開始日 ＝ 1週間前後(7日間)以外は1回カウント</li>
                  <li>・2回目以降の変更も同様に、施工開始日を基準に判断</li>
                  <li>・仮→本への同日変更はカウントしない</li>
                </ul>
              </div>
            </>
          )}

          {!loading && !data && !error && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-blue-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">納期変更データがありません</p>
            </div>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
