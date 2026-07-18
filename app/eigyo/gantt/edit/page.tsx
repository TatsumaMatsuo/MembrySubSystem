"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { GanttChart } from "@/components/features/eigyo/GanttChart";
import { ArrowLeft, Plus, Save, Copy, Trash2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import type { GanttTaskData, GanttUnit, GanttChartFull } from "@/lib/gantt/types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    setTasks((prev) => [...prev, { id: newId(), name: "", start: t, end: t, assignee: "", progress: 0, notes: "" }]);
  };
  const patchTask = (tid: string, patch: Partial<GanttTaskData>) =>
    setTasks((prev) => prev.map((t) => (t.id === tid ? { ...t, ...patch } : t)));
  const removeTask = (tid: string) => setTasks((prev) => prev.filter((t) => t.id !== tid));
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

  const taskCount = tasks.length;
  const chart = useMemo(() => <GanttChart tasks={tasks} unit={unit} onDateChange={onBarDateChange} />, [tasks, unit]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gray-50 overflow-auto">
        {/* ツールバー */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
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
            <div className="xl:w-[46%] flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">タスク（{taskCount}）</span>
                <button onClick={addTask} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                  <Plus className="w-3.5 h-3.5" /> 追加
                </button>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium w-8"></th>
                      <th className="px-2 py-1.5 text-left font-medium">工程名</th>
                      <th className="px-2 py-1.5 text-left font-medium">開始</th>
                      <th className="px-2 py-1.5 text-left font-medium">終了</th>
                      <th className="px-2 py-1.5 text-left font-medium">担当</th>
                      <th className="px-2 py-1.5 text-left font-medium w-16">進捗%</th>
                      <th className="px-2 py-1.5 text-left font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((t, i) => (
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
                        <td className="px-1 py-1">
                          <input type="number" min={0} max={100} value={t.progress ?? 0} onChange={(e) => patchTask(t.id, { progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="w-14 rounded border border-gray-200 px-1 py-1 focus:border-indigo-400 focus:outline-none" />
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveTask(t.id, -1)} disabled={i === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="上へ"><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveTask(t.id, 1)} disabled={i === tasks.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="下へ"><ChevronDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeTask(t.id)} className="p-0.5 text-red-400 hover:text-red-600" title="削除"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400">「追加」からタスクを作成してください。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 右: ガントチャート */}
            <div className="xl:flex-1 rounded-xl border border-gray-200 bg-white shadow-sm p-2 min-h-0 overflow-auto">
              {chart}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
