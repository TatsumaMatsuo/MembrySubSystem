"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink, JudgmentBadge } from "@/components/features/seisan-kpi";
import { RefreshCw } from "lucide-react";
import type { Judgment } from "@/lib/kpi";

interface HistorySeriesRow { indicator: string; unit: string; aggLevel: string; series: { period: number; value: number | null }[]; target50: number | null; validity: string }
interface DeptHistoryRow { kpiId: string; category: string; kpiName: string; unit: string; direction: string; prevActual: number | null; annualTarget: number; current: number; judgment: Judgment }
interface GroupHistoryRow { kpiName: string; category: string; unit: string; aggType: string; aggregateMethod: string; memberDepartments: string[]; annualTarget: number; current: number; judgment: Judgment }
interface GroupInfo { groupId: string; groupName: string; members: string[] }
interface HistoryData {
  scope: "zensha" | "busho" | "group"; period: number;
  departments: string[]; groups: GroupInfo[];
  selected: { department: string | null; groupId: string | null };
  zensha?: HistorySeriesRow[]; busho?: DeptHistoryRow[];
  group?: { name: string | null; members: string[]; rows: GroupHistoryRow[] };
}

const validityStyle: Record<string, { bg: string; fg: string }> = {
  ストレッチ: { bg: "#dbeafe", fg: "#1e40af" },
  妥当: { bg: "#dcfce7", fg: "#166534" },
  要努力: { bg: "#fee2e2", fg: "#991b1b" },
  "—": { bg: "#f1f5f9", fg: "#64748b" },
};
const PAST_PERIODS = [43, 44, 45, 46, 47, 48, 49];

export default function SeisanKpiHistoryPage() {
  const [scope, setScope] = useState<"zensha" | "busho" | "group">("zensha");
  const [data, setData] = useState<HistoryData | null>(null);
  const [dept, setDept] = useState("");
  const [group, setGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (sc: typeof scope, d?: string, g?: string) => {
    setLoading(true); setMessage(null);
    try {
      const params = new URLSearchParams({ scope: sc });
      if (d) params.set("dept", d);
      if (g) params.set("group", g);
      const res = await fetch(`/api/seisan-kpi/history?${params.toString()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const dd: HistoryData = json.data;
      setData(dd);
      setDept(dd.selected.department ?? "");
      setGroup(dd.selected.groupId ?? "");
    } catch (e: any) { setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(scope, dept, group); /* eslint-disable-next-line */ }, [scope]);

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>過去実績参照 ― 43〜49期 + 50期目標</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{data?.period ?? "—"}期</span>
            <button onClick={() => load(scope, dept, group)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <HelpLink section="map" />
          </div>
        </div>

        {/* スコープタブ */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {([["zensha", "全社・部門"], ["busho", "部署別"], ["group", "グループ別"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: scope === k ? "#1f3864" : "#dde5ef", color: scope === k ? "#fff" : "#475569" }}>
              {label}
            </button>
          ))}
          {scope === "busho" && data && (
            <select value={dept} onChange={(e) => { setDept(e.target.value); load("busho", e.target.value); }} style={selStyle}>
              {data.departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {scope === "group" && data && (
            <select value={group} onChange={(e) => { setGroup(e.target.value); load("group", undefined, e.target.value); }} style={selStyle}>
              {data.groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </select>
          )}
        </div>

        {message && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{message}</div>}

        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
          : !data ? null
          : scope === "zensha" ? <ZenshaView rows={data.zensha ?? []} />
          : scope === "busho" ? <BushoView dept={dept} rows={data.busho ?? []} />
          : <GroupView group={data.group} />}
      </div>
      </div>
    </MainLayout>
  );
}

/* ===== 全社・部門 ===== */
function ZenshaView({ rows }: { rows: HistorySeriesRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>43〜49期の推移と50期目標。妥当性=過去レンジに対する目標の位置(ストレッチ=過去最高水準超 / 妥当=範囲内 / 要努力=緩い)。</div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
            <th style={{ ...th, textAlign: "left" }}>指標</th>
            <th style={th}>レベル</th>
            <th style={th}>単位</th>
            {PAST_PERIODS.map((p) => <th key={p} style={th}>{p}期</th>)}
            <th style={{ ...th, background: "#eef2ff" }}>50期目標</th>
            <th style={th}>推移</th>
            <th style={th}>妥当性</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vmap = new Map(r.series.map((s) => [s.period, s.value]));
            const vs = validityStyle[r.validity] ?? validityStyle["—"];
            return (
              <tr key={r.indicator}>
                <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{r.indicator}</td>
                <td style={{ ...td, color: "#64748b" }}>{r.aggLevel}</td>
                <td style={{ ...td, color: "#64748b" }}>{r.unit}</td>
                {PAST_PERIODS.map((p) => <td key={p} style={tdNum}>{vmap.get(p) ?? "—"}</td>)}
                <td style={{ ...tdNum, background: "#eef2ff", fontWeight: 700 }}>{r.target50 ?? "—"}</td>
                <td style={td}><Sparkline series={r.series} target={r.target50} /></td>
                <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: vs.bg, color: vs.fg }}>{r.validity}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ===== 部署別 ===== */
function BushoView({ dept, rows }: { dept: string; rows: DeptHistoryRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        <b>{dept}</b> のKPI履歴。49期実績→50期現在の推移と目標・判定。部署別の深い時系列は50期〜の運用蓄積で充実します。
      </div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
            <th style={th}>カテゴリ</th>
            <th style={{ ...th, textAlign: "left" }}>KPI名称</th>
            <th style={th}>単位</th>
            <th style={th}>49期実績</th>
            <th style={{ ...th, background: "#eef2ff" }}>50期目標</th>
            <th style={th}>50期現在</th>
            <th style={th}>判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kpiId}>
              <td style={{ ...td, color: "#64748b" }}>{r.category}</td>
              <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{r.kpiName}</td>
              <td style={{ ...td, color: "#64748b" }}>{r.unit}</td>
              <td style={tdNum}>{r.prevActual ?? "—"}</td>
              <td style={{ ...tdNum, background: "#eef2ff", fontWeight: 700 }}>{r.annualTarget}</td>
              <td style={{ ...tdNum, fontWeight: 700 }}>{r.current}</td>
              <td style={td}><JudgmentBadge judgment={r.judgment} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===== グループ別 ===== */
function GroupView({ group }: { group?: { name: string | null; members: string[]; rows: GroupHistoryRow[] } }) {
  if (!group || group.rows.length === 0) return <Empty />;
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        <b>{group.name}</b> ― 所属部署を合算(累計系)/平均(率系)で集計。所属: {group.members.join("・")}
      </div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
            <th style={th}>カテゴリ</th>
            <th style={{ ...th, textAlign: "left" }}>KPI名称</th>
            <th style={th}>単位</th>
            <th style={th}>集計方法</th>
            <th style={{ ...th, background: "#eef2ff" }}>50期目標</th>
            <th style={th}>50期現在</th>
            <th style={th}>判定</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r) => (
            <tr key={r.kpiName}>
              <td style={{ ...td, color: "#64748b" }}>{r.category}</td>
              <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{r.kpiName}<div style={{ fontSize: 10, color: "#94a3b8" }}>{r.memberDepartments.length}部署</div></td>
              <td style={{ ...td, color: "#64748b" }}>{r.unit}</td>
              <td style={{ ...td, fontSize: 11 }}><span style={{ padding: "2px 8px", borderRadius: 6, background: r.aggregateMethod === "合算" ? "#dbeafe" : "#fef3c7", color: r.aggregateMethod === "合算" ? "#1e40af" : "#92400e", fontWeight: 700 }}>{r.aggregateMethod}</span></td>
              <td style={{ ...tdNum, background: "#eef2ff", fontWeight: 700 }}>{r.annualTarget}</td>
              <td style={{ ...tdNum, fontWeight: 700 }}>{r.current}</td>
              <td style={td}><JudgmentBadge judgment={r.judgment} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 43〜49期の推移ミニ折れ線(赤破線=50期目標) */
function Sparkline({ series, target }: { series: { period: number; value: number | null }[]; target: number | null }) {
  const pts = series.filter((s) => s.value != null) as { period: number; value: number }[];
  if (pts.length < 2) return <span style={{ color: "#cbd5e1" }}>―</span>;
  const W = 120, H = 34, pad = 5;
  const vals = [...pts.map((p) => p.value), ...(target != null ? [target] : [])];
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1; min -= span * 0.1; max += span * 0.1;
  const n = pts.length;
  const x = (i: number) => pad + (W - 2 * pad) * (n < 2 ? 0 : i / (n - 1));
  const y = (v: number) => pad + (H - 2 * pad) * (1 - (v - min) / (max - min));
  let d = ""; pts.forEach((p, i) => { d += (i ? "L" : "M") + x(i) + " " + y(p.value) + " "; });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ verticalAlign: "middle" }}>
      {target != null && <line x1={pad} y1={y(target)} x2={W - pad} y2={y(target)} stroke="#dc2626" strokeWidth={1} strokeDasharray="3 2" />}
      <path d={d} fill="none" stroke="#1f3864" strokeWidth={1.5} />
      {pts.map((p, i) => <circle key={p.period} cx={x(i)} cy={y(p.value)} r={1.8} fill="#1f3864" />)}
    </svg>
  );
}

function Empty() {
  return <div style={{ ...card, padding: 40, textAlign: "center", color: "#94a3b8" }}>該当データがありません。</div>;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const tableStyle: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" };
const th: React.CSSProperties = { padding: "7px 9px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "6px 9px", borderBottom: "1px solid #f1f5f9", textAlign: "center" };
const tdNum: React.CSSProperties = { ...td, fontVariantNumeric: "tabular-nums" };
const selStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff", marginLeft: 4 };
