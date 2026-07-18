"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { GanttChartSquare, Plus, Search, RefreshCw, Trash2, Pencil, Loader2 } from "lucide-react";
import type { GanttChartMeta } from "@/lib/gantt/types";

function fmtDate(ms?: number): string {
  if (!ms) return "-";
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default function GanttListPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<GanttChartMeta[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eigyo/gantt/charts?q=${encodeURIComponent(query)}`).then((r) => r.json());
      if (res.success) setCharts(res.charts || []);
      else setError(res.error || "一覧の取得に失敗しました");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (c: GanttChartMeta) => {
    if (!window.confirm(`「${c.title}」を削除します。よろしいですか？`)) return;
    setDeleting(c.id);
    try {
      const res = await fetch(`/api/eigyo/gantt/charts?id=${encodeURIComponent(c.id)}`, { method: "DELETE" }).then((r) => r.json());
      if (res.success) setCharts((prev) => prev.filter((x) => x.id !== c.id));
      else window.alert(res.error || "削除に失敗しました");
    } catch {
      window.alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 overflow-auto">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2 text-gray-800">
              <GanttChartSquare className="w-6 h-6 text-indigo-600" /> ガントチャート
            </h1>
            <button
              onClick={() => router.push("/eigyo/gantt/edit")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> 新規作成
            </button>
          </div>
          {/* 検索 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="題名・作成者・売約番号で検索"
                className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button type="submit" className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900">
              検索
            </button>
            <button type="button" onClick={() => { setQ(""); load(""); }} className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50" title="再取得">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </form>
        </div>

        {/* 一覧 */}
        <div className="flex-1 p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="ml-3">読み込み中...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : charts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center text-sm text-gray-400">
              保存済みのガントチャートはありません。「新規作成」から作成できます。
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">題名</th>
                    <th className="px-4 py-2.5 text-left font-medium">売約番号</th>
                    <th className="px-4 py-2.5 text-left font-medium">作成者</th>
                    <th className="px-4 py-2.5 text-left font-medium">更新日時</th>
                    <th className="px-4 py-2.5 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {charts.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50/40">
                      <td className="px-4 py-2.5">
                        <button onClick={() => router.push(`/eigyo/gantt/edit?id=${encodeURIComponent(c.id)}`)} className="font-medium text-indigo-700 hover:underline text-left">
                          {c.title || "(無題)"}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{c.seiban || "-"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.author || "-"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDate(c.updatedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => router.push(`/eigyo/gantt/edit?id=${encodeURIComponent(c.id)}`)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                            <Pencil className="w-3.5 h-3.5" /> 開く
                          </button>
                          <button onClick={() => onDelete(c)} disabled={deleting === c.id} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                            {deleting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} 削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
