"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Warehouse as WarehouseIcon, Loader2, ScanLine, AlertTriangle, Upload, RotateCcw, CheckCircle2 } from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { Warehouse, BootstrapResponse } from "@/lib/tanaoroshi/types";
import {
  saveSession,
  saveCatalog,
  loadSession,
  getOrCreateDeviceId,
  queueCount,
} from "@/lib/tanaoroshi/local-store";
import { flushQueue } from "@/lib/tanaoroshi/sync";

async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`通信エラー (${res.status})`);
  }
  if (!res.ok || json?.success === false) throw new Error(json?.error || `通信エラー (${res.status})`);
  return json;
}

export default function TanaoroshiTopPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [periodName, setPeriodName] = useState<string | null>(null);
  const [noPeriodMsg, setNoPeriodMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string>("");
  const [pending, setPending] = useState(0);
  const [resume, setResume] = useState<{ warehouseName: string; round: number } | null>(null);
  const [flushMsg, setFlushMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [whRes, boot] = await Promise.all([
          getJson<{ warehouses: Warehouse[] }>("/api/tanaoroshi/warehouses"),
          getJson<BootstrapResponse>("/api/tanaoroshi/bootstrap"),
        ]);
        setWarehouses(whRes.warehouses || []);
        if (!boot.period) setNoPeriodMsg(boot.error || "実施中の棚卸期がありません。");
        else setPeriodName(boot.period.name);

        const [sess, cnt] = await Promise.all([loadSession(), queueCount()]);
        setPending(cnt);
        if (sess) setResume({ warehouseName: sess.warehouseName, round: sess.round });
      } catch (e: any) {
        setError(e?.message || "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const start = async (wh: Warehouse) => {
    setStarting(wh.code);
    setError(null);
    try {
      const boot = await getJson<BootstrapResponse>(`/api/tanaoroshi/bootstrap?warehouse=${encodeURIComponent(wh.code)}`);
      if (!boot.period) {
        setError(boot.error || "実施中の棚卸期がありません。");
        setStarting("");
        return;
      }
      const deviceId = await getOrCreateDeviceId();
      await saveCatalog(boot.catalog);
      await saveSession({
        periodId: boot.period.periodId,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        round: boot.warehouse?.round || 1,
        deviceId,
        startedAt: Date.now(),
      });
      router.push("/tanaoroshi/scan");
    } catch (e: any) {
      setError(e?.message || "開始に失敗しました");
      setStarting("");
    }
  };

  const doFlush = async () => {
    setFlushMsg("送信中…");
    const r = await flushQueue();
    setPending(r.remaining);
    setFlushMsg(r.error ? `送信エラー: ${r.error}（残 ${r.remaining}件）` : `送信しました（残 ${r.remaining}件）`);
  };

  const filtered = warehouses.filter((w) => `${w.code} ${w.name}`.toLowerCase().includes(selected.toLowerCase()));

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center gap-3">
              <ScanLine className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold">棚卸入力</h1>
                <p className="text-sm text-blue-100">{periodName ? `実施中: ${periodName}` : "棚卸対象の倉庫を選択"}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
            </div>
          ) : (
            <>
              {noPeriodMsg && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{noPeriodMsg}</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 未送信 */}
              {pending > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-orange-800">
                    <Upload className="h-4 w-4" />
                    未送信のデータが <span className="font-bold">{pending}</span> 件あります
                  </div>
                  <button onClick={doFlush} className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700">
                    送信する
                  </button>
                </div>
              )}
              {flushMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4" /> {flushMsg}
                </div>
              )}

              {/* 再開 */}
              {resume && (
                <button
                  onClick={() => router.push("/tanaoroshi/scan")}
                  className="flex w-full items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-left hover:bg-blue-100"
                >
                  <div className="flex items-center gap-2 text-blue-800">
                    <RotateCcw className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-medium">前回の続きから再開</div>
                      <div className="text-xs">{resume.warehouseName}（{resume.round}回目）</div>
                    </div>
                  </div>
                  <ScanLine className="h-5 w-5 text-blue-600" />
                </button>
              )}

              {/* 倉庫選択 */}
              {periodName && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <WarehouseIcon className="h-4 w-4 text-blue-600" /> 倉庫を選択して開始
                  </label>
                  <input
                    type="text"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    placeholder="倉庫コード・名称で絞り込み"
                    className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  />
                  <div className="max-h-[50vh] space-y-1 overflow-y-auto">
                    {filtered.map((w) => (
                      <button
                        key={w.code}
                        onClick={() => start(w)}
                        disabled={!!starting}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-3 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40"
                      >
                        <span className="text-sm text-gray-800">
                          <span className="font-mono text-gray-400">{w.code}</span> {w.name}
                        </span>
                        {starting === w.code ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        ) : (
                          <ScanLine className="h-4 w-4 text-gray-300" />
                        )}
                      </button>
                    ))}
                    {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-400">該当する倉庫がありません</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
