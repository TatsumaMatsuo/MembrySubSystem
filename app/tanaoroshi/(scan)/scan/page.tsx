"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Delete, Keyboard, Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { CatalogItem, EntryDraft, TanaoroshiSession } from "@/lib/tanaoroshi/types";
import { loadSession, loadCatalog, enqueue, loadQueue } from "@/lib/tanaoroshi/local-store";
import { startScanner, type ScannerHandle } from "@/lib/tanaoroshi/scanner";
import { normalizeItemCode } from "@/lib/tanaoroshi/item-code";
import { flushQueue } from "@/lib/tanaoroshi/sync";
import { unlockAudio, feedbackSuccess, feedbackAdd, feedbackError, feedbackWarn } from "@/lib/tanaoroshi/feedback";

type Current = { item: CatalogItem | null; code: string; noSystemStock: boolean };

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ScanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);
  const catalogRef = useRef<Map<string, CatalogItem>>(new Map());
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const lockedRef = useRef(false); // 品目確定〜数量入力の間は新規読取を無視

  const [session, setSession] = useState<TanaoroshiSession | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [qty, setQty] = useState("");
  const [accum, setAccum] = useState(0); // 当該品目の既登録累計（このセッションのqueue内）
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "add" | "err" | "warn"; text: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const showToast = (kind: "ok" | "add" | "err" | "warn", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 1800);
  };

  const refreshPending = useCallback(async () => {
    setPending((await loadQueue()).length);
  }, []);

  // 当該品目のqueue内累計
  const accumFor = useCallback(async (code: string, s: TanaoroshiSession): Promise<number> => {
    const q = await loadQueue();
    return q
      .filter((e) => e.itemCode === code && e.warehouseCode === s.warehouseCode && e.round === s.round)
      .reduce((sum, e) => sum + (e.qty || 0), 0);
  }, []);

  const handleCode = useCallback(
    async (raw: string) => {
      if (lockedRef.current) return;
      const code = normalizeItemCode(raw);
      const s = session;
      if (!s) return;
      if (!code) {
        feedbackError();
        showToast("err", "読み取れませんでした。もう一度かざしてください");
        return;
      }
      // 同一コードは2秒デデュープ
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 2000) return;
      lastScanRef.current = { code, at: now };

      const item = catalogRef.current.get(code) || null;
      lockedRef.current = true;
      const prior = await accumFor(code, s);
      setAccum(prior);
      if (item) {
        prior > 0 ? feedbackAdd() : feedbackSuccess();
        setCurrent({ item, code, noSystemStock: false });
      } else {
        // システム在庫に無い品目 → 差分として登録可（要確認）
        feedbackWarn();
        setCurrent({ item: null, code, noSystemStock: true });
      }
      setQty("");
    },
    [session, accumFor]
  );

  // セッション＆カタログ読み込み
  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (!s) {
        router.replace("/tanaoroshi");
        return;
      }
      setSession(s);
      const cat = await loadCatalog();
      catalogRef.current = new Map(cat.map((c) => [c.itemCode, c]));
      await refreshPending();
      setReady(true);
    })();
    return () => {
      scannerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ready になったらカメラ起動（video がマウントされてから）
  useEffect(() => {
    if (!ready || !videoRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const h = await startScanner(videoRef.current!, (raw) => handleCode(raw));
        if (cancelled) h.stop();
        else scannerRef.current = h;
      } catch (e: any) {
        setCamError("カメラを起動できませんでした。権限を確認するか、手入力をご利用ください。");
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const pushDigit = (d: string) => setQty((q) => (q.length >= 6 ? q : (q === "0" ? d : q + d)));
  const backspace = () => setQty((q) => q.slice(0, -1));
  const clearQty = () => setQty("");

  const cancelCurrent = () => {
    setCurrent(null);
    setQty("");
    lockedRef.current = false;
  };

  const decideNext = async () => {
    const s = session;
    if (!s || !current) return;
    const n = Number(qty);
    if (!qty || !Number.isFinite(n) || n <= 0) {
      showToast("err", "数量を入力してください");
      return;
    }
    const draft: EntryDraft = {
      entryId: uuid(),
      periodId: s.periodId,
      warehouseCode: s.warehouseCode,
      warehouseName: s.warehouseName,
      itemCode: current.code,
      itemName: current.item?.itemName || "",
      qty: n,
      stockState: "良品",
      inputMethod: manual ? "手入力" : "読取",
      round: s.round,
      noSystemStock: current.noSystemStock,
      inputBy: user?.name || "",
      inputByEmail: user?.email || "",
      inputAt: Date.now(),
      deviceId: s.deviceId,
    };
    await enqueue(draft);
    await refreshPending();
    showToast(current.noSystemStock ? "warn" : "ok", `${current.code} を ${n} 登録`);
    // バックグラウンド送信（オンライン時）
    flushQueue().then((r) => setPending(r.remaining)).catch(() => {});
    // 次へ
    setCurrent(null);
    setQty("");
    setManual(false);
    lockedRef.current = false;
  };

  const submitManual = async () => {
    const code = normalizeItemCode(manualCode);
    if (!code) {
      showToast("err", "6桁の品番を入力してください");
      return;
    }
    setManual(false);
    setManualCode("");
    // 手入力フラグを立ててから品目確定
    await handleCode(code);
  };

  const finish = async () => {
    setFinishing(true);
    const r = await flushQueue();
    setFinishing(false);
    if (r.error && r.remaining > 0) {
      showToast("err", `未送信 ${r.remaining}件（電波の良い場所で再送されます）`);
    }
    router.push("/tanaoroshi");
  };

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {/* ステータスバー */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-2 text-sm">
        <button onClick={finish} className="flex items-center gap-1 text-gray-300 hover:text-white" disabled={finishing}>
          <ArrowLeft className="h-4 w-4" />
          {session?.warehouseName}
        </button>
        <span className="text-gray-400">{session?.round}回目</span>
        <span className="flex items-center gap-1 text-orange-300">
          <Upload className="h-3.5 w-3.5" />
          未送信 {pending}
        </span>
      </div>

      {/* カメラ */}
      <div className="relative bg-black" style={{ height: "34vh" }}>
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {/* 横長ガイド枠（1次元コード用） */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-4/5 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {camError && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-200">{camError}</div>
        )}
        {toast && (
          <div
            className={`absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-medium shadow ${
              toast.kind === "ok"
                ? "bg-green-500 text-white"
                : toast.kind === "add"
                ? "bg-blue-500 text-white"
                : toast.kind === "warn"
                ? "bg-amber-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-900 p-3">
        {/* 品目カード */}
        <div className="mb-2 min-h-[64px] rounded-xl bg-gray-800 p-3">
          {current ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-white">{current.code}</span>
                {accum > 0 && <span className="text-sm text-blue-300">既登録累計 {accum}</span>}
              </div>
              {current.noSystemStock ? (
                <div className="text-sm text-amber-300">システム在庫にない品目（差分として登録）</div>
              ) : (
                <div className="truncate text-sm text-gray-300">
                  {current.item?.itemName}
                  {current.item?.unit ? `（${current.item.unit}）` : ""}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              バーコードをかざしてください
            </div>
          )}
        </div>

        {/* 数量表示 */}
        <div className="mb-2 flex items-center justify-between rounded-xl bg-gray-800 px-4 py-2">
          <span className="text-xs text-gray-400">数量</span>
          <span className="text-3xl font-bold tabular-nums text-white">{qty || "0"}</span>
        </div>

        {/* テンキー */}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => pushDigit(d)}
              disabled={!current}
              className="rounded-xl bg-gray-700 py-3 text-2xl font-semibold text-white active:bg-gray-600 disabled:opacity-30"
            >
              {d}
            </button>
          ))}
          <button onClick={clearQty} disabled={!current} className="rounded-xl bg-gray-700 py-3 text-lg text-gray-300 active:bg-gray-600 disabled:opacity-30">
            C
          </button>
          <button onClick={() => pushDigit("0")} disabled={!current} className="rounded-xl bg-gray-700 py-3 text-2xl font-semibold text-white active:bg-gray-600 disabled:opacity-30">
            0
          </button>
          <button onClick={backspace} disabled={!current} className="flex items-center justify-center rounded-xl bg-gray-700 py-3 text-white active:bg-gray-600 disabled:opacity-30">
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* アクション */}
        <div className="mt-2 flex gap-2">
          {current ? (
            <>
              <button onClick={cancelCurrent} className="flex items-center justify-center rounded-xl bg-gray-700 px-4 py-3 text-white active:bg-gray-600">
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={decideNext}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-lg font-bold text-white active:bg-blue-700"
              >
                <Check className="h-5 w-5" />
                決定 次へ
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                unlockAudio();
                setManual(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-700 py-3 font-medium text-white active:bg-gray-600"
            >
              <Keyboard className="h-5 w-5" />
              手入力
            </button>
          )}
        </div>
      </div>

      {/* 手入力モーダル */}
      {manual && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60 p-4" onClick={() => setManual(false)}>
          <div className="w-full rounded-2xl bg-white p-4 text-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-semibold">品番を手入力</h3>
            <input
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="例）F00015"
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-lg uppercase focus:border-blue-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setManual(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-medium text-gray-600">
                取消
              </button>
              <button onClick={submitManual} className="flex-1 rounded-xl bg-blue-600 py-2.5 font-medium text-white">
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
