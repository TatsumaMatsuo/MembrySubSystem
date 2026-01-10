"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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
} from "recharts";
import { BarChart3, TrendingUp, Calendar, RefreshCw } from "lucide-react";

interface MonthlyData {
  month: string;
  count: number;
  amount: number;
}

interface PJCategorySummary {
  category: string;
  count: number;
  amount: number;
  monthlyData: MonthlyData[];
}

interface PeriodSummary {
  period: number;
  dateRange: { start: string; end: string };
  totalCount: number;
  totalAmount: number;
  pjCategories: PJCategorySummary[];
}

interface SalesAnalysisResponse {
  success: boolean;
  currentPeriod: number;
  data: PeriodSummary[];
}

// 金額フォーマット
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}億`;
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}万`;
  }
  return amount.toLocaleString();
}

// カラーパレット
const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
];

export default function SalesAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodSummary[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [fromPeriod, setFromPeriod] = useState(49);
  const [toPeriod, setToPeriod] = useState(50);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales-analysis?fromPeriod=${fromPeriod}&toPeriod=${toPeriod}`
      );
      const result: SalesAnalysisResponse = await response.json();
      if (result.success) {
        setData(result.data);
        setCurrentPeriod(result.currentPeriod);
      } else {
        setError("データの取得に失敗しました");
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
  }, []);

  // PJ区分別比較データを作成
  const createComparisonData = () => {
    if (data.length === 0) return [];

    // 全期間のカテゴリを収集
    const allCategories = new Set<string>();
    data.forEach((period) => {
      period.pjCategories.forEach((cat) => allCategories.add(cat.category));
    });

    // カテゴリごとに期間比較データを作成
    return Array.from(allCategories).map((category) => {
      const result: any = { category };
      data.forEach((period) => {
        const cat = period.pjCategories.find((c) => c.category === category);
        result[`${period.period}期_件数`] = cat?.count || 0;
        result[`${period.period}期_金額`] = cat?.amount || 0;
      });
      return result;
    });
  };

  // 月次推移データを作成（横軸8月〜7月）
  const createMonthlyTrendData = () => {
    if (data.length === 0) return [];

    const months = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
    return months.map((month, index) => {
      const result: any = { month };
      data.forEach((period) => {
        let totalAmount = 0;
        let totalCount = 0;
        period.pjCategories.forEach((cat) => {
          const monthData = cat.monthlyData[index];
          if (monthData) {
            totalAmount += monthData.amount;
            totalCount += monthData.count;
          }
        });
        result[`${period.period}期`] = totalAmount;
        result[`${period.period}期_件数`] = totalCount;
      });
      return result;
    });
  };

  const comparisonData = createComparisonData();
  const monthlyTrendData = createMonthlyTrendData();

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50 overflow-hidden">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            売上分析
          </h1>
          <p className="text-sm text-gray-500">営業部 &gt; 売上分析</p>
        </div>

        {/* 検索条件 */}
        <div className="flex-shrink-0 px-4 py-3">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <h2 className="text-base font-bold mb-3 text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              期間設定
              <span className="text-sm font-normal text-gray-500 ml-2">
                （現在: 第{currentPeriod}期）
              </span>
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">From:</label>
                <select
                  value={fromPeriod}
                  onChange={(e) => setFromPeriod(parseInt(e.target.value))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Array.from({ length: 10 }, (_, i) => currentPeriod - 5 + i).map((p) => (
                    <option key={p} value={p}>
                      第{p}期
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">To:</label>
                <select
                  value={toPeriod}
                  onChange={(e) => setToPeriod(parseInt(e.target.value))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "読込中..." : "分析実行"}
              </button>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {data.length > 0 && (
            <>
              {/* サマリーカード */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.map((period, index) => (
                  <div
                    key={period.period}
                    className="bg-white rounded-xl shadow-lg p-4 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-gray-800">
                        第{period.period}期
                      </span>
                      <span className="text-xs text-gray-500">
                        {period.dateRange.start} 〜 {period.dateRange.end}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">受注件数</span>
                        <span className="text-xl font-bold text-emerald-600">
                          {period.totalCount.toLocaleString()}件
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">受注金額</span>
                        <span className="text-xl font-bold text-indigo-600">
                          {formatAmount(period.totalAmount)}円
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PJ区分別売上比較グラフ */}
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  PJ区分別 受注金額比較
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatAmount(value)}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value.toLocaleString()}円`,
                          "",
                        ]}
                      />
                      <Legend />
                      {data.map((period, index) => (
                        <Bar
                          key={period.period}
                          dataKey={`${period.period}期_金額`}
                          name={`${period.period}期`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PJ区分別件数比較グラフ */}
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  PJ区分別 受注件数比較
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Legend />
                      {data.map((period, index) => (
                        <Bar
                          key={period.period}
                          dataKey={`${period.period}期_件数`}
                          name={`${period.period}期`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 月次推移グラフ（8月〜7月） */}
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <h3 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  月次売上推移（8月〜7月）
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => formatAmount(value)} />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value.toLocaleString()}円`,
                          "",
                        ]}
                      />
                      <Legend />
                      {data.map((period, index) => (
                        <Line
                          key={period.period}
                          type="monotone"
                          dataKey={`${period.period}期`}
                          name={`${period.period}期`}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PJ区分別詳細テーブル */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
                  <h3 className="text-base font-bold text-white">
                    PJ区分別 詳細データ
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                          PJ区分
                        </th>
                        {data.map((period) => (
                          <th
                            key={`${period.period}-count`}
                            className="px-4 py-3 text-right text-sm font-bold text-gray-700"
                          >
                            {period.period}期 件数
                          </th>
                        ))}
                        {data.map((period) => (
                          <th
                            key={`${period.period}-amount`}
                            className="px-4 py-3 text-right text-sm font-bold text-gray-700"
                          >
                            {period.period}期 金額
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {comparisonData.map((row, index) => (
                        <tr
                          key={row.category}
                          className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">
                            {row.category}
                          </td>
                          {data.map((period) => (
                            <td
                              key={`${period.period}-count-val`}
                              className="px-4 py-3 text-sm text-right text-gray-700"
                            >
                              {(row[`${period.period}期_件数`] || 0).toLocaleString()}
                            </td>
                          ))}
                          {data.map((period) => (
                            <td
                              key={`${period.period}-amount-val`}
                              className="px-4 py-3 text-sm text-right text-gray-700"
                            >
                              {formatAmount(row[`${period.period}期_金額`] || 0)}円
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">
                          合計
                        </td>
                        {data.map((period) => (
                          <td
                            key={`${period.period}-total-count`}
                            className="px-4 py-3 text-sm text-right font-bold text-emerald-600"
                          >
                            {period.totalCount.toLocaleString()}
                          </td>
                        ))}
                        {data.map((period) => (
                          <td
                            key={`${period.period}-total-amount`}
                            className="px-4 py-3 text-sm text-right font-bold text-indigo-600"
                          >
                            {formatAmount(period.totalAmount)}円
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {!loading && data.length === 0 && !error && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-emerald-100 to-teal-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">
                期間を選択して「分析実行」をクリックしてください
              </p>
            </div>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
