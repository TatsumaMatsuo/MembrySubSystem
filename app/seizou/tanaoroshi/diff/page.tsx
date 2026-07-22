"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { DiffRow } from "@/lib/tanaoroshi/types";

type Row = DiffRow & { warehouseCode: string; warehouseName: string; resolved: boolean };

function DiffInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const period = sp.get("period") || "";
  const warehouse = sp.get("warehouse") || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams({ period });
        if (warehouse) qs.set("warehouse", warehouse);
        const res = await fetch(`/api/tanaoroshi/diff?${qs.toString()}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.success === false) throw new Error(j?.error || "取得に失敗しました");
        setRows(j.rows || []);
      } catch (e: any) {
        setErr(e?.message || "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [period, warehouse]);

  const whName = rows[0]?.warehouseName || warehouse;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
        <button onClick={() => router.push("/seizou/tanaoroshi")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ
        </button>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <FileSpreadsheet className="h-5 w-5 text-orange-600" />
            差分リスト {warehouse && `— ${whName}`}
          </h1>
          <p className="text-sm text-gray-500">システム在庫と実棚数量の差分（倉庫＋品目単位）</p>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {err}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
            差分はありません（未発行、または差分なし）
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  {!warehouse && <th className="px-3 py-2">倉庫</th>}
                  <th className="px-3 py-2">品番</th>
                  <th className="px-3 py-2">品名</th>
                  <th className="px-3 py-2 text-right">在庫</th>
                  <th className="px-3 py-2 text-right">実棚</th>
                  <th className="px-3 py-2 text-right">差分</th>
                  <th className="px-3 py-2">回</th>
                  <th className="px-3 py-2">内訳/理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={`${r.warehouseCode}-${r.itemCode}-${r.round}-${i}`} className={r.resolved ? "opacity-40" : ""}>
                    {!warehouse && <td className="px-3 py-2 text-xs text-gray-500">{r.warehouseName}</td>}
                    <td className="px-3 py-2 font-mono text-xs">{r.itemCode}</td>
                    <td className="px-3 py-2">{r.itemName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.systemQty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actualQty.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${r.diffQty < 0 ? "text-red-600" : "text-blue-600"}`}>
                      {r.diffQty > 0 ? "+" : ""}
                      {r.diffQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.round}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {r.stateBreakdown}
                      {r.reasonCode ? ` / ${r.reasonCode}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <p className="text-right text-xs text-gray-400">差分 {rows.length} 件</p>}
      </div>
    </div>
  );
}

export default function DiffPage() {
  return (
    <MainLayout>
      <Suspense fallback={<div className="p-6 text-gray-400">読み込み中…</div>}>
        <DiffInner />
      </Suspense>
    </MainLayout>
  );
}
