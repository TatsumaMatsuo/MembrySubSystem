"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Plus, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { MainLayout } from "@/components/layout";

interface PeriodRow {
  recordId: string;
  periodId: string;
  name: string;
  closingDate: number | null;
  status: string;
  createdBy: string;
  createdAt: number | null;
}

const jstDate = (ms: number | null) =>
  ms ? new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "/") : "—";

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
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

export default function PeriodsPage() {
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const j = await api("/api/tanaoroshi/periods");
      setRows(j.periods || []);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      setMsg({ ok: false, text: "棚卸名称を入力してください" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const closingDate = closing ? new Date(`${closing}T00:00:00+09:00`).getTime() : null;
      await api("/api/tanaoroshi/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: name.trim(), closingDate }),
      });
      setMsg({ ok: true, text: `棚卸期「${name.trim()}」を作成し、実施中にしました` });
      setName("");
      setClosing("");
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "作成に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const close = async (r: PeriodRow) => {
    if (!window.confirm(`棚卸期「${r.name}」を締めますか？`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/tanaoroshi/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", recordId: r.recordId }),
      });
      setMsg({ ok: true, text: `「${r.name}」を締めました` });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "締めに失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const hasActive = rows.some((r) => r.status === "実施中");

  const badge = (s: string) => {
    const map: Record<string, string> = {
      実施中: "bg-green-100 text-green-700",
      締め: "bg-gray-200 text-gray-600",
      準備中: "bg-amber-100 text-amber-700",
    };
    return map[s] || "bg-gray-100 text-gray-600";
  };

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold">棚卸期の管理</h1>
                <p className="text-sm text-blue-100">棚卸イベントの作成・締め。実施中にできるのは1つだけです。</p>
              </div>
            </div>
          </div>

          {/* 作成 */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Plus className="h-5 w-5 text-blue-600" />
              棚卸期を作成
            </h2>
            {hasActive && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                実施中の棚卸期があります。新規作成するには先に締めてください。
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">棚卸名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例）2026年下期 棚卸"
                  disabled={busy || hasActive}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">基準締日（システム在庫のスナップショット日）</label>
                <input
                  type="date"
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                  disabled={busy || hasActive}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
                />
              </div>
              <button
                onClick={create}
                disabled={busy || hasActive || !name.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                作成して実施中にする
              </button>
            </div>
          </section>

          {msg && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* 一覧 */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">棚卸期の一覧</h2>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">棚卸期がまだありません。</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <div key={r.recordId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-800">{r.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}>{r.status}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {r.periodId} ・ 基準締日 {jstDate(r.closingDate)}
                      </div>
                    </div>
                    {r.status === "実施中" && (
                      <button
                        onClick={() => close(r)}
                        disabled={busy}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        締める
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
