"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { BarChart3, RefreshCw, AlertCircle, Rocket, FileSearch } from "lucide-react";

interface UsageRow {
  ym: string;
  user: string;
  dept: string;
  launch: number;
  fetch: number;
}

export default function SankouUsageDashboard() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ym, setYm] = useState(""); // 年月フィルタ（空=全期間）

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

  const months = useMemo(() => [...new Set(rows.map((r) => r.ym).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [rows]);
  const filtered = useMemo(() => (ym ? rows.filter((r) => r.ym === ym) : rows), [rows, ym]);

  const totals = useMemo(() => {
    let launch = 0, fetch = 0;
    for (const r of filtered) { launch += r.launch; fetch += r.fetch; }
    return { launch, fetch };
  }, [filtered]);

  // 月別合計（年月降順）
  const byMonth = useMemo(() => {
    const m = new Map<string, { launch: number; fetch: number }>();
    for (const r of rows) {
      const e = m.get(r.ym) || { launch: 0, fetch: 0 };
      e.launch += r.launch; e.fetch += r.fetch;
      m.set(r.ym, e);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

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

            {/* 期間フィルタ + サマリー */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-bold text-gray-600">対象年月</label>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-400" value={ym} onChange={(e) => setYm(e.target.value)}>
                <option value="">全期間</option>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="text-xs text-gray-400">{loading ? "読込中..." : `${filtered.length} 行`}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-5 flex items-center gap-4">
                <Rocket className="w-8 h-8 text-fuchsia-500" />
                <div>
                  <div className="text-xs font-bold text-fuchsia-700">起動回数{ym ? `（${ym}）` : "（全期間）"}</div>
                  <div className="text-3xl font-extrabold text-fuchsia-700">{totals.launch.toLocaleString()}</div>
                </div>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-5 flex items-center gap-4">
                <FileSearch className="w-8 h-8 text-sky-500" />
                <div>
                  <div className="text-xs font-bold text-sky-700">情報取得回数{ym ? `（${ym}）` : "（全期間）"}</div>
                  <div className="text-3xl font-extrabold text-sky-700">{totals.fetch.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 月別合計 */}
            {!ym && byMonth.length > 0 && (
              <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-700">月別合計</h3></div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-2 text-left font-bold">年月</th><th className="px-3 py-2 text-right font-bold">起動回数</th><th className="px-3 py-2 text-right font-bold">情報取得回数</th></tr></thead>
                  <tbody>
                    {byMonth.map(([m, e]) => (
                      <tr key={m} className="border-t border-gray-100 hover:bg-fuchsia-50/40 cursor-pointer" onClick={() => setYm(m)}>
                        <td className="px-3 py-2 text-gray-800">{m}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{e.launch.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{e.fetch.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 明細(年月×担当者) */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-700">担当者別{ym ? `（${ym}）` : ""}</h3></div>
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
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">データがありません。</td></tr>
                    ) : (
                      filtered.map((r, i) => (
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
