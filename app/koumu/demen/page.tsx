"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Search, Download, Loader2 } from "lucide-react";
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
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-1">出面管理</h1>
        <p className="text-xs text-gray-500 mb-4">
          現場作業日報をもとに、外注業者の出面（作業日数・作業人数）を集計し、請求書の人工と突合します。
        </p>

        {/* 抽出条件 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">作業日 From <span className="text-red-500">*</span></span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">作業日 To <span className="text-red-500">*</span></span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">外注業者名（部分一致）</span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="未入力可"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="block">
              <span className="text-xs text-gray-500">表示単位</span>
              <div className="mt-2 flex items-center gap-4">
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name="mode" checked={mode === "summary"} onChange={() => setMode("summary")} />
                  集計
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name="mode" checked={mode === "detail"} onChange={() => setMode("detail")} />
                  明細
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              検索
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excelダウンロード
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {/* 結果 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {isDetail ? "明細" : "集計"}
              {result && <span className="ml-2 text-sm text-gray-500">{result.rows.length}件</span>}
            </h2>
            {result && (
              <span className="text-xs text-gray-500">
                作業日数合計 <b className="text-gray-800">{result.totals.days}</b> 日 ／ 作業人数合計{" "}
                <b className="text-gray-800">{result.totals.workers}</b> 人
              </span>
            )}
          </div>

          {loading ? (
            <div className="px-6 py-10 flex items-center justify-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-3">読み込み中...</span>
            </div>
          ) : !result ? (
            <div className="px-6 py-10 text-center text-gray-500">条件を指定して検索してください。</div>
          ) : result.rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">該当データがありません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    {isDetail ? (
                      <>
                        <th className="px-3 py-2 text-left font-medium">外注業者名</th>
                        <th className="px-3 py-2 text-left font-medium">製番</th>
                        <th className="px-3 py-2 text-left font-medium">製番名</th>
                        <th className="px-3 py-2 text-left font-medium">作業日</th>
                        <th className="px-3 py-2 text-right font-medium">作業人数</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-left font-medium">外注業者名</th>
                        <th className="px-3 py-2 text-right font-medium">作業日数</th>
                        <th className="px-3 py-2 text-right font-medium">作業人数</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isDetail
                    ? (result.rows as DetailRow[]).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{r.company || "-"}</td>
                          <td className="px-3 py-2 text-gray-700">{r.seiban || "-"}</td>
                          <td className="px-3 py-2 text-gray-700">{r.bukken || "-"}</td>
                          <td className="px-3 py-2 text-gray-700">{r.date || "-"}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{r.workers}</td>
                        </tr>
                      ))
                    : (result.rows as SummaryRow[]).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{r.company || "-"}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.days}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{r.workers}</td>
                        </tr>
                      ))}
                  <tr className="bg-gray-100 font-semibold text-gray-800">
                    {isDetail ? (
                      <>
                        <td className="px-3 py-2" colSpan={3}>合計</td>
                        <td className="px-3 py-2 text-right">{result.totals.days} 日</td>
                        <td className="px-3 py-2 text-right">{result.totals.workers}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">合計</td>
                        <td className="px-3 py-2 text-right">{result.totals.days}</td>
                        <td className="px-3 py-2 text-right">{result.totals.workers}</td>
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
