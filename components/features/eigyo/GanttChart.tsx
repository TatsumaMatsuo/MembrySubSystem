"use client";

// Frappe Gantt(MIT) の React ラッパ（#95）。
// vanilla JS ライブラリを client 専用に動的import し、依存変更時はコンテナを作り直して再描画する。
import { useEffect, useRef } from "react";
// frappe-gantt の exports 制限でサブパスCSSを直接importできないため、リポジトリ内に複製したCSSを読み込む。
import "./frappe-gantt.css";
import { GANTT_PALETTE, type GanttTaskData, type GanttUnit, type GanttHoliday } from "@/lib/gantt/types";

// 背景色: 土日＝薄いグレー / 会社休日＝薄い赤
const WEEKEND_BG = "#eef1f5";
const HOLIDAY_BG = "#fde8e8";

const UNIT_TO_MODE: Record<GanttUnit, string> = { day: "Day", week: "Week", month: "Month" };
// 各単位の基準カラム幅(px)。ズーム倍率を掛けて column_width に渡す。
const BASE_COL: Record<GanttUnit, number> = { day: 38, week: 140, month: 120 };

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 未指定タスクにはインデックス順でパレット既定色を割当（バーを見分けやすく）
function colorFor(t: GanttTaskData, i: number): string {
  return t.color || GANTT_PALETTE[i % GANTT_PALETTE.length];
}

function toFg(t: GanttTaskData, i: number) {
  return {
    id: t.id,
    name: t.name || "(無題)",
    start: t.start,
    end: t.end || t.start,
    progress: 0, // 進捗機能は廃止。バー全体を色表示
    color: colorFor(t, i),
    dependencies: (t.pred || []).join(","),
    assignee: t.assignee || "",
    notes: t.notes || "",
  };
}

export function GanttChart({
  tasks,
  unit,
  readonly,
  zoom = 1,
  holidays,
  workdays,
  onDateChange,
  onClickTask,
}: {
  tasks: GanttTaskData[];
  unit: GanttUnit;
  readonly?: boolean;
  zoom?: number; // 全体縮尺（カラム幅倍率）。1.0=標準
  holidays?: GanttHoliday[]; // 会社カレンダーの休日（薄い赤）
  workdays?: string[]; // 会社の出勤日（土日でもグレーにしない）YYYY-MM-DD
  onDateChange?: (id: string, start: string, end: string) => void;
  onClickTask?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<any>(null);
  const cbRef = useRef({ onDateChange, onClickTask });
  cbRef.current = { onDateChange, onClickTask };
  // バーD&D由来の更新は「React→Ganttの再描画」を1回スキップ(ちらつき/ジャンプ防止)
  const skipSyncRef = useRef(false);

  // 縮尺は横(カラム幅)と縦(バー高・行間)の両方に効かせる
  const columnWidth = Math.max(12, Math.round(BASE_COL[unit] * zoom));
  const barHeight = Math.max(10, Math.round(30 * zoom));
  const rowPadding = Math.max(6, Math.round(18 * zoom));
  const holidayList = holidays || [];
  const workdaySet = new Set(workdays || []);
  const holidaySig = holidayList.map((h) => h.date).join(",");
  const workdaySig = (workdays || []).join(",");
  // 構造シグネチャ: タスクの増減・並び・単位・readonly・縮尺・休日・出勤日 が変わった時だけ作り直す
  const structuralSig =
    tasks.map((t) => t.id).join("|") + "#" + unit + "#" + (readonly ? "1" : "0") + "#" + columnWidth + "x" + barHeight + "x" + rowPadding + "#h" + holidaySig + "#w" + workdaySig;

  // 生成/再生成（構造変化時のみ）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import("frappe-gantt");
      const Gantt = mod.default || mod;
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      ganttRef.current = null;
      if (!tasks.length) return;
      try {
        ganttRef.current = new Gantt(containerRef.current, tasks.map(toFg), {
          view_mode: UNIT_TO_MODE[unit],
          column_width: columnWidth, // 縮尺（横）
          bar_height: barHeight, // 縮尺（縦: バー高）
          padding: rowPadding, // 縮尺（縦: 行間）
          // 背景色: 会社休日＝薄い赤(名称ラベル付き) / 土日＝薄いグレー(会社の出勤日は除外)
          holidays: {
            [HOLIDAY_BG]: holidayList.map((h) => ({ date: h.date, name: h.name || "休日" })),
            // 関数を渡すと日付ごとに判定できる: 会社出勤日はグレーにしない
            [WEEKEND_BG]: (d: Date) => {
              const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              if (workdaySet.has(s)) return false; // 会社の出勤日
              return d.getDay() === 0 || d.getDay() === 6; // 通常の土日
            },
          },
          language: "ja", // 月名などを日本語表記(Intl.DateTimeFormat('ja'))
          today_button: true,
          view_mode_select: false,
          readonly: !!readonly,
          readonly_progress: true, // 進捗機能は廃止
          popup_on: "hover",
          // ホバー時に工程名・期間・担当・メモを表示
          popup: (ctx: any) => {
            const task = ctx.task || {};
            const s = task._start instanceof Date ? fmt(task._start) : task.start;
            const e = task._end instanceof Date ? fmt(task._end) : task.end;
            const rows = [
              `<div class="gantt-popup-dates">${s} 〜 ${e}</div>`,
              task.assignee ? `<div class="gantt-popup-assignee">担当: ${escapeHtml(task.assignee)}</div>` : "",
              task.notes ? `<div class="gantt-popup-notes">${escapeHtml(task.notes)}</div>` : "",
            ].join("");
            return `<div class="gantt-popup"><div class="gantt-popup-title">${escapeHtml(task.name || "(無題)")}</div>${rows}</div>`;
          },
          infinite_padding: false, // 無限パディングはドラッグ時に表示がずれるため無効化
          scroll_to: "start",
          on_date_change: (task: any, start: Date, end: Date) => {
            skipSyncRef.current = true; // 自分のドラッグ結果はGanttが既に反映済み→作り直さない
            cbRef.current.onDateChange?.(task.id, fmt(start), fmt(end));
          },
          on_click: (task: any) => {
            cbRef.current.onClickTask?.(task.id);
          },
        });
      } catch (e) {
        console.error("[GanttChart] render error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralSig]);

  // 同期（グリッド編集＝日付/名称/進捗の変更を既存インスタンスへ反映）。ドラッグ由来はスキップ。
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const g = ganttRef.current;
    if (!g || !tasks.length) return;
    try {
      // refresh はスクロールを先頭へ戻すことがあるため、位置を保存/復元
      const scroller = containerRef.current?.querySelector<HTMLElement>(".gantt-container");
      const left = scroller?.scrollLeft ?? 0;
      g.refresh(tasks.map((t, i) => toFg(t, i)));
      if (scroller) requestAnimationFrame(() => (scroller.scrollLeft = left));
    } catch (e) {
      console.error("[GanttChart] refresh error", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <div className="w-full h-full overflow-hidden">
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          左のグリッドでタスクを追加するとチャートが表示されます。
        </div>
      ) : (
        // gantt-target を高さ100%にし、内部の .gantt-container を唯一のスクロール領域にする
        // （日付ヘッダーは position:sticky で縦スクロール時も固定・横は常にスクロール可能）
        <div ref={containerRef} className="gantt-target h-full" />
      )}
    </div>
  );
}
