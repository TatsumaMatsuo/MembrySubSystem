"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { ArrowLeft, CalendarDays, RefreshCw, Loader2, Copy, Check } from "lucide-react";

interface CalItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
  role?: string;
}

const TYPE_LABEL: Record<string, string> = {
  primary: "個人(プライマリ)",
  shared: "共有",
  google: "Google連携",
  resource: "会議室/リソース",
  exchange: "Exchange連携",
};

export default function GanttCalendarsPage() {
  const router = useRouter();
  const [cals, setCals] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ success: boolean; calendars?: CalItem[]; error?: string }>("/api/eigyo/gantt/calendars");
      if (res.success) setCals(res.calendars || []);
      else setError(res.error || "取得に失敗しました");
    } catch (e: any) {
      setError(e?.message || "通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.alert(id);
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 overflow-auto">
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => router.push("/eigyo/gantt")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <ArrowLeft className="w-4 h-4" /> ガント一覧
              </button>
              <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2 text-gray-800">
                <CalendarDays className="w-6 h-6 text-indigo-600" /> カレンダー一覧（会社カレンダー特定用）
              </h1>
            </div>
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 再取得
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            ガントに休日背景を反映したい「会社の共有カレンダー」を下から探し、行の「IDをコピー」で calendar_id を取得してください。
          </p>
        </div>

        <div className="flex-1 p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="ml-3">読み込み中...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : cals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center text-sm text-gray-400">
              カレンダーが見つかりません。会社カレンダーをLarkで購読しているかご確認ください。
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">カレンダー名</th>
                    <th className="px-4 py-2.5 text-left font-medium">種別</th>
                    <th className="px-4 py-2.5 text-left font-medium">権限</th>
                    <th className="px-4 py-2.5 text-left font-medium">calendar_id</th>
                    <th className="px-4 py-2.5 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cals.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50/40">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {c.name}
                        {c.description ? <div className="text-xs font-normal text-gray-400">{c.description}</div> : null}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{TYPE_LABEL[c.type || ""] || c.type || "-"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.role || "-"}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs break-all">{c.id}</code>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => copyId(c.id)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                          {copied === c.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === c.id ? "コピー済" : "IDをコピー"}
                        </button>
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
