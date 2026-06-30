"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { BarChart3, RefreshCw, AlertCircle, Rocket, FileSearch, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface UsageRow {
  ym: string;
  user: string;
  dept: string;
  launch: number;
  fetch: number;
}

// 更新回数 = 情報取得回数（fetch）。起動回数（launch）も切替表示可。
type Metric = "fetch" | "launch";
const METRIC_LABEL: Record<Metric, string> = { fetch: "更新回数", launch: "起動回数" };
const DEFAULT_DEPT = "営業部";

// 円グラフ用カラーパレット（POP系）
const PIE_COLORS = [
  "#d946ef", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#3b82f6", "#14b8a6",
];

export default function SankouUsageDashboard() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(""); // 年月FROM（YYYY-MM）
  const [to, setTo] = useState("");     // 年月TO（YYYY-MM）
  const [dept, setDept] = useState(DEFAULT_DEPT); // 所属部署（""=全部署）
  const [metric, setMetric] = useState<Metric>("fetch");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<{ success: boolean; rows: UsageRow[]; error?: string }>("/api/eigyo/sankou-zu/usage");
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || "取得に失敗しました");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // 全期間の年月（昇順）と部署一覧
  const monthsAsc = useMemo(() => [...new Set(rows.map((r) => r.ym).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const depts = useMemo(() => [...new Set(rows.map((r) => r.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")), [rows]);

  // データ読込後、FROM/TO 未設定なら全範囲を初期値に
  useEffect(() => {
    if (monthsAsc.length === 0) return;
    setFrom((cur) => cur || monthsAsc[0]);
    setTo((cur) => cur || monthsAsc[monthsAsc.length - 1]);
  }, [monthsAsc]);

  const metricVal = (r: UsageRow) => (metric === "launch" ? r.launch : r.fetch);

  // FROM-TO + 所属部署 で絞り込み
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.ym) return false;
      if (from && r.ym < from) return false;
      if (to && r.ym > to) return false;
      if (dept && r.dept !== dept) return false;
      return true;
    });
  }, [rows, from, to, dept]);

  const totals = useMemo(() => {
    let launch = 0, fetch = 0;
    for (const r of filtered) { launch += r.launch; fetch += r.fetch; }
    return { launch, fetch, total: launch + fetch };
  }, [filtered]);

  // 推移グラフ用：年月ごとの更新回数合計（昇順）。FROM-TO の全月を欠損ゼロで埋める
  const trendData = useMemo(() => {
    if (!from || !to) return [];
    const sum = new Map<string, number>();
    for (const r of filtered) sum.set(r.ym, (sum.get(r.ym) || 0) + metricVal(r));
    // FROM〜TO の連続月を生成
    const out: { ym: string; value: number }[] = [];
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    let y = fy, mo = fm;
    let guard = 0;
    while ((y < ty || (y === ty && mo <= tm)) && guard++ < 240) {
      const key = `${y}-${String(mo).padStart(2, "0")}`;
      out.push({ ym: key, value: sum.get(key) || 0 });
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    return out;
  }, [filtered, from, to, metric]);

  // 円グラフ用：担当者ごとの更新回数合計（降順）
  const pieData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const v = metricVal(r);
      if (v <= 0) continue;
      m.set(r.user || "不明", (m.get(r.user || "不明") || 0) + v);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, metric]);

  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData]);

  // 担当者別 明細（FROM-TO・部署で絞り込み済み）
  const detail = useMemo(() => [...filtered].sort((a, b) => (a.ym === b.ym ? a.user.localeCompare(b.user, "ja") : b.ym.localeCompare(a.ym))), [filtered]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-fuchsia-50 to-amber-50 overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-fuchsia-500" />
                <span className="bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 bg-clip-text text-transparent">参考図台帳 利用状況</span>
              </h1>
              <p className="text-sm text-gray-500">営業部 &gt; 参考図台帳 利用状況</p>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 更新
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* フィルタ：年月FROM-TO / 所属部署 / 対象指標 */}
            <div className="bg-white rounded-xl shadow border border-gray-100 p-4 flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">年月（FROM）</label>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-400" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {monthsAsc.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <span className="pb-2 text-gray-400">〜</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">年月（TO）</label>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-400" value={to} onChange={(e) => setTo(e.target.value)}>
                  {monthsAsc.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">所属部署</label>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-400" value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">全部署</option>
                  {/* 既定の営業部が一覧に無い場合も選べるように補完 */}
                  {!depts.includes(DEFAULT_DEPT) && <option value={DEFAULT_DEPT}>{DEFAULT_DEPT}</option>}
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">対象指標</label>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-400" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                  <option value="fetch">更新回数</option>
                  <option value="launch">起動回数</option>
                </select>
              </div>
              <span className="pb-2 text-xs text-gray-400">{loading ? "読込中..." : `${filtered.length} 行`}</span>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-5 flex items-center gap-4">
                <FileSearch className="w-8 h-8 text-sky-500" />
                <div>
                  <div className="text-xs font-bold text-sky-700">更新回数（情報取得回数）</div>
                  <div className="text-3xl font-extrabold text-sky-700">{totals.fetch.toLocaleString()}</div>
                </div>
              </div>
              <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-5 flex items-center gap-4">
                <Rocket className="w-8 h-8 text-fuchsia-500" />
                <div>
                  <div className="text-xs font-bold text-fuchsia-700">起動回数</div>
                  <div className="text-3xl font-extrabold text-fuchsia-700">{totals.launch.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 推移グラフ（月ごと） */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-fuchsia-500" />
                <h3 className="text-sm font-bold text-gray-700">{METRIC_LABEL[metric]} 推移{dept ? `（${dept}）` : "（全部署）"}</h3>
              </div>
              <div className="p-4" style={{ width: "100%", height: 320 }}>
                {trendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">データがありません。</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ym" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${(v as number).toLocaleString()} 回`, METRIC_LABEL[metric]]} />
                      <Legend />
                      <Line type="monotone" dataKey="value" name={METRIC_LABEL[metric]} stroke="#d946ef" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 担当者別 更新回数の割合（円グラフ） */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold text-gray-700">担当者別 {METRIC_LABEL[metric]} の割合{dept ? `（${dept}）` : "（全部署）"}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div style={{ width: "100%", height: 320 }}>
                  {pieData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">データがありません。</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          label={(p: any) => `${p.name} ${(p.percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${(v as number).toLocaleString()} 回`, METRIC_LABEL[metric]]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* 凡例＋数値テーブル */}
                <div className="overflow-auto max-h-[320px]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold">担当者</th>
                        <th className="px-3 py-2 text-right font-bold">{METRIC_LABEL[metric]}</th>
                        <th className="px-3 py-2 text-right font-bold">割合</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pieData.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">—</td></tr>
                      ) : pieData.map((d, i) => (
                        <tr key={d.name} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800 flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {d.name}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{d.value.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pieTotal ? ((d.value / pieTotal) * 100).toFixed(1) : "0.0"}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 明細(年月×担当者) */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-700">担当者別 明細{dept ? `（${dept}）` : ""}</h3></div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">年月</th>
                      <th className="px-3 py-2 text-left font-bold">担当者</th>
                      <th className="px-3 py-2 text-left font-bold">所属部署</th>
                      <th className="px-3 py-2 text-right font-bold">起動回数</th>
                      <th className="px-3 py-2 text-right font-bold">情報取得回数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">読み込み中...</td></tr>
                    ) : detail.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">データがありません。</td></tr>
                    ) : (
                      detail.map((r, i) => (
                        <tr key={`${r.ym}-${r.user}-${i}`} className="border-t border-gray-100 hover:bg-fuchsia-50/40">
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.ym}</td>
                          <td className="px-3 py-2 text-gray-800">{r.user}</td>
                          <td className="px-3 py-2 text-gray-600">{r.dept || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.launch.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.fetch.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
