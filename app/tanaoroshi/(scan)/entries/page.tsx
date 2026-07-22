"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2, Pencil, Upload, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { EntryRow, EntryDraft, TanaoroshiSession } from "@/lib/tanaoroshi/types";
import { loadSession, loadQueue } from "@/lib/tanaoroshi/local-store";
import { cancelEntry, editEntryQty } from "@/lib/tanaoroshi/actions";
import { flushQueue } from "@/lib/tanaoroshi/sync";

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const clock = (ms: number) =>
  ms ? new Date(ms + 9 * 3600 * 1000).toISOString().slice(11, 16) : "";

export default function EntriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<TanaoroshiSession | null>(null);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (s: TanaoroshiSession) => {
    setLoading(true);
    setErr(null);
    try {
      // 送信済み（サーバ・有効）
      let sent: EntryRow[] = [];
      try {
        const res = await fetch(`/api/tanaoroshi/entries?warehouse=${encodeURIComponent(s.warehouseCode)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success !== false) sent = j.entries || [];
      } catch {
        /* オフライン時はサーバ分を出せない */
      }
      // 未送信（端末 queue）
      const q = await loadQueue();
      const unsent: EntryRow[] = q
        .filter((e) => e.warehouseCode === s.warehouseCode && e.round === s.round)
        .map((e) => ({
          entryId: e.entryId,
          itemCode: e.itemCode,
          itemName: e.itemName,
          qty: e.qty,
          stockState: e.stockState,
          inputMethod: e.inputMethod,
          noSystemStock: e.noSystemStock,
          inputAt: e.inputAt,
          sent: false,
        }));
      const merged = [...unsent, ...sent].sort((a, b) => b.inputAt - a.inputAt);
      setRows(merged);
    } catch (e: any) {
      setErr(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (!s) {
        router.replace("/tanaoroshi");
        return;
      }
      setSession(s);
      await load(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (row: EntryRow) => {
    if (!session) return;
    if (!window.confirm(`${row.itemCode} を削除しますか？`)) return;
    setBusy(row.entryId);
    try {
      await cancelEntry(row.entryId);
      await load(session);
    } catch (e: any) {
      setErr(e?.message || "削除に失敗しました");
    } finally {
      setBusy("");
    }
  };

  const onEdit = async (row: EntryRow) => {
    if (!session) return;
    const input = window.prompt(`${row.itemCode} の数量`, String(row.qty));
    if (input == null) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("数量は正の数で入力してください");
      return;
    }
    if (n === row.qty) return;
    setBusy(row.entryId);
    try {
      await editEntryQty(row.entryId, n, () => {
        const draft: EntryDraft = {
          entryId: uuid(),
          periodId: session.periodId,
          warehouseCode: session.warehouseCode,
          warehouseName: session.warehouseName,
          itemCode: row.itemCode,
          itemName: row.itemName,
          qty: n,
          stockState: row.stockState,
          inputMethod: row.inputMethod,
          round: session.round,
          noSystemStock: row.noSystemStock,
          inputBy: user?.name || "",
          inputByEmail: user?.email || "",
          inputAt: Date.now(),
          deviceId: session.deviceId,
        };
        return draft;
      });
      flushQueue().catch(() => {});
      await load(session);
    } catch (e: any) {
      setErr(e?.message || "修正に失敗しました");
    } finally {
      setBusy("");
    }
  };

  const total = rows.reduce((s, r) => s + r.qty, 0);
  const unsentCount = rows.filter((r) => !r.sent).length;

  return (
    <>
      {/* ヘッダー */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-2 text-sm">
        <button onClick={() => router.push("/tanaoroshi/scan")} className="flex items-center gap-1 text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          読取へ戻る
        </button>
        <span className="text-gray-400">{session?.warehouseName}（{session?.round}回目）</span>
        <span className="flex items-center gap-1 text-orange-300">
          <Upload className="h-3.5 w-3.5" />
          未送信 {unsentCount}
        </span>
      </div>

      {/* サマリ */}
      <div className="flex items-center justify-between bg-gray-900 px-4 py-2 text-sm text-gray-300">
        <span>入力 {rows.length} 件</span>
        <span>合計数量 {total.toLocaleString()}</span>
      </div>

      {err && <div className="bg-red-900/40 px-4 py-2 text-sm text-red-200">{err}</div>}

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto bg-gray-900 px-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
            <Package className="h-8 w-8" />
            まだ入力がありません
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.entryId} className="flex items-center gap-2 rounded-xl bg-gray-800 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{r.itemCode}</span>
                    {!r.sent && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-300">未送信</span>}
                    {r.noSystemStock && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">在庫なし</span>}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {r.itemName || "（品名なし）"} ・ {clock(r.inputAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">数量</div>
                  <div className="text-lg font-bold tabular-nums text-white">{r.qty}</div>
                </div>
                <button
                  onClick={() => onEdit(r)}
                  disabled={!!busy}
                  className="rounded-lg bg-gray-700 p-2 text-blue-300 active:bg-gray-600 disabled:opacity-30"
                  aria-label="修正"
                >
                  {busy === r.entryId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onDelete(r)}
                  disabled={!!busy}
                  className="rounded-lg bg-gray-700 p-2 text-red-300 active:bg-gray-600 disabled:opacity-30"
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
