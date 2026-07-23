"use client";

// Frappe Gantt(MIT) の React ラッパ（#95）。
// vanilla JS ライブラリを client 専用に動的import し、依存変更時はコンテナを作り直して再描画する。
import { useEffect, useRef, useState } from "react";
// frappe-gantt の exports 制限でサブパスCSSを直接importできないため、リポジトリ内に複製したCSSを読み込む。
import "./frappe-gantt.css";
import { GANTT_PALETTE, type GanttTaskData, type GanttUnit, type GanttHoliday } from "@/lib/gantt/types";

// 背景色: 土日＝薄いグレー / 会社休日＝薄い赤
const WEEKEND_BG = "#eef1f5";
const HOLIDAY_BG = "#fde8e8";

const UNIT_TO_MODE: Record<GanttUnit, string> = { day: "Day", week: "Week", month: "Month" };
// 各単位の基準カラム幅(px)。ズーム倍率を掛けて column_width に渡す。
const BASE_COL: Record<GanttUnit, number> = { day: 38, week: 140, month: 120 };
// fit表示時の「1列あたり」下限幅(px)。列数が多く fit すると列が細くなり過ぎて
// バー/日付が消え、床張りで zoom も効かなくなる(=伸ばせない)。下限未満は fit を諦め、
// この幅を基準に zoom を掛けて横スクロールで見せる。
const MIN_FIT_COL: Record<GanttUnit, number> = { day: 8, week: 20, month: 30 };
// 最終バーが右端に貼り付かないよう、終了側に最低限確保する日数
const END_PAD_MIN = 3;

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// YYYY-MM-DD の日数差（to - from）
function ymdDiff(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round((new Date(by, (bm || 1) - 1, bd || 1).getTime() - new Date(ay, (am || 1) - 1, ad || 1).getTime()) / 86400000);
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
  fitDays,
  baseDate,
  holidays,
  workdays,
  onDateChange,
  onClickTask,
}: {
  tasks: GanttTaskData[];
  unit: GanttUnit;
  readonly?: boolean;
  zoom?: number; // 全体縮尺（カラム幅倍率）。1.0=標準（fitDays指定時はfit状態を1.0とする）
  fitDays?: number; // 指定時、この日数分を表示幅に収める（例: 表示月数N → 30N+1日）
  baseDate?: string; // カレンダー表示開始日（YYYY-MM-DD）。gantt_startをこの日に合わせる
  holidays?: GanttHoliday[]; // 会社カレンダーの休日（薄い赤）
  workdays?: string[]; // 会社の出勤日（土日でもグレーにしない）YYYY-MM-DD
  onDateChange?: (id: string, start: string, end: string) => void;
  onClickTask?: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<any>(null);
  const cbRef = useRef({ onDateChange, onClickTask });
  cbRef.current = { onDateChange, onClickTask };
  const baseDateRef = useRef<string | undefined>(baseDate);
  baseDateRef.current = baseDate;
  const fitDaysRef = useRef<number | undefined>(fitDays);
  fitDaysRef.current = fitDays;

  // カレンダーの描画範囲を padding で決める。frappe は
  //   gantt_start = start_of(最小開始日, unit) − padding[0]
  //   gantt_end   = start_of(最大終了日, unit) + padding[1]
  // で範囲を出す(タスクの期間が基準で、列幅は無関係)。padding に文字列を渡すと両端に同じ値が
  // 入ってしまうため、[開始側, 終了側] の配列で個別に指定する。
  //  - 開始側: 「最小開始日 − 基準日」→ gantt_start が基準日に一致する。
  //  - 終了側: 「基準日 + fitDays」まで届く長さ。これを入れないとタスク期間より広い月数を
  //    指定しても描画範囲が伸びず、表示月数を増やしても列が細くなるだけで月数が増えない。
  const applyBasePadding = (taskList: GanttTaskData[]) => {
    const g = ganttRef.current;
    if (!g) return;
    const starts = taskList.map((t) => t.start).filter(Boolean);
    if (!starts.length) return;
    const minStart = starts.reduce((a, b) => (b < a ? b : a));
    const bd = baseDateRef.current || minStart;
    const ends = taskList.map((t) => t.end || t.start).filter(Boolean);
    const maxEnd = ends.length ? ends.reduce((a, b) => (b > a ? b : a)) : minStart;
    const startPad = Math.max(0, ymdDiff(bd, minStart)); // 最小開始日 − 基準日（正）
    // week/month 表示では gantt_end が週初/月初へ切り捨てられるぶん不足するので余裕を足す
    const slack = unit === "day" ? 0 : unit === "week" ? 6 : 31;
    const fd = fitDaysRef.current || 0;
    const spanDays = ymdDiff(bd, maxEnd); // 基準日 → 最終終了日
    const endPad = Math.max(END_PAD_MIN, fd > 0 ? fd - spanDays + slack : 0);
    const vm = g.options?.view_modes?.find((m: any) => m.name === UNIT_TO_MODE[unit]);
    if (vm) vm.padding = [`${startPad}d`, `${endPad}d`];
  };
  // バーD&D由来の更新は「React→Ganttの再描画」を1回スキップ(ちらつき/ジャンプ防止)
  const skipSyncRef = useRef(false);

  // 表示幅を計測（fitDays指定時に「N月分を幅に収める」ため）
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setViewW((prev) => (Math.abs(prev - w) >= 8 ? w : prev));
    };
    update();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => ro?.disconnect();
  }, []);

  // 縮尺は横(カラム幅)と縦(バー高・行間)の両方に効かせる。
  // fitDays指定時は「表示幅 / 列数」を基準(=zoom 1.0)にして、指定日数分が収まるようにする。
  const columnWidth = (() => {
    if (fitDays && fitDays > 0 && viewW > 0) {
      const columns = unit === "day" ? fitDays : unit === "week" ? Math.ceil(fitDays / 7) : Math.ceil(fitDays / 30);
      // fit基準(1列=表示幅/列数)に下限を設けてから zoom を掛ける。
      // こうすると zoom が常に列幅へ効き(床張りのデッドゾーンが無い)、細くなり過ぎて
      // バー/カレンダーが消える・一度消えると伸ばせない、という不具合を防ぐ。
      // 下限で列がビューより広くなる場合は内部の .gantt-container が横スクロールで見せる。
      const fitBase = viewW / Math.max(1, columns);
      const base = Math.max(MIN_FIT_COL[unit], fitBase);
      return Math.max(4, Math.round(base * zoom));
    }
    return Math.max(12, Math.round(BASE_COL[unit] * zoom));
  })();
  const barHeight = Math.max(10, Math.round(30 * zoom));
  const rowPadding = Math.max(6, Math.round(18 * zoom));
  const holidayList = holidays || [];
  const workdaySet = new Set(workdays || []);
  const holidaySig = holidayList.map((h) => h.date).join(",");
  const workdaySig = (workdays || []).join(",");
  // 構造シグネチャ: タスクの増減・並び・単位・readonly・縮尺・休日・出勤日・表示月数 が変わった時だけ作り直す
  // ※ fitDays は必須。列幅が下限(4px)に張り付くと 9か月/12か月で columnWidth が同値になり、
  //   fitDays を含めないと表示月数を変えても再描画されない。
  // ※ baseDate は含めない。baseDate はドラッグで最早開始日が変わると変化するため、含めると
  //   バードラッグのたびに Gantt 全体が作り直され、直後に別バーを掴むとドラッグ対象が取り違わる。
  //   baseDate の反映は下の同期effect(applyBasePadding+refresh)で軽く行う。
  const structuralSig =
    tasks.map((t) => t.id).join("|") + "#" + unit + "#" + (readonly ? "1" : "0") + "#" + columnWidth + "x" + barHeight + "x" + rowPadding + "#h" + holidaySig + "#w" + workdaySig + "#f" + (fitDays || 0);

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
            const s = fmt(start);
            let e = fmt(end);
            // リサイズで開始日が終了日を追い越すと start>end になり、バー幅が負で消える。
            // 最小1日(end=start)にクランプしてバー消失・データ不整合を防ぐ。
            if (s > e) {
              e = s;
              // クランプ時は frappe の描画(潰れたバー)とデータが食い違うので、
              // skip せず同期effectで正しい1日バーに描き直させる。
            } else {
              skipSyncRef.current = true; // 通常はGanttが既に反映済み→作り直さない
            }
            cbRef.current.onDateChange?.(task.id, s, e);
          },
          on_click: (task: any) => {
            cbRef.current.onClickTask?.(task.id);
          },
        });
        // 基準日と表示月数を描画範囲へ反映（padding再設定→再描画）
        applyBasePadding(tasks);
        try {
          ganttRef.current.change_view_mode();
        } catch {
          /* 再描画失敗は無視 */
        }
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
    // ドラッグ/リサイズ中は絶対に refresh しない（バーを作り直すとドラッグ対象が取り違わる）
    if (g.bar_being_dragged != null) return;
    try {
      // refresh はスクロールを先頭へ戻すことがあるため、位置を保存/復元
      const scroller = containerRef.current?.querySelector<HTMLElement>(".gantt-container");
      const left = scroller?.scrollLeft ?? 0;
      applyBasePadding(tasks); // 基準日の開始位置を維持（日付編集や baseDate 変更で最小開始日が変わっても追従）
      g.refresh(tasks.map((t, i) => toFg(t, i)));
      if (scroller) requestAnimationFrame(() => (scroller.scrollLeft = left));
    } catch (e) {
      console.error("[GanttChart] refresh error", e);
    }
    // baseDate も依存に含める（structuralSig から外したぶん、baseDate変更をここで反映）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, baseDate]);

  // バーのドラッグ/リサイズ中、ポインタがビュー端に寄ったら横スクロールを追従させる。
  // frappe は mousemove を SVG にバインドし、ドラッグ中の自動スクロールを持たないため、
  // チャートが表示幅より広い(横スクロールが必要)ときに端でバーが止まって見える。これを補う。
  useEffect(() => {
    let raf = 0;
    let pointerX = 0;
    let active = false;
    const isDragging = () => {
      const g = ganttRef.current;
      // frappe: 非ドラッグ時は bar_being_dragged が null、ドラッグ/リサイズ中は非null(true/false)
      return !!g && g.bar_being_dragged != null;
    };
    const getScroller = () => containerRef.current?.querySelector<HTMLElement>(".gantt-container") || null;
    const tick = () => {
      if (!active) {
        raf = 0;
        return;
      }
      const sc = getScroller();
      if (sc && isDragging()) {
        const rect = sc.getBoundingClientRect();
        const EDGE = 48; // 端からこの距離でスクロール開始
        const SPEED = 16; // 1フレームのスクロール量(px)
        if (pointerX > rect.right - EDGE) sc.scrollLeft += SPEED;
        else if (pointerX < rect.left + EDGE) sc.scrollLeft -= SPEED;
      } else {
        active = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: MouseEvent) => {
      pointerX = e.clientX;
      if (!active && isDragging()) {
        active = true;
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };
    const onUp = () => {
      active = false;
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="w-full h-full overflow-hidden">
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
