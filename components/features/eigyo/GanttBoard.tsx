"use client";

// 読み取り専用ガント表示（#95）。PDF印刷と同じ「左=工程名/開始/終了、右=タイムライン(行揃え)」レイアウト。
// 売約詳細の社内工程表タブ等で、取込済ガントを表示するのに使う。
import { useMemo } from "react";
import { GANTT_PALETTE, type GanttTaskData, type GanttUnit, type GanttHoliday } from "@/lib/gantt/types";

const WEEKEND_BG = "#eef1f5";
const HOLIDAY_BG = "#fde8e8";

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function diffDays(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round((new Date(by, (bm || 1) - 1, bd || 1).getTime() - new Date(ay, (am || 1) - 1, ad || 1).getTime()) / 86400000);
}

export function GanttBoard({
  tasks,
  unit,
  zoom = 1,
  holidays,
  workdays,
}: {
  tasks: GanttTaskData[];
  unit: GanttUnit;
  zoom?: number;
  holidays?: GanttHoliday[];
  workdays?: string[];
}) {
  const model = useMemo(() => {
    const valid = tasks.filter((t) => t.start);
    if (!valid.length) return null;
    const from = valid.reduce((m, t) => (t.start < m ? t.start : m), valid[0].start);
    const to = valid.reduce((m, t) => {
      const e = t.end && t.end >= t.start ? t.end : t.start;
      return e > m ? e : m;
    }, valid[0].end && valid[0].end >= valid[0].start ? valid[0].end : valid[0].start);
    const totalDays = Math.max(1, diffDays(from, to) + 1);

    const pxPerDayByUnit: Record<GanttUnit, number> = { day: 28, week: 9, month: 3.6 };
    const pxPerDay = Math.max(1.5, pxPerDayByUnit[unit] * zoom);
    const rightPad = 60;
    const timelineWidth = Math.round(totalDays * pxPerDay) + rightPad;
    const rowH = 30;
    const headerH = 44;
    const barH = rowH - 12;

    const holSet = new Set((holidays || []).map((h) => h.date));
    const workSet = new Set(workdays || []);
    const dayX = (ymd: string) => diffDays(from, ymd) * pxPerDay;

    // 月区切り
    const monthStarts: { ymd: string; y: number; m: number }[] = [];
    let cur = from;
    while (cur <= to) {
      const [y, m] = cur.split("-").map(Number);
      monthStarts.push({ ymd: cur, y, m });
      cur = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }

    const idx = new Map<string, number>();
    valid.forEach((t, i) => idx.set(t.id, i));

    return { valid, from, to, totalDays, pxPerDay, timelineWidth, rowH, headerH, barH, holSet, workSet, dayX, monthStarts, idx };
  }, [tasks, unit, zoom, holidays, workdays]);

  if (!model) {
    return <div className="flex items-center justify-center h-32 text-sm text-gray-400">表示する工程がありません。</div>;
  }

  const { valid, from, totalDays, pxPerDay, timelineWidth, rowH, headerH, barH, holSet, workSet, dayX, monthStarts, idx } = model;
  const totalH = headerH + valid.length * rowH;
  const NAME_W = 170;
  const DATE_W = 92;
  const infoWidth = NAME_W + DATE_W * 2;

  // 依存線
  const arrows: JSX.Element[] = [];
  const center = (i: number) => headerH + i * rowH + rowH / 2;
  valid.forEach((t, i) => {
    for (const p of t.pred || []) {
      const j = idx.get(p);
      if (j == null) continue;
      const pe = valid[j];
      const pend = pe.end && pe.end >= pe.start ? pe.end : pe.start;
      const x1 = Math.round(dayX(pe.start) + (diffDays(pe.start, pend) + 1) * pxPerDay);
      const y1 = center(j);
      const x2 = Math.round(dayX(t.start));
      const y2 = center(i);
      arrows.push(
        <g key={`${i}-${p}`}>
          <path d={`M ${x1} ${y1} H ${x1 + 6} V ${y2} H ${x2}`} fill="none" stroke="#94a3b8" strokeWidth={1} />
          <path d={`M ${x2 - 5} ${y2 - 3} L ${x2} ${y2} L ${x2 - 5} ${y2 + 3} Z`} fill="#94a3b8" />
        </g>
      );
    }
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className="flex" style={{ width: infoWidth + timelineWidth, minWidth: "100%" }}>
        {/* 左: 工程名 / 開始 / 終了（横スクロール時も固定） */}
        <div className="flex-shrink-0 sticky left-0 z-10 bg-white" style={{ width: infoWidth, boxShadow: "1px 0 0 #e5e7eb" }}>
          <div className="flex items-center border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600" style={{ height: headerH }}>
            <div className="px-2 truncate" style={{ width: NAME_W }}>工程名</div>
            <div className="px-2 border-l border-gray-100" style={{ width: DATE_W }}>開始日</div>
            <div className="px-2 border-l border-gray-100" style={{ width: DATE_W }}>終了日</div>
          </div>
          {valid.map((t, i) => {
            const color = t.color || GANTT_PALETTE[i % GANTT_PALETTE.length];
            const end = t.end && t.end >= t.start ? t.end : t.start;
            return (
              <div key={t.id} className="flex items-center border-b border-gray-100 text-xs text-gray-700" style={{ height: rowH, background: i % 2 ? "#fff" : "#fbfcfe" }}>
                <div className="flex items-center gap-1.5 px-2" style={{ width: NAME_W }}>
                  <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: color }} />
                  <span className="truncate">{t.name || "(無題)"}</span>
                </div>
                <div className="px-2 border-l border-gray-100 text-gray-500" style={{ width: DATE_W }}>{t.start || "-"}</div>
                <div className="px-2 border-l border-gray-100 text-gray-500" style={{ width: DATE_W }}>{end || "-"}</div>
              </div>
            );
          })}
        </div>

        {/* 右: タイムライン */}
        <div className="relative flex-shrink-0" style={{ width: timelineWidth, height: totalH }}>
          {/* ヘッダー背景 */}
          <div className="absolute left-0 top-0 bg-gray-50 border-b border-gray-200" style={{ width: timelineWidth, height: headerH }} />
          {/* 月ラベル */}
          {monthStarts.map((ms, k) => {
            const left = Math.round(Math.max(0, dayX(ms.ymd)));
            const nextYmd = k + 1 < monthStarts.length ? monthStarts[k + 1].ymd : addDays(model.to, 1);
            const w = Math.round(dayX(nextYmd) - Math.max(0, dayX(ms.ymd)));
            return (
              <div key={k} className="absolute top-0 text-[11px] font-semibold text-gray-600" style={{ left, width: w, height: 22, lineHeight: "22px", borderLeft: "1px solid #cbd5e1", paddingLeft: 3, whiteSpace: "nowrap", overflow: "visible" }}>
                {ms.y}/{String(ms.m).padStart(2, "0")}
              </div>
            );
          })}
          {/* 下段目盛 */}
          {unit === "day" &&
            Array.from({ length: totalDays }).map((_, d) => {
              const left = Math.round(d * pxPerDay);
              const dd = Number(addDays(from, d).split("-")[2]);
              return (
                <div key={d} className="absolute text-[9px] text-center text-gray-400" style={{ left, top: 24, width: Math.round(pxPerDay), height: 18, lineHeight: "18px", borderLeft: "1px solid #f1f5f9", overflow: "hidden" }}>
                  {pxPerDay >= 14 ? dd : ""}
                </div>
              );
            })}
          {unit === "week" &&
            Array.from({ length: totalDays }).map((_, d) => {
              const ymd = addDays(from, d);
              const [yy, mm, da] = ymd.split("-").map(Number);
              if (new Date(yy, mm - 1, da).getDay() !== 1) return null;
              const left = Math.round(d * pxPerDay);
              return (
                <div key={d} className="absolute text-[9px] text-gray-400" style={{ left, top: 24, height: 18, lineHeight: "18px", borderLeft: "1px solid #e2e8f0", paddingLeft: 2, whiteSpace: "nowrap" }}>
                  {mm}/{da}
                </div>
              );
            })}
          {/* 土日・休日バンド（日/週表示） */}
          {unit !== "month" &&
            Array.from({ length: totalDays }).map((_, d) => {
              const ymd = addDays(from, d);
              const [yy, mm, da] = ymd.split("-").map(Number);
              const dow = new Date(yy, mm - 1, da).getDay();
              const isHol = holSet.has(ymd);
              const isWknd = (dow === 0 || dow === 6) && !workSet.has(ymd);
              if (!isHol && !isWknd) return null;
              return <div key={`b${d}`} className="absolute" style={{ left: Math.round(d * pxPerDay), top: headerH, width: Math.max(1, Math.round(pxPerDay)), height: totalH - headerH, background: isHol ? HOLIDAY_BG : WEEKEND_BG }} />;
            })}
          {/* 月グリッド線 */}
          {monthStarts.map((ms, k) => (
            <div key={`g${k}`} className="absolute" style={{ left: Math.round(Math.max(0, dayX(ms.ymd))), top: headerH, width: 0, height: totalH - headerH, borderLeft: "1px solid #eef2f7" }} />
          ))}
          {/* 行の下線 */}
          {valid.map((_, i) => (
            <div key={`r${i}`} className="absolute border-b border-gray-100" style={{ left: 0, top: headerH + i * rowH, width: timelineWidth, height: rowH }} />
          ))}
          {/* バー */}
          {valid.map((t, i) => {
            const start = t.start;
            const end = t.end && t.end >= t.start ? t.end : t.start;
            const bx = Math.round(dayX(start));
            const bw = Math.max(3, Math.round((diffDays(start, end) + 1) * pxPerDay));
            const by = headerH + i * rowH + Math.round((rowH - barH) / 2);
            const color = t.color || GANTT_PALETTE[i % GANTT_PALETTE.length];
            return <div key={`bar${t.id}`} className="absolute rounded" style={{ left: bx, top: by, width: bw, height: barH, background: color }} title={`${t.name}: ${start}〜${end}`} />;
          })}
          {/* 依存線 */}
          {arrows.length > 0 && (
            <svg className="absolute left-0 top-0 pointer-events-none" width={timelineWidth} height={totalH}>
              {arrows}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
