"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout";
import { GanttChart } from "@/components/features/eigyo/GanttChart";
import { fetchJson } from "@/lib/fetch-json";
import { ArrowLeft, Plus, Minus, Save, Copy, Trash2, ChevronUp, ChevronDown, Loader2, LayoutTemplate, X, Printer, Link2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// PDF出力項目（日付は常に出力するため対象外）
type PrintOptKey = "name" | "assignee" | "notes" | "chart";
const PRINT_OPT_LABELS: { key: PrintOptKey; label: string }[] = [
  { key: "name", label: "工程名" },
  { key: "assignee", label: "担当" },
  { key: "notes", label: "メモ" },
  { key: "chart", label: "ガントチャート図" },
];
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
  // PDF出力
  const [printModal, setPrintModal] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printOpts, setPrintOpts] = useState<Record<PrintOptKey, boolean>>({ name: true, assignee: true, notes: true, chart: true });
  // 表示: 縮尺(ズーム)とタスク枠の折りたたみ
  const [zoom, setZoom] = useState(1);
  const [gridCollapsed, setGridCollapsed] = useState(false);

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

  // ---- PDF出力 ----
  const openPrintModal = () => {
    if (tasks.length === 0) {
      window.alert("出力するタスクがありません");
      return;
    }
    setPrintModal(true);
  };

  // 選択項目でPDFを生成（html2canvasでDOM画像化→jsPDFでA4横1ページに収める）。
  const generateGanttPdf = async () => {
    if (printing) return;
    // 工程期間が長く1ページに収まりにくい場合は、より粗い単位を促す
    if (printOpts.chart) {
      const starts = tasks.map((t) => t.start).filter(Boolean);
      const ends = tasks.map((t) => t.end || t.start).filter(Boolean);
      if (starts.length && ends.length) {
        const minS = starts.reduce((a, b) => (b < a ? b : a));
        const maxE = ends.reduce((a, b) => (b > a ? b : a));
        const spanDays = diffDays(minS, maxE) + 1;
        const cols = unit === "day" ? spanDays : unit === "week" ? Math.ceil(spanDays / 7) : Math.ceil(spanDays / 30);
        if (unit !== "month" && cols > 45) {
          const suggest = unit === "day" ? "「週」または「月」" : "「月」";
          const ok = window.confirm(
            `工程期間が約${spanDays}日と長いため、1ページに収めると細かくなり読みにくくなります。\n表示単位を${suggest}に切り替えてから出力することをおすすめします。\n\nこのまま出力しますか？`
          );
          if (!ok) return;
        }
      }
    }
    setPrinting(true);
    try {
      const h2cMod: any = await import("html2canvas");
      const html2canvas = h2cMod.default || h2cMod;
      const jspdfMod: any = await import("jspdf");
      const JsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
      if (typeof JsPDF !== "function") throw new Error("jsPDFの読み込みに失敗しました");

      // 画面外に印刷用DOMを組み立てる
      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:fixed;left:-100000px;top:0;background:#ffffff;padding:16px;display:inline-block;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#111827;";

      // 見出し（題名・売約番号・作成日）
      const now = new Date();
      const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
      const header = document.createElement("div");
      header.style.cssText = "margin-bottom:12px;";
      header.innerHTML =
        `<div style="font-size:18px;font-weight:700;">${escHtml(title || "(無題)")}</div>` +
        `<div style="font-size:12px;color:#4b5563;margin-top:2px;">${seiban ? "売約番号: " + escHtml(seiban) + "　" : ""}作成日: ${dateStr}</div>`;
      wrap.appendChild(header);

      // 工程一覧テーブル（日付は常に、他は選択項目のみ）
      const cols: { label: string; get: (t: GanttTaskData, i: number) => string }[] = [{ label: "No.", get: (_t, i) => String(i + 1) }];
      if (printOpts.name) cols.push({ label: "工程名", get: (t) => escHtml(t.name || "") });
      cols.push({ label: "開始", get: (t) => escHtml(t.start || "") });
      cols.push({ label: "終了", get: (t) => escHtml(t.end || "") });
      if (printOpts.assignee) cols.push({ label: "担当", get: (t) => escHtml(t.assignee || "") });
      if (printOpts.notes) cols.push({ label: "メモ", get: (t) => escHtml(t.notes || "") });
      const table = document.createElement("table");
      table.style.cssText = "border-collapse:collapse;font-size:12px;margin-bottom:14px;min-width:100%;";
      const thStyle = "border:1px solid #cbd5e1;background:#f1f5f9;padding:4px 8px;text-align:left;white-space:nowrap;font-weight:600;";
      const tdStyle = "border:1px solid #e2e8f0;padding:4px 8px;text-align:left;vertical-align:top;";
      table.innerHTML =
        `<thead><tr>${cols.map((c) => `<th style="${thStyle}">${c.label}</th>`).join("")}</tr></thead>` +
        `<tbody>${tasks
          .map((t, i) => {
            const eff = t.color || GANTT_PALETTE[i % GANTT_PALETTE.length];
            const firstCell = `<td style="${tdStyle}white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${eff};margin-right:5px;"></span>${cols[0].get(t, i)}</td>`;
            const rest = cols.slice(1).map((c) => `<td style="${tdStyle}">${c.get(t, i)}</td>`).join("");
            return `<tr>${firstCell}${rest}</tr>`;
          })
          .join("")}</tbody>`;
      wrap.appendChild(table);

      // ガントチャート図（選択時のみ）: 画面上の描画済みSVGを複製
      if (printOpts.chart) {
        const live = document.querySelector<HTMLElement>(".gantt-print-root .gantt-container");
        if (live) {
          const w = live.scrollWidth;
          const h = live.scrollHeight;
          const clone = live.cloneNode(true) as HTMLElement;
          clone.querySelectorAll(".side-header, .extras").forEach((n) => n.remove()); // 今日ボタン等は除外
          clone.style.overflow = "visible";
          clone.style.width = `${w}px`;
          clone.style.height = `${h}px`;
          clone.style.maxWidth = "none";
          const chartBox = document.createElement("div");
          chartBox.appendChild(clone);
          wrap.appendChild(chartBox);
        }
      }

      document.body.appendChild(wrap);
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(wrap, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          windowWidth: wrap.scrollWidth,
          windowHeight: wrap.scrollHeight,
        });
      } finally {
        document.body.removeChild(wrap);
      }

      // A4横1ページに収める
      const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth();
      const PH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availW = PW - margin * 2;
      const availH = PH - margin * 2;
      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const iw = canvas.width * ratio;
      const ih = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (PW - iw) / 2, margin, iw, ih);
      const safe = (title || "ガントチャート").replace(/[\\/:*?"<>|]/g, "_");
      pdf.save(`${safe}.pdf`);
      setPrintModal(false);
    } catch (e: any) {
      console.error("[gantt] pdf error", e);
      window.alert(e?.message || "PDFの生成に失敗しました");
    } finally {
      setPrinting(false);
    }
  };

  // 先行タスクの表示名（工程名 or 連番）
  const taskLabel = (t: GanttTaskData, idx: number) => (t.name.trim() ? t.name.trim() : `工程${idx + 1}`);

  // 縮尺（＋/−）
  const zoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)));
  const zoomReset = () => setZoom(1);

  const taskCount = tasks.length;
  const chart = useMemo(() => <GanttChart tasks={tasks} unit={unit} zoom={zoom} onDateChange={onBarDateChange} />, [tasks, unit, zoom]);

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
            {/* 縮尺（＋/−） */}
            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50">
              <button onClick={zoomOut} disabled={zoom <= 0.4} className="rounded-l-lg px-2 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40" title="縮小">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={zoomReset} className="min-w-[48px] px-1 py-1 text-center text-xs font-medium text-gray-600 hover:bg-gray-100" title="標準に戻す">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={zoomIn} disabled={zoom >= 2.5} className="rounded-r-lg px-2 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40" title="拡大">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1" />
            <button onClick={openTplModal} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" title="ひな形と基準日から工程を生成">
              <LayoutTemplate className="w-4 h-4" /> ひな形から生成
            </button>
            <button onClick={saveAsTemplate} disabled={savingTpl} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" title="現在の工程をひな形として保存">
              {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ひな形化
            </button>
            <button onClick={openPrintModal} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" title="PDFを出力（項目を選択して1ページに出力）">
              <Printer className="w-4 h-4" /> PDF出力
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
            {/* 折りたたみ時: タスク枠を開く細いバー */}
            {gridCollapsed && (
              <button
                onClick={() => setGridCollapsed(false)}
                className="no-print flex-shrink-0 flex xl:flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-gray-500 shadow-sm hover:bg-gray-50"
                title="タスク一覧を開く"
              >
                <PanelLeftOpen className="w-4 h-4" />
                <span className="text-[11px] xl:[writing-mode:vertical-rl] font-medium">タスク一覧</span>
              </button>
            )}
            {/* 左: タスクグリッド */}
            <div className={`no-print ${gridCollapsed ? "hidden" : "xl:w-[46%]"} flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm min-h-0`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setGridCollapsed(true)} className="p-1 text-gray-400 hover:text-gray-700" title="タスク一覧を折りたたむ">
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">タスク（{taskCount}）</span>
                </div>
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

            {/* 右: ガントチャート（PDF出力時にこのSVGを複製して画像化）。
                タスク枠を折りたたむと flex-1 で自動的に横幅が広がる。 */}
            <div className="gantt-print-root flex-1 min-h-[420px] xl:min-h-0 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm p-2 overflow-hidden">
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

        {/* PDF出力モーダル */}
        {printModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !printing && setPrintModal(false)}>
            <div className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
                  <Printer className="w-5 h-5 text-indigo-600" /> PDF出力
                </h2>
                <button onClick={() => setPrintModal(false)} disabled={printing} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 py-4">
                <div className="mb-2 text-xs font-semibold text-gray-600">出力する項目</div>
                <div className="space-y-1.5">
                  {/* 日付は常に出力 */}
                  <label className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-sm text-gray-500">
                    <input type="checkbox" checked disabled />
                    日付（開始・終了）<span className="ml-auto text-[11px]">常に出力</span>
                  </label>
                  {PRINT_OPT_LABELS.map((o) => (
                    <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={printOpts[o.key]}
                        onChange={(e) => setPrintOpts((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-gray-400">A4横向き・1ページに収まるよう自動縮小して出力します。</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
                <button onClick={() => setPrintModal(false)} disabled={printing} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  キャンセル
                </button>
                <button onClick={generateGanttPdf} disabled={printing} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} 出力
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
