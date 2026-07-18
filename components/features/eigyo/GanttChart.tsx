"use client";

// Frappe Gantt(MIT) の React ラッパ（#95）。
// vanilla JS ライブラリを client 専用に動的import し、依存変更時はコンテナを作り直して再描画する。
import { useEffect, useRef } from "react";
// frappe-gantt の exports 制限でサブパスCSSを直接importできないため、リポジトリ内に複製したCSSを読み込む。
import "./frappe-gantt.css";
import type { GanttTaskData, GanttUnit } from "@/lib/gantt/types";

const UNIT_TO_MODE: Record<GanttUnit, string> = { day: "Day", week: "Week", month: "Month" };

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toFg(t: GanttTaskData) {
  return {
    id: t.id,
    name: t.name || "(無題)",
    start: t.start,
    end: t.end || t.start,
    progress: typeof t.progress === "number" ? t.progress : 0,
    dependencies: (t.pred || []).join(","),
  };
}

export function GanttChart({
  tasks,
  unit,
  readonly,
  onDateChange,
  onClickTask,
}: {
  tasks: GanttTaskData[];
  unit: GanttUnit;
  readonly?: boolean;
  onDateChange?: (id: string, start: string, end: string) => void;
  onClickTask?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onDateChange, onClickTask });
  cbRef.current = { onDateChange, onClickTask };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import("frappe-gantt");
      const Gantt = mod.default || mod;
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = ""; // 作り直し
      if (!tasks.length) return;
      try {
        // eslint-disable-next-line no-new
        new Gantt(containerRef.current, tasks.map(toFg), {
          view_mode: UNIT_TO_MODE[unit],
          today_button: true,
          view_mode_select: false,
          readonly: !!readonly,
          readonly_progress: true, // 進捗はグリッド側で編集
          popup_on: "hover",
          infinite_padding: true,
          on_date_change: (task: any, start: Date, end: Date) => {
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
  }, [tasks, unit, readonly]);

  return (
    <div className="w-full overflow-auto">
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          左のグリッドでタスクを追加するとチャートが表示されます。
        </div>
      ) : (
        <div ref={containerRef} className="gantt-target min-w-[640px]" />
      )}
    </div>
  );
}
