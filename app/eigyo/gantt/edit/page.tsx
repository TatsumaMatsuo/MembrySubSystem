"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { GanttChart } from "@/components/features/eigyo/GanttChart";
import { fetchJson } from "@/lib/fetch-json";
import { ArrowLeft, Plus, Save, Copy, Trash2, ChevronUp, ChevronDown, Loader2, LayoutTemplate, X, Printer, Link2 } from "lucide-react";
import { GANTT_PALETTE, type GanttTaskData, type GanttUnit, type GanttChartFull, type GanttTemplateMeta, type GanttTemplateFull } from "@/lib/gantt/types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// YYYY-MM-DD をローカル日付として扱い、日数を加減算する
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function diffDays(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, (am || 1) - 1, ad || 1).getTime();
  const b = new Date(by, (bm || 1) - 1, bd || 1).getTime();
  return Math.round((b - a) / 86400000);
}
function newId(): string {
  try {
    return `t-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
}
const UNITS: { key: GanttUnit; label: string }[] = [
  { key: "day", label: "日" },
  { key: "week", label: "週" },
  { key: "month", label: "月" },
];

export default function GanttEditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">読み込み中...</div>}>
      <GanttEditInner />
    </Suspense>
  );
}

function GanttEditInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id") || "";

  const [id, setId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [seiban, setSeiban] = useState("");
  const [unit, setUnit] = useState<GanttUnit>("day");
  const [tasks, setTasks] = useState<GanttTaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<null | "save" | "saveas">(null);

  // ひな形連携
  const [tplModal, setTplModal] = useState(false);
  const [tplList, setTplList] = useState<GanttTemplateMeta[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSel, setTplSel] = useState<string>("");
  const [tplBaseDate, setTplBaseDate] = useState<string>(todayStr());
  const [tplMode, setTplMode] = useState<"replace" | "append">("replace");
  const [tplApplying, setTplApplying] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  // 先行(依存)選択ポップオーバーを開いているタスク
  const [predOpen, setPredOpen] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      if (!cid) {
        // 新規
        setId("");
        setTitle("");
        setSeiban("");
        setUnit("day");
        setTasks([]);
        return;
      }
      const res = await fetch(`/api/eigyo/gantt/charts/${encodeURIComponent(cid)}`).then((r) => r.json());
      if (res.success && res.chart) {
        const c: GanttChartFull = res.chart;
        setId(c.id);
        setTitle(c.title || "");
        setSeiban(c.seiban || "");
        setUnit(c.data?.unit || "day");
        setTasks(Array.isArray(c.data?.tasks) ? c.data.tasks : []);
      } else {
        window.alert(res.error || "チャートの取得に失敗しました");
        router.push("/eigyo/gantt");
      }
    } catch {
      window.alert("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load(idParam);
  }, [idParam, load]);

  // ---- タスク操作 ----
  const addTask = () => {
    const t = todayStr();
    setTasks((prev) => [...prev, { id: newId(), name: "", start: t, end: t, assignee: "", notes: "" }]);
  };
  const patchTask = (tid: string, patch: Partial<GanttTaskData>) =>
    setTasks((prev) => prev.map((t) => (t.id === tid ? { ...t, ...patch } : t)));
  // タスク削除時は他タスクの先行(依存)からも取り除く
  const removeTask = (tid: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== tid).map((t) => (t.pred?.includes(tid) ? { ...t, pred: t.pred.filter((p) => p !== tid) } : t)));
  const togglePred = (tid: string, predId: string) =>
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== tid) return t;
        const cur = t.pred || [];
        return { ...t, pred: cur.includes(predId) ? cur.filter((p) => p !== predId) : [...cur, predId] };
      })
    );
  const moveTask = (tid: string, dir: -1 | 1) =>
    setTasks((prev) => {
      const i = prev.findIndex((t) => t.id === tid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  // ガントのバーD&Dで日付変更
  const onBarDateChange = (tid: string, start: string, end: string) => patchTask(tid, { start, end });

  const save = async (asNew: boolean) => {
    if (saving) return;
    if (!title.trim()) {
      window.alert("題名を入力してください");
      return;
    }
    if (tasks.length === 0) {
      window.alert("タスクを1件以上追加してください");
      return;
    }
    // 日付の整合(終了<開始なら終了=開始)
    const cleaned = tasks.map((t) => ({ ...t, end: t.end && t.end >= t.start ? t.end : t.start }));
    setSaving(asNew ? "saveas" : "save");
    try {
      const res = await fetch("/api/eigyo/gantt/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asNew ? undefined : id || undefined,
          title: title.trim(),
          seiban: seiban.trim(),
          data: { unit, tasks: cleaned },
        }),
      }).then((r) => r.json());
      if (res.success && res.id) {
        setId(res.id);
        window.alert("保存しました");
        // URLを保存後のIDに合わせる(別名保存/新規保存時)
        if (res.id !== idParam) router.replace(`/eigyo/gantt/edit?id=${encodeURIComponent(res.id)}`);
      } else {
        window.alert(res.error || "保存に失敗しました");
      }
    } catch {
      window.alert("保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  // ---- ひな形連携 ----
  const openTplModal = async () => {
    setTplMode(tasks.length ? "append" : "replace");
    setTplModal(true);
    setTplLoading(true);
    try {
      const res = await fetchJson<{ success: boolean; templates?: GanttTemplateMeta[]; error?: string }>(
        "/api/eigyo/gantt/templates"
      );
      if (res.success) {
        setTplList(res.templates || []);
        if (!tplSel && res.templates?.[0]) setTplSel(res.templates[0].id);
      } else window.alert(res.error || "ひな形一覧の取得に失敗しました");
    } catch (e: any) {
      window.alert(e?.message || "通信に失敗しました");
    } finally {
      setTplLoading(false);
    }
  };

  const applyTemplate = async () => {
    if (!tplSel) {
      window.alert("ひな形を選択してください");
      return;
    }
    if (!tplBaseDate) {
      window.alert("基準日を入力してください");
      return;
    }
    setTplApplying(true);
    try {
      const res = await fetchJson<{ success: boolean; template?: GanttTemplateFull; error?: string }>(
        `/api/eigyo/gantt/templates/${encodeURIComponent(tplSel)}`
      );
      if (!res.success || !res.template) {
        window.alert(res.error || "ひな形の取得に失敗しました");
        return;
      }
      const steps = res.template.data?.steps || [];
      const generated: GanttTaskData[] = steps.map((s) => {
        const start = addDays(tplBaseDate, Math.max(0, Number(s.offset) || 0));
        const end = addDays(start, Math.max(1, Number(s.days) || 1) - 1);
        return { id: newId(), name: s.name, start, end, assignee: "", progress: 0, notes: s.notes || "" };
      });
      setTasks((prev) => (tplMode === "append" ? [...prev, ...generated] : generated));
      if (tplMode === "replace" && !title.trim()) setTitle(res.template.name || "");
      setTplModal(false);
    } catch (e: any) {
      window.alert(e?.message || "通信に失敗しました");
    } finally {
      setTplApplying(false);
    }
  };

  const saveAsTemplate = async () => {
    if (savingTpl) return;
    const usable = tasks.filter((t) => t.name.trim() && t.start);
    if (usable.length === 0) {
      window.alert("工程名と開始日のあるタスクがありません");
      return;
    }
    const defName = title.trim() ? `${title.trim()}（ひな形）` : "";
    const name = window.prompt("ひな形名を入力してください", defName);
    if (name == null) return;
    if (!name.trim()) {
      window.alert("ひな形名を入力してください");
      return;
    }
    const category = window.prompt("分類（任意・空欄可）", "") || "";
    // 基準日 = 最も早い開始日。各工程 offset/days をそこからの相対で算出。
    const base = usable.reduce((min, t) => (t.start < min ? t.start : min), usable[0].start);
    const steps = usable.map((t) => {
      const end = t.end && t.end >= t.start ? t.end : t.start;
      return {
        name: t.name.trim(),
        offset: Math.max(0, diffDays(base, t.start)),
        days: Math.max(1, diffDays(t.start, end) + 1),
        notes: (t.notes || "").trim() || undefined,
      };
    });
    setSavingTpl(true);
    try {
      const res = await fetchJson<{ success: boolean; id?: string; error?: string }>("/api/eigyo/gantt/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), active: true, data: { steps } }),
      });
      if (res.success) window.alert("ひな形として保存しました");
      else window.alert(res.error || "ひな形の保存に失敗しました");
    } catch (e: any) {
      window.alert(e?.message || "ひな形の保存に失敗しました");
    } finally {
      setSavingTpl(false);
    }
  };

  // ---- PDF印刷 ----
  const onPrint = () => {
    if (tasks.length === 0) {
      window.alert("印刷するタスクがありません");
      return;
    }
    // ガントは横長のためA4横向きで印刷（@pageはJS側で動的挿入する既存方式に合わせる）
    const style = document.createElement("style");
    style.id = "gantt-print-page";
    style.textContent = "@page { size: A4 landscape; margin: 8mm; }";
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById("gantt-print-page")?.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // afterprintが発火しない環境向けフォールバック
    window.setTimeout(cleanup, 1500);
  };

  // 先行タスクの表示名（工程名 or 連番）
  const taskLabel = (t: GanttTaskData, idx: number) => (t.name.trim() ? t.name.trim() : `工程${idx + 1}`);

  const taskCount = tasks.length;
  const chart = useMemo(() => <GanttChart tasks={tasks} unit={unit} onDateChange={onBarDateChange} />, [tasks, unit]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gray-50 overflow-auto">
        {/* ツールバー */}
        <div className="no-print flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => router.push("/eigyo/gantt")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> 一覧
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="題名（必須）"
              className="min-w-[180px] flex-1 max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={seiban}
              onChange={(e) => setSeiban(e.target.value)}
              placeholder="売約番号（任意）"
              className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {/* 表示単位 */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {UNITS.map((u) => (
                <button
                  key={u.key}
                  onClick={() => setUnit(u.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${unit === u.key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={openTplModal} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" title="ひな形と基準日から工程を生成">
              <LayoutTemplate className="w-4 h-4" /> ひな形から生成
            </button>
            <button onClick={saveAsTemplate} disabled={savingTpl} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" title="現在の工程をひな形として保存">
              {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ひな形化
            </button>
            <button onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" title="PDF印刷（ブラウザの印刷ダイアログでPDF保存）">
              <Printer className="w-4 h-4" /> PDF印刷
            </button>
            <button onClick={() => save(false)} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
            </button>
            <button onClick={() => save(true)} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
              {saving === "saveas" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} 別名保存
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-3">読み込み中...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col xl:flex-row gap-3 p-3 min-h-0">
            {/* 左: タスクグリッド */}
            <div className="no-print xl:w-[46%] flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">タスク（{taskCount}）</span>
                <button onClick={addTask} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                  <Plus className="w-3.5 h-3.5" /> 追加
                </button>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium w-8"></th>
                      <th className="px-2 py-1.5 text-left font-medium">工程名</th>
                      <th className="px-2 py-1.5 text-left font-medium">開始</th>
                      <th className="px-2 py-1.5 text-left font-medium">終了</th>
                      <th className="px-2 py-1.5 text-left font-medium">担当</th>
                      <th className="px-2 py-1.5 text-center font-medium w-10">色</th>
                      <th className="px-2 py-1.5 text-left font-medium w-14">先行</th>
                      <th className="px-2 py-1.5 text-left font-medium">メモ</th>
                      <th className="px-2 py-1.5 text-left font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((t, i) => {
                      const effColor = t.color || GANTT_PALETTE[i % GANTT_PALETTE.length];
                      const preds = t.pred || [];
                      return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-1 py-1 text-center text-gray-400">{i + 1}</td>
                        <td className="px-1 py-1">
                          <input value={t.name} onChange={(e) => patchTask(t.id, { name: e.target.value })} className="w-full min-w-[100px] rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" placeholder="工程名" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="date" value={t.start} onChange={(e) => patchTask(t.id, { start: e.target.value })} className="rounded border border-gray-200 px-1 py-1 focus:border-indigo-400 focus:outline-none" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="date" value={t.end} onChange={(e) => patchTask(t.id, { end: e.target.value })} className="rounded border border-gray-200 px-1 py-1 focus:border-indigo-400 focus:outline-none" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={t.assignee || ""} onChange={(e) => patchTask(t.id, { assignee: e.target.value })} className="w-full min-w-[70px] rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" placeholder="担当" />
                        </td>
                        {/* 色 */}
                        <td className="px-1 py-1 text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center" title="バーの色を変更">
                            <span className="inline-block h-5 w-5 rounded border border-gray-300" style={{ backgroundColor: effColor }} />
                            <input type="color" value={effColor} onChange={(e) => patchTask(t.id, { color: e.target.value })} className="sr-only" />
                          </label>
                        </td>
                        {/* 先行(依存) */}
                        <td className="px-1 py-1">
                          <div className="relative">
                            <button
                              onClick={() => setPredOpen(predOpen === t.id ? null : t.id)}
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 ${preds.length ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"} hover:bg-indigo-50`}
                              title="先行タスク（依存線）を選択"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              {preds.length > 0 && <span className="text-[11px] font-semibold">{preds.length}</span>}
                            </button>
                            {predOpen === t.id && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setPredOpen(null)} />
                                <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-52 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
                                  <div className="px-1 pb-1 text-[11px] font-semibold text-gray-400">先行タスク</div>
                                  {tasks.filter((o) => o.id !== t.id).length === 0 ? (
                                    <div className="px-1 py-2 text-[11px] text-gray-400">他のタスクがありません</div>
                                  ) : (
                                    tasks.map((o, oi) =>
                                      o.id === t.id ? null : (
                                        <label key={o.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-[12px] hover:bg-gray-50">
                                          <input type="checkbox" checked={preds.includes(o.id)} onChange={() => togglePred(t.id, o.id)} />
                                          <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: o.color || GANTT_PALETTE[oi % GANTT_PALETTE.length] }} />
                                          <span className="truncate">{taskLabel(o, oi)}</span>
                                        </label>
                                      )
                                    )
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        {/* メモ */}
                        <td className="px-1 py-1">
                          <input value={t.notes || ""} onChange={(e) => patchTask(t.id, { notes: e.target.value })} className="w-full min-w-[120px] rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" placeholder="メモ" />
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveTask(t.id, -1)} disabled={i === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="上へ"><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveTask(t.id, 1)} disabled={i === tasks.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="下へ"><ChevronDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeTask(t.id)} className="p-0.5 text-red-400 hover:text-red-600" title="削除"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-gray-400">「追加」からタスクを作成してください。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 右: ガントチャート（印刷対象） */}
            <div className="gantt-print-root xl:flex-1 rounded-xl border border-gray-200 bg-white shadow-sm p-2 min-h-0 overflow-auto">
              {/* 印刷時のみ表示する見出し */}
              <div className="mb-2 hidden print:block">
                <h2 className="text-base font-bold text-gray-900">{title || "(無題)"}</h2>
                <div className="text-xs text-gray-600">
                  {seiban ? `売約番号: ${seiban}　` : ""}
                  {(() => {
                    const d = new Date();
                    return `作成日: ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                  })()}
                </div>
              </div>
              {chart}
            </div>
          </div>
        )}

        {/* ひな形から生成モーダル */}
        {tplModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !tplApplying && setTplModal(false)}>
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
                  <LayoutTemplate className="w-5 h-5 text-indigo-600" /> ひな形から生成
                </h2>
                <button onClick={() => setTplModal(false)} disabled={tplApplying} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 px-4 py-4">
                {tplLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : tplList.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-400">
                    有効なひな形がありません。
                    <button onClick={() => router.push("/eigyo/gantt/templates")} className="ml-1 text-indigo-600 hover:underline">
                      ひな形を作成
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-gray-600">ひな形</span>
                      <select value={tplSel} onChange={(e) => setTplSel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                        {tplList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.category ? `[${t.category}] ` : ""}{t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-gray-600">基準日（着工日など）</span>
                      <input type="date" value={tplBaseDate} onChange={(e) => setTplBaseDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                      <span className="mt-1 block text-[11px] text-gray-400">各工程の「開始(日後)」をこの日から加算して生成します。</span>
                    </label>
                    {tasks.length > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-xs font-semibold text-gray-600">既存タスク:</span>
                        <label className="inline-flex items-center gap-1"><input type="radio" checked={tplMode === "replace"} onChange={() => setTplMode("replace")} /> 置き換え</label>
                        <label className="inline-flex items-center gap-1"><input type="radio" checked={tplMode === "append"} onChange={() => setTplMode("append")} /> 追加</label>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
                <button onClick={() => setTplModal(false)} disabled={tplApplying} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  キャンセル
                </button>
                <button onClick={applyTemplate} disabled={tplApplying || tplLoading || tplList.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {tplApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 生成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
