"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Bell, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MainLayout } from "@/components/layout";

interface WhRow {
  recordId: string;
  warehouseCode: string;
  warehouseName: string;
  notify: string;
}
interface TargetRow {
  recordId: string;
  trigger: string;
  kind: string;
  value: string;
  isActive: boolean;
  note: string;
}

const TRIGGERS = ["共通", "発行", "完了", "締め"] as const;
const KINDS = ["メール", "グループ"] as const;

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`通信エラー (${res.status})`);
  }
  if (!res.ok || j?.success === false) throw new Error(j?.error || `通信エラー (${res.status})`);
  return j;
}

export default function NotifySettingsPage() {
  const [warehouses, setWarehouses] = useState<WhRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingWh, setSavingWh] = useState<string>("");
  const [whEdit, setWhEdit] = useState<Record<string, string>>({});
  const [whFilter, setWhFilter] = useState("");

  // 新規共通通知先
  const [nt, setNt] = useState({ trigger: "共通", kind: "メール", value: "", note: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const j = await api("/api/tanaoroshi/notify-targets");
      setWarehouses(j.warehouses || []);
      setTargets(j.targets || []);
      const init: Record<string, string> = {};
      for (const w of j.warehouses || []) init[w.warehouseCode] = w.notify || "";
      setWhEdit(init);
    } catch (e: any) {
      setErr(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const saveWh = async (code: string) => {
    setSavingWh(code);
    setMsg(null);
    try {
      await api("/api/tanaoroshi/notify-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setWarehouse", warehouseCode: code, notify: whEdit[code] || "" }),
      });
      setMsg(`倉庫 ${code} の通知先を保存しました`);
    } catch (e: any) {
      setErr(e?.message || "保存に失敗しました");
    } finally {
      setSavingWh("");
    }
  };

  const addTarget = async () => {
    if (!nt.value.trim()) {
      setErr("宛先値を入力してください");
      return;
    }
    setAdding(true);
    setMsg(null);
    try {
      await api("/api/tanaoroshi/notify-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsertTarget", ...nt, isActive: true }),
      });
      setNt({ trigger: "共通", kind: "メール", value: "", note: "" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (t: TargetRow) => {
    try {
      await api("/api/tanaoroshi/notify-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsertTarget", recordId: t.recordId, trigger: t.trigger, kind: t.kind, value: t.value, isActive: !t.isActive, note: t.note }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "更新に失敗しました");
    }
  };

  const delTarget = async (t: TargetRow) => {
    if (!window.confirm(`通知先「${t.value}」を削除しますか？`)) return;
    try {
      await api("/api/tanaoroshi/notify-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteTarget", recordId: t.recordId }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "削除に失敗しました");
    }
  };

  const whFiltered = warehouses.filter((w) => `${w.warehouseCode} ${w.warehouseName}`.includes(whFilter));

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-5">
          <a href="/seizou/tanaoroshi" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> ダッシュボードへ
          </a>
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center gap-3">
              <Bell className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold">通知先設定</h1>
                <p className="text-sm text-blue-100">倉庫ごとの管理者（差分発行時）と、共通通知先（完了/締め）</p>
              </div>
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> {err}
            </div>
          )}
          {msg && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {msg}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
            </div>
          ) : (
            <>
              {/* 倉庫別通知先 */}
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-gray-800">倉庫別の通知先（差分発行時）</h2>
                <p className="mb-3 text-sm text-gray-500">その倉庫の管理者メール。複数はカンマ区切り。</p>
                {warehouses.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    倉庫マスタに「通知先」列が無い、または倉庫が登録されていません（テーブル作成後に表示されます）。
                  </div>
                ) : (
                  <>
                    <input
                      value={whFilter}
                      onChange={(e) => setWhFilter(e.target.value)}
                      placeholder="倉庫コード・名称で絞り込み"
                      className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                      {whFiltered.map((w) => (
                        <div key={w.warehouseCode} className="flex items-center gap-2">
                          <div className="w-40 shrink-0 text-sm">
                            <span className="font-mono text-xs text-gray-400">{w.warehouseCode}</span> {w.warehouseName}
                          </div>
                          <input
                            value={whEdit[w.warehouseCode] ?? ""}
                            onChange={(e) => setWhEdit((s) => ({ ...s, [w.warehouseCode]: e.target.value }))}
                            placeholder="email@example.com, ..."
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                          />
                          <button
                            onClick={() => saveWh(w.warehouseCode)}
                            disabled={savingWh === w.warehouseCode}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            {savingWh === w.warehouseCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            保存
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* 共通通知先 */}
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-gray-800">共通通知先（完了・締め）</h2>
                <p className="mb-3 text-sm text-gray-500">生産管理部など。契機ごとに宛先を登録します。</p>

                <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-gray-500">契機</span>
                    <select value={nt.trigger} onChange={(e) => setNt({ ...nt, trigger: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                      {TRIGGERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-gray-500">種別</span>
                    <select value={nt.kind} onChange={(e) => setNt({ ...nt, kind: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-xs text-gray-500">宛先値（メール or グループchat_id）</span>
                    <input value={nt.value} onChange={(e) => setNt({ ...nt, value: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  </label>
                  <button onClick={addTarget} disabled={adding} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    追加
                  </button>
                </div>

                {targets.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">共通通知先はまだありません。</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {targets.map((t) => (
                      <div key={t.recordId} className="flex items-center gap-2 py-2 text-sm">
                        <span className="w-14 rounded-full bg-gray-100 px-2 py-0.5 text-center text-xs text-gray-600">{t.trigger}</span>
                        <span className="w-16 text-xs text-gray-500">{t.kind}</span>
                        <span className="flex-1 truncate">{t.value}</span>
                        <button onClick={() => toggleActive(t)} className={`rounded-full px-2 py-0.5 text-xs ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {t.isActive ? "有効" : "無効"}
                        </button>
                        <button onClick={() => delTarget(t)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
