"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PackageSearch, CheckCircle2 } from "lucide-react";
import type { CatalogItem, TanaoroshiSession } from "@/lib/tanaoroshi/types";
import { loadSession, loadCatalog, loadQueue } from "@/lib/tanaoroshi/local-store";

export default function RemainingPage() {
  const router = useRouter();
  const [session, setSession] = useState<TanaoroshiSession | null>(null);
  const [unreported, setUnreported] = useState<CatalogItem[]>([]);
  const [reportedCount, setReportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (!s) {
        router.replace("/tanaoroshi");
        return;
      }
      setSession(s);
      const catalog = await loadCatalog();
      setTotalCount(catalog.length);

      const reported = new Set<string>();
      // 未送信（端末）
      const queue = await loadQueue();
      for (const e of queue) {
        if (e.warehouseCode === s.warehouseCode && e.round === s.round) reported.add(e.itemCode);
      }
      // 送信済み（全員分）
      try {
        const res = await fetch(`/api/tanaoroshi/reported?warehouse=${encodeURIComponent(s.warehouseCode)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success !== false) for (const c of j.reportedItemCodes || []) reported.add(c);
      } catch {
        /* オフライン時は端末分のみ */
      }

      setReportedCount(reported.size);
      setUnreported(catalog.filter((c) => !reported.has(c.itemCode)));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = unreported.filter((c) =>
    `${c.itemCode} ${c.itemName} ${c.spec}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between bg-gray-800 px-3 py-2 text-sm">
        <button onClick={() => router.push("/tanaoroshi/scan")} className="flex items-center gap-1 text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          読取へ戻る
        </button>
        <span className="text-gray-400">
          {session?.warehouseName}（{session?.round}回目）
        </span>
        <span />
      </div>

      <div className="flex items-center justify-between bg-gray-900 px-4 py-2 text-sm">
        <span className="flex items-center gap-1 text-amber-300">
          <PackageSearch className="h-4 w-4" />
          未報告 {unreported.length} 件
        </span>
        <span className="text-gray-400">
          報告済 {reportedCount} / 全 {totalCount}
        </span>
      </div>

      <div className="bg-gray-900 px-2 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="品番・品名で絞り込み"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900 px-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
          </div>
        ) : unreported.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-green-400">
            <CheckCircle2 className="h-10 w-10" />
            <span className="font-medium">未報告はありません</span>
            <span className="text-xs text-gray-500">すべての品目が報告済みです</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((c) => (
              <div key={c.itemCode} className="flex items-center gap-2 rounded-xl bg-gray-800 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-bold text-white">{c.itemCode}</div>
                  <div className="truncate text-xs text-gray-400">
                    {c.itemName || "（品名なし）"}
                    {c.spec ? ` / ${c.spec}` : ""}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  在庫 {c.systemQty}
                  {c.unit}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-500">該当なし</p>}
          </div>
        )}
      </div>
    </>
  );
}
