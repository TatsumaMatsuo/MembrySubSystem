"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Loader2,
  AlertTriangle,
  FileCheck2,
  ChevronRight,
  Database,
  CalendarClock,
  FileDown,
  Bell,
  Send,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { ProgressRow } from "@/lib/tanaoroshi/types";

interface Period {
  recordId: string;
  periodId: string;
  name: string;
  status: string;
}

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

const badge = (s: string) => {
  if (s === "締め") return "bg-gray-200 text-gray-600";
  if (s.includes("確定")) return "bg-blue-100 text-blue-700";
  if (s.includes("実施")) return "bg-green-100 text-green-700";
  if (s === "発行処理中") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-500";
};

export default function DashboardPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async (pid?: string) => {
    setLoading(true);
    setErr(null);
    try {
      const j = await api(`/api/tanaoroshi/progress${pid ? `?period=${encodeURIComponent(pid)}` : ""}`);
      setPeriods(j.periods || []);
      setPeriodId(j.periodId || "");
      setRows(j.rows || []);
      setSel(new Set());
    } catch (e: any) {
      setErr(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const issuable = useMemo(() => rows.filter((r) => r.status !== "締め" && r.status !== "発行処理中"), [rows]);

  const toggle = (code: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  const toggleAll = () =>
    setSel((s) => (s.size === issuable.length ? new Set() : new Set(issuable.map((r) => r.warehouseCode))));

  const issue = async () => {
    if (sel.size === 0) return;
    if (
      !window.confirm(
        `選択した ${sel.size} 倉庫の差分リストを発行します。\n発行すると棚卸回数が確定します（差分があれば次回、なければ締め）。\nよろしいですか？`
      )
    )
      return;
    setIssuing(true);
    setMsg(null);
    try {
      const j = await api("/api/tanaoroshi/diff/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: periodId, warehouses: [...sel] }),
      });
      const results = j.results || [];
      const closed = results.filter((r: any) => r.status === "締め").length;
      const totalDiff = results.reduce((s: number, r: any) => s + (r.diffCount || 0), 0);
      setMsg({ ok: true, text: `発行しました（差分 ${totalDiff}件、締め ${closed}倉庫）` });
      await load(periodId);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "発行に失敗しました" });
    } finally {
      setIssuing(false);
    }
  };

  const totalTarget = rows.reduce((s, r) => s + r.targetItems, 0);
  const totalReported = rows.reduce((s, r) => s + r.reportedItems, 0);

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-7 w-7" />
                <div>
                  <h1 className="text-xl font-bold">棚卸 進捗ダッシュボード</h1>
                  <p className="text-sm text-blue-100">倉庫別の進捗確認・差分リスト発行（生産管理部）</p>
                </div>
              </div>
            </div>
          </div>

          {/* ナビ */}
          <div className="flex flex-wrap gap-2">
            <a href="/seizou/tanaoroshi/periods" className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <CalendarClock className="h-4 w-4" /> 棚卸期
            </a>
            <a href="/seizou/tanaoroshi/data" className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <Database className="h-4 w-4" /> データ管理
            </a>
            <a href={`/seizou/tanaoroshi/export?period=${encodeURIComponent(periodId)}`} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <FileDown className="h-4 w-4" /> 基幹出力
            </a>
            <a href="/seizou/tanaoroshi/notify-settings" className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <Bell className="h-4 w-4" /> 通知先設定
            </a>
            <a href="/seizou/tanaoroshi/notify-log" className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <Send className="h-4 w-4" /> 送信状況
            </a>
          </div>

          {/* 期選択 */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <span className="text-sm text-gray-500">棚卸期</span>
            <select
              value={periodId}
              onChange={(e) => load(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            >
              {periods.map((p) => (
                <option key={p.periodId} value={p.periodId}>
                  {p.name}（{p.status}）
                </option>
              ))}
            </select>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> {err}
            </div>
          )}
          {msg && (
            <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
          )}

          {/* サマリ */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="対象倉庫" value={`${rows.length}`} />
              <Stat label="報告済 / 対象品目" value={`${totalReported.toLocaleString()} / ${totalTarget.toLocaleString()}`} />
              <Stat label="締め倉庫" value={`${rows.filter((r) => r.status === "締め").length}`} />
            </div>
          )}

          {/* 発行バー */}
          {issuable.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
              <label className="flex items-center gap-2 text-sm text-blue-800">
                <input type="checkbox" checked={sel.size === issuable.length && sel.size > 0} onChange={toggleAll} />
                発行対象を選択（{sel.size} / {issuable.length}）
              </label>
              <button
                onClick={issue}
                disabled={sel.size === 0 || issuing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                差分リスト発行
              </button>
            </div>
          )}

          {/* 一覧 */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">倉庫データがありません</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const canIssue = r.status !== "締め" && r.status !== "発行処理中";
                  const pct = r.targetItems ? Math.min(100, Math.round((r.reportedItems / r.targetItems) * 100)) : 0;
                  return (
                    <div key={r.warehouseCode} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={sel.has(r.warehouseCode)}
                        onChange={() => toggle(r.warehouseCode)}
                        disabled={!canIssue}
                        className="disabled:opacity-30"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-400">{r.warehouseCode}</span>
                          <span className="truncate text-sm font-medium text-gray-800">{r.warehouseName}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge(r.status)}`}>
                            {r.status}（{r.round}回目）
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">
                            報告 {r.reportedItems}/{r.targetItems}
                            {r.diffCount > 0 && <span className="ml-2 text-orange-600">差分 {r.diffCount}</span>}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          router.push(
                            `/seizou/tanaoroshi/diff?period=${encodeURIComponent(periodId)}&warehouse=${encodeURIComponent(r.warehouseCode)}`
                          )
                        }
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        差分 <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
