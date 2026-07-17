"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Search, Download, Loader2, Users, CalendarDays, ClipboardList } from "lucide-react";
import { MainLayout } from "@/components/layout";

type Mode = "summary" | "detail";
interface DetailRow {
  company: string;
  seiban: string;
  bukken: string;
  date: string;
  workers: number;
}
interface SummaryRow {
  company: string;
  days: number;
  workers: number;
}
interface Result {
  mode: Mode;
  rows: DetailRow[] | SummaryRow[];
  totals: { days: number; workers: number };
}

export default function DemenKanriPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [company, setCompany] = useState("");
  const [mode, setMode] = useState<Mode>("summary");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!from || !to) return "作業日（From・To）は必須です。";
    if (from > to) return "作業日のFromはTo以前にしてください。";
    return null;
  };

  const buildQuery = (format: "json" | "xlsx") => {
    const p = new URLSearchParams({ from, to, mode, format });
    if (company.trim()) p.set("company", company.trim());
    return p.toString();
  };

  const handleSearch = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/demen?${buildQuery("json")}`);
      const data = await res.json();
      if (data.success) {
        setResult({ mode: data.mode, rows: data.rows, totals: data.totals });
      } else {
        setError(data.error || "抽出に失敗しました。");
        setResult(null);
      }
    } catch {
      setError("通信に失敗しました。");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch(`/api/demen?${buildQuery("xlsx")}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "ダウンロードに失敗しました。");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : "出面管理.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("ダウンロードに失敗しました。");
    } finally {
      setDownloading(false);
    }
  };

  const isDetail = result?.mode === "detail";

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        {/* ヘッダー */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-5 sm:px-6 shadow-lg">
          <div className="relative flex items-center gap-3">
            <div className="flex-none rounded-xl bg-white/20 p-2.5 backdrop-blur">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">出面管理</h1>
              <p className="text-xs sm:text-sm text-blue-100">
                現場作業日報から外注業者の出面（作業日数・作業人数）を集計し、請求書の人工と突合します。
              </p>
            </div>
          </div>
          <ClipboardList className="pointer-events-none absolute -right-4 -bottom-5 w-28 h-28 text-white/10" />
        </div>

        {/* 抽出条件 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">作業日 From <span className="text-red-500">*</span></span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">作業日 To <span className="text-red-500">*</span></span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">外注業者名（部分一致）</span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="未入力可"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="block">
              <span className="text-xs font-medium text-gray-500">表示単位</span>
              <div className="mt-1 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("summary")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === "summary" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  集計
                </button>
                <button
                  type="button"
                  onClick={() => setMode("detail")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === "detail" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  明細
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              検索
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excelダウンロード
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {/* 合計スタットタイル */}
        {result && result.rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex-none rounded-xl bg-blue-600 p-2">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-700/80">作業日数合計</p>
                <p className="text-2xl font-bold text-blue-800">
                  {result.totals.days.toLocaleString()} <span className="text-sm font-medium">日</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <div className="flex-none rounded-xl bg-indigo-600 p-2">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-indigo-700/80">作業人数合計（人工）</p>
                <p className="text-2xl font-bold text-indigo-800">
                  {result.totals.workers.toLocaleString()} <span className="text-sm font-medium">人</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 結果 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${isDetail ? "bg-indigo-500" : "bg-blue-500"}`} />
              {isDetail ? "明細" : "集計"}
              {result && <span className="ml-1 text-sm font-normal text-gray-400">{result.rows.length}件</span>}
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-3">読み込み中...</span>
            </div>
          ) : !result ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Search className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              条件を指定して検索してください。
            </div>
          ) : result.rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">該当データがありません。</div>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide shadow-sm">
                    {isDetail ? (
                      <>
                        <th className="px-4 py-2.5 text-left font-semibold">外注業者名</th>
                        <th className="px-4 py-2.5 text-left font-semibold">製番</th>
                        <th className="px-4 py-2.5 text-left font-semibold">製番名</th>
                        <th className="px-4 py-2.5 text-left font-semibold">作業日</th>
                        <th className="px-4 py-2.5 text-right font-semibold">作業人数</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-2.5 text-left font-semibold">外注業者名</th>
                        <th className="px-4 py-2.5 text-right font-semibold">作業日数</th>
                        <th className="px-4 py-2.5 text-right font-semibold">作業人数</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isDetail
                    ? (result.rows as DetailRow[]).map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{r.company || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{r.seiban || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-700">{r.bukken || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{r.date || "-"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{r.workers}</td>
                        </tr>
                      ))
                    : (result.rows as SummaryRow[]).map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{r.company || "-"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.days}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{r.workers}</td>
                        </tr>
                      ))}
                  <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold text-gray-900 border-t-2 border-blue-200">
                    {isDetail ? (
                      <>
                        <td className="px-4 py-3" colSpan={3}>合計</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-700">{result.totals.days} 日</td>
                        <td className="px-4 py-3 text-right tabular-nums text-indigo-700">{result.totals.workers}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">合計</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-700">{result.totals.days}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-indigo-700">{result.totals.workers}</td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
