"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { LayoutTemplate, ArrowLeft, Plus, Save, Copy, Trash2, ChevronUp, ChevronDown, Loader2, RefreshCw, FilePlus } from "lucide-react";
import type { GanttTemplateMeta, GanttTemplateFull, GanttTemplateStep } from "@/lib/gantt/types";

const EMPTY_STEP = (): GanttTemplateStep => ({ name: "", days: 1, offset: 0, notes: "" });

export default function GanttTemplatesPage() {
  const router = useRouter();
  const [list, setList] = useState<GanttTemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // 編集中フォーム
  const [selId, setSelId] = useState<string | null>(null); // null=未選択, ""=新規
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true); // 全体公開(ON=全員/OFF=自分のみ)
  const [notes, setNotes] = useState("");
  const [steps, setSteps] = useState<GanttTemplateStep[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState<null | "save" | "saveas">(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetchJson<{ success: boolean; templates?: GanttTemplateMeta[]; error?: string }>(
        `/api/eigyo/gantt/templates?all=1`
      );
      if (res.success) setList(res.templates || []);
      else setListError(res.error || "一覧の取得に失敗しました");
    } catch (e: any) {
      setListError(e?.message || "通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const resetForm = (empty: boolean) => {
    setSelId(empty ? "" : null);
    setName("");
    setCategory("");
    setActive(true);
    setIsPublic(true);
    setNotes("");
    setSteps(empty ? [EMPTY_STEP()] : []);
  };

  const openNew = () => resetForm(true);

  const openTemplate = useCallback(async (id: string) => {
    setLoadingForm(true);
    setSelId(id);
    try {
      const res = await fetchJson<{ success: boolean; template?: GanttTemplateFull; error?: string }>(
        `/api/eigyo/gantt/templates/${encodeURIComponent(id)}`
      );
      if (res.success && res.template) {
        const t = res.template;
        setName(t.name || "");
        setCategory(t.category || "");
        setActive(t.active !== false);
        setIsPublic(t.isPublic !== false);
        setNotes(t.data?.notes || "");
        setSteps(Array.isArray(t.data?.steps) && t.data.steps.length ? t.data.steps : [EMPTY_STEP()]);
      } else {
        window.alert(res.error || "ひな型の取得に失敗しました");
        setSelId(null);
      }
    } catch (e: any) {
      window.alert(e?.message || "通信に失敗しました");
      setSelId(null);
    } finally {
      setLoadingForm(false);
    }
  }, []);

  // ---- ステップ操作 ----
  const addStep = () => setSteps((prev) => [...prev, EMPTY_STEP()]);
  const patchStep = (i: number, patch: Partial<GanttTemplateStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async (asNew: boolean) => {
    if (saving) return;
    if (!name.trim()) {
      window.alert("ひな型名を入力してください");
      return;
    }
    const cleaned = steps
      .map((s) => ({
        name: s.name.trim(),
        days: Math.max(1, Math.floor(Number(s.days) || 1)),
        offset: Math.max(0, Math.floor(Number(s.offset) || 0)),
        notes: (s.notes || "").trim() || undefined,
      }))
      .filter((s) => s.name);
    if (cleaned.length === 0) {
      window.alert("工程を1件以上入力してください");
      return;
    }
    setSaving(asNew ? "saveas" : "save");
    try {
      const res = await fetchJson<{ success: boolean; id?: string; error?: string }>("/api/eigyo/gantt/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asNew ? undefined : selId || undefined,
          name: name.trim(),
          category: category.trim(),
          active,
          isPublic,
          data: { notes: notes.trim(), steps: cleaned },
        }),
      });
      if (res.success && res.id) {
        window.alert("保存しました");
        setSelId(res.id);
        await loadList();
      } else {
        window.alert(res.error || "保存に失敗しました");
      }
    } catch (e: any) {
      window.alert(e?.message || "保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  const onDelete = async () => {
    if (!selId) return;
    if (!window.confirm(`ひな型「${name || "(無題)"}」を削除します。よろしいですか？`)) return;
    setDeleting(true);
    try {
      const res = await fetchJson<{ success: boolean; error?: string }>(
        `/api/eigyo/gantt/templates?id=${encodeURIComponent(selId)}`,
        { method: "DELETE" }
      );
      if (res.success) {
        resetForm(false);
        await loadList();
      } else {
        window.alert(res.error || "削除に失敗しました");
      }
    } catch (e: any) {
      window.alert(e?.message || "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const visibleList = useMemo(() => list.filter((t) => showInactive || t.active), [list, showInactive]);
  const grouped = useMemo(() => {
    const map = new Map<string, GanttTemplateMeta[]>();
    for (const t of visibleList) {
      const key = t.category || "（未分類）";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [visibleList]);

  const editing = selId !== null;
  const totalDuration = useMemo(() => {
    // 基準日からの最終日オフセット（見込み日数）
    let max = 0;
    for (const s of steps) {
      const end = (Number(s.offset) || 0) + Math.max(1, Number(s.days) || 1);
      if (end > max) max = end;
    }
    return max;
  }, [steps]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => router.push("/eigyo/gantt")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <ArrowLeft className="w-4 h-4" /> ガント一覧
              </button>
              <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2 text-gray-800">
                <LayoutTemplate className="w-6 h-6 text-indigo-600" /> 工程ひな型マスタ
              </h1>
            </div>
            <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> 新規ひな型
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-auto">
          {/* 左: ひな型一覧 */}
          <div className="lg:w-80 flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">ひな型一覧</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> 無効も表示
                </label>
                <button onClick={loadList} className="p-1 text-gray-500 hover:text-gray-800" title="再取得">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
              ) : listError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{listError}</div>
              ) : visibleList.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-gray-400">ひな型はありません。</div>
              ) : (
                <div className="space-y-3">
                  {grouped.map(([cat, items]) => (
                    <div key={cat}>
                      <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{cat}</div>
                      <div className="space-y-1">
                        {items.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => openTemplate(t.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                              selId === t.id ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="flex-1 font-medium truncate">{t.name || "(無題)"}</span>
                              {t.isPublic === false ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">自分のみ</span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">公開</span>
                              )}
                              {!t.active && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">無効</span>}
                            </div>
                            {t.isPublic !== false && !t.mine && t.ownerName && (
                              <div className="mt-0.5 text-[10px] text-gray-400">作成: {t.ownerName}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右: エディタ */}
          <div className="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm min-h-0">
            {!editing ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-gray-400">
                <FilePlus className="w-10 h-10 text-gray-300" />
                <div className="text-sm">左からひな型を選択、または「新規ひな型」で作成してください。</div>
              </div>
            ) : loadingForm ? (
              <div className="flex flex-1 items-center justify-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="flex flex-1 flex-col min-h-0">
                {/* フォームヘッダー */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ひな型名（必須）"
                      className="min-w-[180px] flex-1 max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="分類（任意）"
                      className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> 有効
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-sm text-gray-600" title="ONで全員が利用可能／OFFで自分だけ">
                      <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> 全体公開
                    </label>
                    <div className="flex-1" />
                    <button onClick={() => save(false)} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      {saving === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
                    </button>
                    <button onClick={() => save(true)} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                      {saving === "saveas" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} 別名保存
                    </button>
                    {selId && (
                      <button onClick={onDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} 削除
                      </button>
                    )}
                  </div>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="メモ（任意）"
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* 工程ステップ */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">
                    工程（{steps.length}）<span className="ml-2 text-xs font-normal text-gray-400">基準日から最長 {totalDuration} 日</span>
                  </span>
                  <button onClick={addStep} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                    <Plus className="w-3.5 h-3.5" /> 工程追加
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium w-8"></th>
                        <th className="px-2 py-1.5 text-left font-medium">工程名</th>
                        <th className="px-2 py-1.5 text-left font-medium w-24" title="基準日から何日後に開始するか">開始(日後)</th>
                        <th className="px-2 py-1.5 text-left font-medium w-20" title="所要日数">日数</th>
                        <th className="px-2 py-1.5 text-left font-medium">メモ</th>
                        <th className="px-2 py-1.5 text-left font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {steps.map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-1 py-1 text-center text-gray-400">{i + 1}</td>
                          <td className="px-1 py-1">
                            <input value={s.name} onChange={(e) => patchStep(i, { name: e.target.value })} className="w-full min-w-[120px] rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" placeholder="工程名" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min={0} value={s.offset} onChange={(e) => patchStep(i, { offset: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min={1} value={s.days} onChange={(e) => patchStep(i, { days: Math.max(1, Number(e.target.value) || 1) })} className="w-16 rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" />
                          </td>
                          <td className="px-1 py-1">
                            <input value={s.notes || ""} onChange={(e) => patchStep(i, { notes: e.target.value })} className="w-full min-w-[100px] rounded border border-gray-200 px-1.5 py-1 focus:border-indigo-400 focus:outline-none" placeholder="メモ" />
                          </td>
                          <td className="px-1 py-1">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="上へ"><ChevronUp className="w-3.5 h-3.5" /></button>
                              <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="下へ"><ChevronDown className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeStep(i)} className="p-0.5 text-red-400 hover:text-red-600" title="削除"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {steps.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-gray-400">「工程追加」から工程を作成してください。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
