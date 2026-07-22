"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileDown, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MainLayout } from "@/components/layout";

interface Period {
  periodId: string;
  name: string;
  status: string;
}

function ExportInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState(sp.get("period") || "");
  const [downloading, setDownloading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tanaoroshi/progress");
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success !== false) {
          setPeriods(j.periods || []);
          if (!periodId) setPeriodId(j.periodId || "");
        }
      } catch {
        /* noop */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async () => {
    setDownloading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tanaoroshi/export?period=${encodeURIComponent(periodId)}`);
      if (!res.ok) {
        const t = await res.text();
        let m = `出力に失敗しました (${res.status})`;
        try {
          m = JSON.parse(t)?.error || m;
        } catch {
          /* noop */
        }
        throw new Error(m);
      }
      const total = res.headers.get("X-Total-Count") || "?";
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const mm = cd.match(/filename\*=UTF-8''([^;]+)/);
      const fileName = mm ? decodeURIComponent(mm[1]) : "棚卸在庫情報.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `${fileName} をダウンロードしました（${total}件）` });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "出力に失敗しました" });
    } finally {
      setDownloading(false);
    }
  };

  const writeback = async () => {
    if (!window.confirm("確定値を「棚卸在庫情報」テーブルへ書き戻します（対象倉庫の既存行は洗い替え）。よろしいですか？")) return;
    setWriting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tanaoroshi/export?period=${encodeURIComponent(periodId)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) throw new Error(j?.error || "書き戻しに失敗しました");
      setMsg({ ok: true, text: `棚卸在庫情報テーブルへ ${j.count} 件を書き戻しました` });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "書き戻しに失敗しました" });
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5">
        <button onClick={() => router.push("/seizou/tanaoroshi")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ
        </button>

        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
          <div className="flex items-center gap-3">
            <FileDown className="h-7 w-7" />
            <div>
              <h1 className="text-xl font-bold">基幹連携出力</h1>
              <p className="text-sm text-blue-100">確定値（最大回数の実棚）を基幹取込レイアウトで出力</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <label className="mb-1 block text-sm text-gray-500">棚卸期</label>
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          >
            {periods.map((p) => (
              <option key={p.periodId} value={p.periodId}>
                {p.name}（{p.status}）
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <button
            onClick={download}
            disabled={downloading || !periodId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
            EXCEL ダウンロード（基幹取込用）
          </button>
          <button
            onClick={writeback}
            disabled={writing || !periodId}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-3 font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            {writing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
            棚卸在庫情報テーブルへ書き戻し
          </button>
          <p className="text-xs text-gray-400">
            確定値 = 同一の倉庫＋品目で最も回数の大きい（最新の）実棚数量。報告のない品目は 0 として出力します。
          </p>
        </div>

        {msg && (
          <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <MainLayout>
      <Suspense fallback={<div className="p-6 text-gray-400">読み込み中…</div>}>
        <ExportInner />
      </Suspense>
    </MainLayout>
  );
}
