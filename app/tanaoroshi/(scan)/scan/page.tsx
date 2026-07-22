"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Delete, Keyboard, Check, Loader2, X, Undo2, ListChecks, PackageSearch, Camera } from "lucide-react";
import { compressImageToLimit } from "@/lib/document-upload";
import { useAuth } from "@/lib/auth";
import type { CatalogItem, EntryDraft, TanaoroshiSession, StockState } from "@/lib/tanaoroshi/types";
import { loadSession, loadCatalog, enqueue, loadQueue } from "@/lib/tanaoroshi/local-store";
import { startScanner, type ScannerHandle } from "@/lib/tanaoroshi/scanner";
import { normalizeItemCode } from "@/lib/tanaoroshi/item-code";
import { flushQueue } from "@/lib/tanaoroshi/sync";
import { cancelEntry } from "@/lib/tanaoroshi/actions";
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
  const accumRef = useRef<Map<string, number>>(new Map()); // 品目コード→累計（送信済み＋未送信）
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const lockedRef = useRef(false); // 品目確定〜数量入力の間は新規読取を無視

  const [session, setSession] = useState<TanaoroshiSession | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [qty, setQty] = useState("");
  const [stockState, setStockState] = useState<StockState>("良品");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [accum, setAccum] = useState(0); // 当該品目の既登録累計（このセッションのqueue内）
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "add" | "err" | "warn"; text: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [lastEntry, setLastEntry] = useState<{ entryId: string; code: string; qty: number } | null>(null);

  const showToast = (kind: "ok" | "add" | "err" | "warn", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 1800);
  };

  const refreshPending = useCallback(async () => {
    setPending((await loadQueue()).length);
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
      const prior = accumRef.current.get(code) || 0; // 送信済み＋未送信の累計

      // 2回目以降は差分リスト掲載品目のみ対象（F-08）。対象外は登録しない
      if (!item && s.round > 1) {
        feedbackWarn();
        showToast("warn", "この品目は今回の対象外です");
        return;
      }

      lockedRef.current = true;
      setAccum(prior);
      if (item) {
        prior > 0 ? feedbackAdd() : feedbackSuccess();
        setCurrent({ item, code, noSystemStock: false });
      } else {
        // システム在庫に無い品目（1回目のみここに来る）→ 品目マスタから品名・規格を照会
        feedbackWarn();
        let resolved: CatalogItem | null = null;
        try {
          const res = await fetch(`/api/tanaoroshi/item?code=${encodeURIComponent(code)}`);
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.item) {
            resolved = { itemCode: code, itemName: j.item.itemName, spec: j.item.spec, unit: j.item.unit, systemQty: 0, inTarget: false };
          }
        } catch {
          /* オフライン等：品名なしで登録可 */
        }
        setCurrent({ item: resolved, code, noSystemStock: true });
      }
      setQty("");
      setStockState("良品"); // 既定は良品（未選択時も良品扱い）
      setReasonCode("");
      setPhotos([]);
    },
    [session]
  );

  const onPickPhoto = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const blobs: Blob[] = [];
    for (const f of Array.from(files)) {
      try {
        blobs.push(await compressImageToLimit(f, 1.5 * 1024 * 1024));
      } catch {
        blobs.push(f);
      }
    }
    setPhotos((p) => [...p, ...blobs]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

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

      // 累計マップ初期化（送信済み＝サーバ ＋ 未送信＝端末queue）
      const map = new Map<string, number>();
      const q = await loadQueue();
      for (const e of q) {
        if (e.warehouseCode === s.warehouseCode && e.round === s.round) {
          map.set(e.itemCode, (map.get(e.itemCode) || 0) + e.qty);
        }
      }
      try {
        const res = await fetch(`/api/tanaoroshi/entries?warehouse=${encodeURIComponent(s.warehouseCode)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success !== false) {
          for (const r of j.entries || []) map.set(r.itemCode, (map.get(r.itemCode) || 0) + (r.qty || 0));
        }
      } catch {
        /* オフライン時は端末分のみ */
      }
      accumRef.current = map;

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
    setPhotos([]);
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
      itemName: current.item ? [current.item.itemName, current.item.spec].filter(Boolean).join(" ") : "",
      qty: n,
      stockState,
      inputMethod: manual ? "手入力" : "読取",
      round: s.round,
      reasonCode: reasonCode || undefined,
      noSystemStock: current.noSystemStock,
      inputBy: user?.name || "",
      inputByEmail: user?.email || "",
      inputAt: Date.now(),
      deviceId: s.deviceId,
      photos: photos.length ? photos : undefined,
    };
    await enqueue(draft);
    accumRef.current.set(current.code, (accumRef.current.get(current.code) || 0) + n); // 累計に反映
    setLastEntry({ entryId: draft.entryId, code: current.code, qty: n });
    await refreshPending();
    showToast(current.noSystemStock ? "warn" : "ok", `${current.code} を ${n} 登録`);
    // バックグラウンド送信（オンライン時）
    flushQueue().then((r) => setPending(r.remaining)).catch(() => {});
    // 次へ
    setCurrent(null);
    setQty("");
    setPhotos([]);
    setManual(false);
    lockedRef.current = false;
  };

  const undoLast = async () => {
    if (!lastEntry) return;
    try {
      await cancelEntry(lastEntry.entryId);
      const cur = accumRef.current.get(lastEntry.code) || 0;
      accumRef.current.set(lastEntry.code, Math.max(0, cur - lastEntry.qty)); // 累計から戻す
      await refreshPending();
      showToast("warn", `${lastEntry.code} の登録を取り消しました`);
      setLastEntry(null);
    } catch (e: any) {
      showToast("err", e?.message || "取消に失敗しました");
    }
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
    // 未報告品目の確認（F-05: 報告なし＝実棚0で差分になるため作業中に解消を促す）
    if (session) {
      try {
        const reported = new Set<string>();
        const queue = await loadQueue();
        for (const e of queue) if (e.warehouseCode === session.warehouseCode && e.round === session.round) reported.add(e.itemCode);
        const res = await fetch(`/api/tanaoroshi/reported?warehouse=${encodeURIComponent(session.warehouseCode)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success !== false) for (const c of j.reportedItemCodes || []) reported.add(c);
        const remaining = [...catalogRef.current.keys()].filter((code) => !reported.has(code)).length;
        if (remaining > 0) {
          const ok = window.confirm(
            `未報告の品目が ${remaining} 件あります（報告なしは実棚0として差分になります）。\n未報告リストを確認しますか？\n\n［OK］確認する ／ ［キャンセル］このまま終了`
          );
          if (ok) {
            router.push("/tanaoroshi/remaining");
            return;
          }
        }
      } catch {
        /* 確認に失敗しても終了はできる */
      }
    }
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
      <div className="relative flex-none bg-black" style={{ height: "clamp(120px, 24vh, 200px)" }}>
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-gray-900 p-2">
        {/* 品目カード */}
        <div className="min-h-[56px] flex-none rounded-xl bg-gray-800 p-2.5">
          {current ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-white">{current.code}</span>
                {accum > 0 && <span className="text-sm text-blue-300">既登録累計 {accum}</span>}
              </div>
              {current.noSystemStock ? (
                <div className="leading-tight">
                  <div className="text-xs text-amber-300">システム在庫にない品目（差分として登録）</div>
                  {current.item?.itemName ? (
                    <>
                      <div className="line-clamp-2 text-sm text-gray-100">{current.item.itemName}</div>
                      {current.item?.spec && <div className="text-xs text-gray-400">規格: {current.item.spec}</div>}
                      {current.item?.unit && <div className="text-xs text-gray-500">単位: {current.item.unit}</div>}
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">品名情報なし</div>
                  )}
                </div>
              ) : (
                <div className="leading-tight">
                  <div className="line-clamp-2 text-sm text-gray-100">{current.item?.itemName || "—"}</div>
                  {current.item?.spec && <div className="text-xs text-gray-400">規格: {current.item.spec}</div>}
                  {current.item?.unit && <div className="text-xs text-gray-500">単位: {current.item.unit}</div>}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              バーコードをかざしてください
            </div>
          )}
        </div>

        {/* 差分理由コード（2回目以降のみ） */}
        {current && (session?.round || 1) > 1 && session?.reasons?.length ? (
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="flex-none rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">差分理由を選択（任意）</option>
            {session.reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        ) : null}

        {/* 在庫状態フラグ（入力中のみ。既定=良品） */}
        {current && (
          <div className="flex flex-none gap-1">
            {(["良品", "不良品", "滞留"] as StockState[]).map((s) => (
              <button
                key={s}
                onClick={() => setStockState(s)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${
                  stockState === s
                    ? s === "良品"
                      ? "bg-green-600 text-white"
                      : "bg-amber-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 数量表示 */}
        <div className="flex flex-none items-center justify-between rounded-xl bg-gray-800 px-4 py-1.5">
          <span className="text-xs text-gray-400">数量</span>
          <span className="text-3xl font-bold tabular-nums text-white">{qty || "0"}</span>
        </div>

        {/* テンキー（残り高さを埋める。小画面でも下のボタンが隠れない） */}
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => pushDigit(d)}
              disabled={!current}
              className="rounded-xl bg-gray-700 flex h-full items-center justify-center text-2xl font-semibold text-white active:bg-gray-600 disabled:opacity-30"
            >
              {d}
            </button>
          ))}
          <button onClick={clearQty} disabled={!current} className="rounded-xl bg-gray-700 flex h-full items-center justify-center text-lg text-gray-300 active:bg-gray-600 disabled:opacity-30">
            C
          </button>
          <button onClick={() => pushDigit("0")} disabled={!current} className="rounded-xl bg-gray-700 flex h-full items-center justify-center text-2xl font-semibold text-white active:bg-gray-600 disabled:opacity-30">
            0
          </button>
          <button onClick={backspace} disabled={!current} className="flex items-center justify-center rounded-xl bg-gray-700 flex h-full items-center justify-center text-white active:bg-gray-600 disabled:opacity-30">
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* アクション（常に画面内に固定表示） */}
        <div className="flex-none pt-0.5">
          {current ? (
            <div className="flex gap-2">
              <button onClick={cancelCurrent} className="flex items-center justify-center rounded-xl bg-gray-700 px-4 py-3 text-white active:bg-gray-600">
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={() => photoInputRef.current?.click()}
                className="relative flex items-center justify-center rounded-xl bg-gray-700 px-4 py-3 text-white active:bg-gray-600"
              >
                <Camera className="h-5 w-5" />
                {photos.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-xs font-bold">
                    {photos.length}
                  </span>
                )}
              </button>
              <button
                onClick={decideNext}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-lg font-bold text-white active:bg-blue-700"
              >
                <Check className="h-5 w-5" />
                決定 次へ
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={undoLast}
                  disabled={!lastEntry}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-700 py-2 text-xs font-medium text-white active:bg-gray-600 disabled:opacity-30"
                >
                  <Undo2 className="h-5 w-5" />
                  直前取消
                </button>
                <button
                  onClick={() => router.push("/tanaoroshi/entries")}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-700 py-2 text-xs font-medium text-white active:bg-gray-600"
                >
                  <ListChecks className="h-5 w-5" />
                  一覧
                </button>
                <button
                  onClick={() => router.push("/tanaoroshi/remaining")}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-700 py-2 text-xs font-medium text-white active:bg-gray-600"
                >
                  <PackageSearch className="h-5 w-5" />
                  未報告
                </button>
                <button
                  onClick={() => {
                    unlockAudio();
                    setManual(true);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-700 py-2 text-xs font-medium text-white active:bg-gray-600"
                >
                  <Keyboard className="h-5 w-5" />
                  手入力
                </button>
              </div>
              {/* 終了して送信（作業完了時） */}
              <button
                onClick={finish}
                disabled={finishing}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-lg font-bold text-white active:bg-green-700 disabled:opacity-60"
              >
                {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {pending > 0 ? `終了して送信（未送信 ${pending}）` : "終了"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 写真入力（カメラ起動） */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => onPickPhoto(e.target.files)}
      />

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
