"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
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
  Line,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Printer,
  BarChart3,
  PieChart as PieChartIcon,
  Table2,
} from "lucide-react";

// --- 型定義 ---

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
  monthlyData: MonthlySummary[];
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
  responsibility: string;
  changeReason: string;
  judgment1: boolean | null;
  judgment2: boolean | null;
}

interface ResponsibilityItem {
  category: string;
  reason: string;
  monthlyCounts: Record<string, number>;
  total: number;
}

interface JudgmentByCategory {
  category: string;
  j1Yes: number;
  j1No: number;
  j2Yes: number;
  j2No: number;
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
    monthlyData: MonthlySummary[];
  }[];
  byOffice: OfficeSummary[];
  byTantousha: TantoushaSummary[];
  records: DeliveryChangeRecord[];
  snapshotUsed?: boolean;
  responsibilityData: {
    items: ResponsibilityItem[];
    monthlyTotals: Record<string, number>;
    grandTotal: number;
  };
  judgmentData: {
    byResponsibility: JudgmentByCategory[];
    totals: { j1Yes: number; j1No: number; j2Yes: number; j2No: number };
  };
}

// --- ヘルパー ---

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getRateColor(rate: number): string {
  if (rate >= 0.15) return "text-red-600";
  if (rate >= 0.10) return "text-orange-500";
  if (rate >= 0.05) return "text-yellow-600";
  return "text-green-600";
}

function getRateBgColor(rate: number): string {
  if (rate >= 0.15) return "bg-red-50";
  if (rate >= 0.10) return "bg-orange-50";
  if (rate >= 0.05) return "bg-yellow-50";
  return "";
}

const PIE_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];

// ローディングスケルトン
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded-xl"></div>
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

// --- タブ定義 ---
type TabId = "table" | "analysis" | "charts";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "table", label: "管理表", icon: <Table2 className="w-4 h-4" /> },
  { id: "analysis", label: "分析", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "charts", label: "グラフ", icon: <PieChartIcon className="w-4 h-4" /> },
];

// =======================
// 担当者別管理表タブ
// =======================
function ManagementTable({ data }: { data: PeriodData }) {
  const [expandedOffices, setExpandedOffices] = useState<string[]>([]);

  const toggleOffice = (name: string) => {
    setExpandedOffices(prev =>
      prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]
    );
  };

  const months = data.monthlyData;

  // 合計行の計算
  const grandTotalMonthly = months.map(m => {
    let cc = 0, bc = 0;
    data.byOffice.forEach(o => {
      const om = o.monthlyData.find(md => md.yearMonth === m.yearMonth);
      if (om) { cc += om.changeCount; bc += om.backlogCount; }
    });
    return { yearMonth: m.yearMonth, changeCount: cc, backlogCount: bc, rate: bc > 0 ? cc / bc : 0 };
  });

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          担当者別納期変更管理表
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* 月ヘッダー */}
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-2 py-1.5 text-left font-bold text-gray-700 sticky left-0 bg-gray-100 z-20 min-w-[52px] border-r border-gray-200">分類</th>
              <th className="px-2 py-1.5 text-left font-bold text-gray-700 sticky left-[52px] bg-gray-100 z-20 min-w-[64px] border-r border-gray-200">営業所</th>
              <th className="px-2 py-1.5 text-left font-bold text-gray-700 sticky left-[116px] bg-gray-100 z-20 min-w-[72px] border-r border-gray-300">担当者</th>
              {months.map(m => (
                <th key={m.yearMonth} className="px-0 py-1.5 text-center font-bold text-gray-700 border-r border-gray-200" colSpan={3}>
                  {m.month}
                </th>
              ))}
              <th className="px-0 py-1.5 text-center font-bold text-gray-700 bg-blue-50" colSpan={3}>合計</th>
            </tr>
            {/* サブヘッダー */}
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px]">
              <th className="sticky left-0 bg-gray-50 z-20 border-r border-gray-200"></th>
              <th className="sticky left-[52px] bg-gray-50 z-20 border-r border-gray-200"></th>
              <th className="sticky left-[116px] bg-gray-50 z-20 border-r border-gray-300"></th>
              {months.map(m => (
                <React.Fragment key={`sub-${m.yearMonth}`}>
                  <th className="px-0.5 py-1 text-center text-gray-500 min-w-[28px]">変更</th>
                  <th className="px-0.5 py-1 text-center text-gray-500 min-w-[28px]">残数</th>
                  <th className="px-0.5 py-1 text-center text-gray-500 min-w-[38px] border-r border-gray-200">率</th>
                </React.Fragment>
              ))}
              <th className="px-0.5 py-1 text-center text-gray-500 bg-blue-50 min-w-[28px]">変更</th>
              <th className="px-0.5 py-1 text-center text-gray-500 bg-blue-50 min-w-[28px]">残数</th>
              <th className="px-0.5 py-1 text-center text-gray-500 bg-blue-50 min-w-[38px]">率</th>
            </tr>
          </thead>
          <tbody>
            {data.byOffice.map((office, oidx) => {
              const isFirstInRegion = oidx === 0 || data.byOffice[oidx - 1].region !== office.region;
              const regionOffices = data.byOffice.filter(o => o.region === office.region);
              const regionSpan = regionOffices.length;

              return (
                <React.Fragment key={office.name}>
                  {/* 営業所行 */}
                  <tr
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                    onClick={() => toggleOffice(office.name)}
                  >
                    {isFirstInRegion && (
                      <td
                        className="px-2 py-1.5 font-bold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 align-top"
                        rowSpan={regionSpan + (expandedOffices.filter(e => regionOffices.some(ro => ro.name === e)).length > 0 ? regionOffices.reduce((sum, ro) => sum + (expandedOffices.includes(ro.name) ? ro.tantoushaList.length : 0), 0) : 0)}
                      >
                        {office.region}
                      </td>
                    )}
                    {!isFirstInRegion && <td className="hidden"></td>}
                    <td className="px-2 py-1.5 font-bold text-gray-800 sticky left-[52px] bg-gray-50 z-10 border-r border-gray-200 whitespace-nowrap">
                      <span className="flex items-center gap-0.5">
                        {expandedOffices.includes(office.name) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {office.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-500 sticky left-[116px] bg-gray-50 z-10 border-r border-gray-300">
                      ({office.tantoushaList.length}名)
                    </td>
                    {office.monthlyData.map(m => (
                      <React.Fragment key={`o-${m.yearMonth}`}>
                        <td className="px-0.5 py-1.5 text-center font-medium">{m.changeCount || ""}</td>
                        <td className="px-0.5 py-1.5 text-center text-gray-500">{m.backlogCount || ""}</td>
                        <td className={`px-0.5 py-1.5 text-center font-medium border-r border-gray-200 ${getRateColor(m.changeRate)} ${getRateBgColor(m.changeRate)}`}>
                          {m.changeCount > 0 || m.backlogCount > 0 ? formatPercent(m.changeRate) : ""}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className="px-0.5 py-1.5 text-center font-bold bg-blue-50">{office.totalChangeCount}</td>
                    <td className="px-0.5 py-1.5 text-center bg-blue-50">{office.totalBacklogCount}</td>
                    <td className={`px-0.5 py-1.5 text-center font-bold bg-blue-50 ${getRateColor(office.changeRate)}`}>
                      {formatPercent(office.changeRate)}
                    </td>
                  </tr>
                  {/* 担当者行 */}
                  {expandedOffices.includes(office.name) &&
                    office.tantoushaList.map((t, tidx) => (
                      <tr key={t.name} className={`${tidx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-100`}>
                        <td className="sticky left-[52px] bg-inherit z-10 border-r border-gray-200"></td>
                        <td className="px-2 py-1 text-gray-700 sticky left-[116px] bg-inherit z-10 border-r border-gray-300 whitespace-nowrap">
                          {t.name}
                        </td>
                        {t.monthlyData.map(m => (
                          <React.Fragment key={`t-${m.yearMonth}`}>
                            <td className="px-0.5 py-1 text-center">{m.changeCount || ""}</td>
                            <td className="px-0.5 py-1 text-center text-gray-400">{m.backlogCount || ""}</td>
                            <td className={`px-0.5 py-1 text-center border-r border-gray-200 ${getRateColor(m.changeRate)} ${getRateBgColor(m.changeRate)}`}>
                              {m.changeCount > 0 || m.backlogCount > 0 ? formatPercent(m.changeRate) : ""}
                            </td>
                          </React.Fragment>
                        ))}
                        <td className="px-0.5 py-1 text-center font-medium bg-blue-50">{t.totalChangeCount}</td>
                        <td className="px-0.5 py-1 text-center bg-blue-50">{t.totalBacklogCount}</td>
                        <td className={`px-0.5 py-1 text-center font-medium bg-blue-50 ${getRateColor(t.changeRate)}`}>
                          {formatPercent(t.changeRate)}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
            {/* 合計行 */}
            <tr className="bg-slate-200 border-t-2 border-gray-400 font-bold">
              <td className="px-2 py-2 sticky left-0 bg-slate-200 z-10 border-r border-gray-300" colSpan={3}>
                合計
              </td>
              {grandTotalMonthly.map(m => (
                <React.Fragment key={`total-${m.yearMonth}`}>
                  <td className="px-0.5 py-2 text-center">{m.changeCount || ""}</td>
                  <td className="px-0.5 py-2 text-center">{m.backlogCount || ""}</td>
                  <td className={`px-0.5 py-2 text-center border-r border-gray-200 ${getRateColor(m.rate)}`}>
                    {m.changeCount > 0 || m.backlogCount > 0 ? formatPercent(m.rate) : ""}
                  </td>
                </React.Fragment>
              ))}
              <td className="px-0.5 py-2 text-center bg-blue-100">{data.totalChangeCount}</td>
              <td className="px-0.5 py-2 text-center bg-blue-100">{data.totalBacklogCount}</td>
              <td className={`px-0.5 py-2 text-center bg-blue-100 ${getRateColor(data.overallChangeRate)}`}>
                {formatPercent(data.overallChangeRate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* スナップショット情報 */}
      {data.snapshotUsed && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200 text-xs text-green-700">
          受注残スナップショット使用中（毎月20日時点のBAIYAKUテーブル基準）
        </div>
      )}
    </div>
  );
}

// =======================
// 分析タブ
// =======================
function AnalysisTab({ data }: { data: PeriodData }) {
  const months = data.monthlyData;
  const { responsibilityData, judgmentData } = data;

  return (
    <div className="space-y-6">
      {/* 責任区分×変更要因 月別推移表 */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
          <h3 className="text-base font-bold text-white">責任区分×変更要因 月別推移</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-3 py-1.5 text-left font-bold text-gray-700 min-w-[64px] border-r border-gray-200">責任区分</th>
                <th className="px-3 py-1.5 text-left font-bold text-gray-700 min-w-[72px] border-r border-gray-300">変更要因</th>
                {months.map(m => (
                  <th key={m.yearMonth} className="px-1 py-1.5 text-center font-bold text-gray-700 min-w-[32px] border-r border-gray-200">
                    {m.month.replace("月", "")}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-bold text-gray-700 bg-blue-50 min-w-[36px]">合計</th>
              </tr>
            </thead>
            <tbody>
              {responsibilityData.items.map((item, idx) => {
                const isFirstInCategory = idx === 0 || responsibilityData.items[idx - 1].category !== item.category;
                const categoryItems = responsibilityData.items.filter(i => i.category === item.category);
                return (
                  <tr key={`${item.category}-${item.reason}`} className="border-b border-gray-100 hover:bg-gray-50">
                    {isFirstInCategory && (
                      <td className="px-3 py-1.5 font-bold text-gray-700 border-r border-gray-200 align-top" rowSpan={categoryItems.length}>
                        {item.category}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-gray-600 border-r border-gray-300">{item.reason}</td>
                    {months.map(m => (
                      <td key={m.yearMonth} className="px-1 py-1.5 text-center border-r border-gray-200">
                        {item.monthlyCounts[m.yearMonth] || ""}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-medium bg-blue-50">{item.total || ""}</td>
                  </tr>
                );
              })}
              {/* 合計行 */}
              <tr className="bg-slate-200 border-t-2 border-gray-400 font-bold">
                <td className="px-3 py-1.5 border-r border-gray-300" colSpan={2}>合計</td>
                {months.map(m => (
                  <td key={`rt-${m.yearMonth}`} className="px-1 py-1.5 text-center border-r border-gray-200">
                    {responsibilityData.monthlyTotals[m.yearMonth] || ""}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center bg-blue-100">{responsibilityData.grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 判定テーブル */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 第1判定 */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
            <h3 className="text-base font-bold text-white">第1判定</h3>
            <p className="text-xs text-amber-100 mt-0.5">変更前施工予定日 - 申請日 &le; 30日 → ○（材料手配済の可能性）</p>
          </div>
          <div className="p-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-3 py-2 text-left font-bold text-gray-700">判定</th>
                  {judgmentData.byResponsibility.map(j => (
                    <th key={j.category} className="px-3 py-2 text-center font-bold text-gray-700">{j.category}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-bold text-gray-700 bg-blue-50">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 font-medium text-green-700">○</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j1y-${j.category}`} className="px-3 py-2 text-center">{j.j1Yes || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold bg-blue-50">{judgmentData.totals.j1Yes}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 font-medium text-red-600">×</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j1n-${j.category}`} className="px-3 py-2 text-center">{j.j1No || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold bg-blue-50">{judgmentData.totals.j1No}</td>
                </tr>
                <tr className="bg-slate-100 border-t border-gray-300 font-bold">
                  <td className="px-3 py-2">合計</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j1t-${j.category}`} className="px-3 py-2 text-center">{j.j1Yes + j.j1No || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center bg-blue-50">{judgmentData.totals.j1Yes + judgmentData.totals.j1No}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 第2判定 */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3">
            <h3 className="text-base font-bold text-white">第2判定</h3>
            <p className="text-xs text-red-100 mt-0.5">第1判定○ AND 変更後-変更前 &ge; 7日 → ○（材料手配+長期保管）</p>
          </div>
          <div className="p-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-3 py-2 text-left font-bold text-gray-700">判定</th>
                  {judgmentData.byResponsibility.map(j => (
                    <th key={j.category} className="px-3 py-2 text-center font-bold text-gray-700">{j.category}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-bold text-gray-700 bg-blue-50">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 font-medium text-green-700">○</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j2y-${j.category}`} className="px-3 py-2 text-center">{j.j2Yes || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold bg-blue-50">{judgmentData.totals.j2Yes}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 font-medium text-red-600">×</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j2n-${j.category}`} className="px-3 py-2 text-center">{j.j2No || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold bg-blue-50">{judgmentData.totals.j2No}</td>
                </tr>
                <tr className="bg-slate-100 border-t border-gray-300 font-bold">
                  <td className="px-3 py-2">合計</td>
                  {judgmentData.byResponsibility.map(j => (
                    <td key={`j2t-${j.category}`} className="px-3 py-2 text-center">{j.j2Yes + j.j2No || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center bg-blue-50">{judgmentData.totals.j2Yes + judgmentData.totals.j2No}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 変更詳細一覧 */}
      <DetailTable records={data.records} />

      {/* 定義説明 */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h4 className="font-bold text-blue-800 mb-2">判定定義</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>・<b>第1判定</b>: 変更前施工予定日 - NI申請日 ≦ 30日 → ○（材料手配済の可能性あり）</li>
          <li>・<b>第2判定</b>: 第1判定=○ かつ 変更後施工予定日 - 変更前施工予定日 ≧ 7日 → ○（材料手配+長期保管リスク）</li>
          <li>・<b>納期変更回数カウント</b>: 変更後日程 - 変更前日程 の絶対値 &gt; 7日 の場合に1回カウント</li>
        </ul>
      </div>
    </div>
  );
}

// 変更詳細一覧
function DetailTable({ records }: { records: DeliveryChangeRecord[] }) {
  const [show, setShow] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div
        className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 cursor-pointer flex items-center justify-between"
        onClick={() => setShow(!show)}
      >
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          納期変更一覧（カウント対象: {records.length}件）
        </h3>
        <div className="text-white">
          {show ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>
      {show && (
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-bold text-gray-700">営業所</th>
                <th className="px-2 py-2 text-left font-bold text-gray-700">担当者</th>
                <th className="px-2 py-2 text-left font-bold text-gray-700">受注番号</th>
                <th className="px-2 py-2 text-left font-bold text-gray-700">受注件名</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">変更前</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">変更後</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">日数差</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">申請日</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">責任区分</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">第1</th>
                <th className="px-2 py-2 text-center font-bold text-gray-700">第2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r, idx) => (
                <tr key={r.recordId || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-2 py-1.5 text-gray-600">{r.office}</td>
                  <td className="px-2 py-1.5 text-gray-700">{r.tantousha}</td>
                  <td className="px-2 py-1.5 text-gray-700 font-mono">{r.orderNumber}</td>
                  <td className="px-2 py-1.5 text-gray-700 max-w-[160px] truncate" title={r.orderName}>{r.orderName}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{r.beforeDate}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{r.afterDate}</td>
                  <td className={`px-2 py-1.5 text-center font-medium ${r.daysDiff !== null && Math.abs(r.daysDiff) > 14 ? "text-red-600" : "text-orange-500"}`}>
                    {r.daysDiff !== null ? `${r.daysDiff}日` : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{r.applicationDate}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.responsibility === "社外" ? "bg-blue-100 text-blue-700" :
                      r.responsibility === "自社" ? "bg-orange-100 text-orange-700" :
                      r.responsibility === "納期確定" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {r.responsibility || "-"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {r.judgment1 === true ? <span className="text-green-600 font-bold">○</span> :
                     r.judgment1 === false ? <span className="text-red-500">×</span> : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {r.judgment2 === true ? <span className="text-green-600 font-bold">○</span> :
                     r.judgment2 === false ? <span className="text-red-500">×</span> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =======================
// グラフタブ
// =======================
function ChartsTab({ data }: { data: PeriodData }) {
  // 責任区分別のPieデータ
  const responsibilityPieData = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const item of data.responsibilityData.items) {
      if (item.total > 0) {
        catMap.set(item.category, (catMap.get(item.category) || 0) + item.total);
      }
    }
    return Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
  }, [data.responsibilityData]);

  // 要因別のPieデータ
  const reasonPieData = useMemo(() => {
    return data.responsibilityData.items
      .filter(item => item.total > 0)
      .map(item => ({ name: item.reason, value: item.total }));
  }, [data.responsibilityData]);

  // 第1判定Pieデータ
  const j1PieData = useMemo(() => {
    const { j1Yes, j1No } = data.judgmentData.totals;
    if (j1Yes === 0 && j1No === 0) return [];
    return [
      { name: "○", value: j1Yes },
      { name: "×", value: j1No },
    ];
  }, [data.judgmentData]);

  // 第2判定Pieデータ
  const j2PieData = useMemo(() => {
    const { j2Yes, j2No } = data.judgmentData.totals;
    if (j2Yes === 0 && j2No === 0) return [];
    return [
      { name: "○", value: j2Yes },
      { name: "×", value: j2No },
    ];
  }, [data.judgmentData]);

  const renderLabel = (props: any) =>
    `${props.name || ""} ${((props.percent || 0) * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      {/* 月別推移グラフ */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3">
          <h3 className="text-base font-bold text-white">月別 変更回数・受注残数推移</h3>
        </div>
        <div className="p-4" style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                formatter={(value: any, name: any) => [
                  name === "変更率" ? formatPercent(value as number) : `${value}`,
                  name,
                ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="changeCount" name="変更回数" fill="#3b82f6" />
              <Bar yAxisId="left" dataKey="backlogCount" name="受注残数" fill="#10b981" />
              <Line yAxisId="right" type="monotone" dataKey="changeRate" name="変更率" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 地域別月別推移 */}
      {data.byRegion.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.byRegion.map(region => (
            <div key={region.name} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-500 to-slate-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white">{region.name} 変更回数推移</h3>
              </div>
              <div className="p-3" style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={region.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: any, name: any) => [name === "変更率" ? formatPercent(value as number) : `${value}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="changeCount" name="変更回数" fill="#6366f1" />
                    <Line yAxisId="right" type="monotone" dataKey="changeRate" name="変更率" stroke="#ef4444" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 責任区分割合 */}
        {responsibilityPieData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3">
              <h3 className="text-base font-bold text-white">責任区分割合</h3>
            </div>
            <div className="p-4 flex justify-center" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={responsibilityPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderLabel}
                    dataKey="value"
                  >
                    {responsibilityPieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 要因割合 */}
        {reasonPieData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3">
              <h3 className="text-base font-bold text-white">変更要因割合</h3>
            </div>
            <div className="p-4 flex justify-center" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderLabel}
                    dataKey="value"
                  >
                    {reasonPieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 第1判定割合 */}
        {j1PieData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
              <h3 className="text-base font-bold text-white">第1判定割合</h3>
            </div>
            <div className="p-4 flex justify-center" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={j1PieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderLabel}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 第2判定割合 */}
        {j2PieData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3">
              <h3 className="text-base font-bold text-white">第2判定割合</h3>
            </div>
            <div className="p-4 flex justify-center" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={j2PieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderLabel}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =======================
// メインページ
// =======================
export default function DeliveryChangePage() {
  const { user, status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeriodData | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState(50);
  const [selectedPeriod, setSelectedPeriod] = useState(50);
  const [activeTab, setActiveTab] = useState<TabId>("table");

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

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-white no-print">
          <p className="text-sm text-gray-500 mb-1">製造部 &gt; 納期変更分析</p>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              納期変更一覧表
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-gray-600">期間:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 10 }, (_, i) => currentPeriod - 5 + i).map((p) => (
                    <option key={p} value={p}>第{p}期</option>
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
              <PrintButton />
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
              {/* 期間情報 */}
              <div className="flex justify-between items-center no-print">
                <div className="text-sm text-gray-500">
                  第{selectedPeriod}期 ({data.dateRange?.start} ～ {data.dateRange?.end})
                </div>
              </div>

              {/* KPIカード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-100">総変更回数</span>
                    <Calendar className="w-4 h-4 text-blue-200" />
                  </div>
                  <div className="text-xl font-bold">{data.totalChangeCount}回</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg p-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-emerald-100">受注残数</span>
                    <TrendingUp className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div className="text-xl font-bold">{data.totalBacklogCount}件</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg p-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-orange-100">変更率</span>
                    <AlertTriangle className="w-4 h-4 text-orange-200" />
                  </div>
                  <div className="text-xl font-bold">{formatPercent(data.overallChangeRate)}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-purple-100">営業所数</span>
                    <Users className="w-4 h-4 text-purple-200" />
                  </div>
                  <div className="text-xl font-bold">{data.byOffice.length}拠点</div>
                </div>
              </div>

              {/* タブ */}
              <div className="flex gap-1 border-b border-gray-200 no-print">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* タブコンテンツ */}
              <div className="mt-2">
                {activeTab === "table" && <ManagementTable data={data} />}
                {activeTab === "analysis" && <AnalysisTab data={data} />}
                {activeTab === "charts" && <ChartsTab data={data} />}
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
