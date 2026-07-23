"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, AlertTriangle, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout";

interface LogRow {
  sentAt: number | null;
  trigger: string;
  periodId: string;
  warehouseCode: string;
  kind: string;
  value: string;
  body: string;
  result: string;
  error: string;
  operator: string;
}

const dt = (ms: number | null) => (ms ? new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") : "—");

export default function NotifyLogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [onlyFail, setOnlyFail] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/tanaoroshi/notify-log");
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) throw new Error(j?.error || "取得に失敗しました");
      setRows(j.rows || []);
    } catch (e: any) {
      setErr(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const shown = onlyFail ? rows.filter((r) => r.result !== "成功") : rows;
  const failCount = rows.filter((r) => r.result !== "成功").length;

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
          <a href="/seizou/tanaoroshi" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> ダッシュボードへ
          </a>
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center gap-3">
              <Send className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold">通知 送信状況</h1>
                <p className="text-sm text-blue-100">Lark通知の送信ログ（成功/失敗）</p>
              </div>
            </div>
            <button onClick={load} className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30">
              <RefreshCw className="h-4 w-4" /> 更新
            </button>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> {err}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {rows.length} 件{failCount > 0 && <span className="ml-2 text-red-600">失敗 {failCount}</span>}
            </span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyFail} onChange={(e) => setOnlyFail(e.target.checked)} /> 失敗のみ
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
              </div>
            ) : shown.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">送信ログはまだありません。</div>
            ) : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">送信日時</th>
                    <th className="px-3 py-2">契機</th>
                    <th className="px-3 py-2">倉庫</th>
                    <th className="px-3 py-2">宛先</th>
                    <th className="px-3 py-2">結果</th>
                    <th className="px-3 py-2">本文/エラー</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((r, i) => (
                    <tr key={i} className={r.result !== "成功" ? "bg-red-50/40" : ""}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{dt(r.sentAt)}</td>
                      <td className="px-3 py-2 text-xs">{r.trigger}</td>
                      <td className="px-3 py-2 text-xs">{r.warehouseCode || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="text-gray-400">{r.kind}</span> {r.value}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${r.result === "成功" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {r.result || "—"}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-3 py-2 text-xs text-gray-500">
                        {r.error ? <span className="text-red-600">{r.error}</span> : <span className="line-clamp-2">{r.body}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
