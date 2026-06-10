"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { RefreshCw, AlertCircle, TrendingUp } from "lucide-react";

interface Kgi {
  indicator: string;
  unit: string;
  trajectory: { period: number; target: number }[];
  finalTarget: number;
  finalPeriod: number;
  currentActual: number | null;
  attainment: number | null;
}
interface Header { planId: string; name: string; startPeriod: number; endPeriod: number; status: string; kgiSet: string[]; }

const fmt = (v: number | null, unit: string) =>
  v == null ? "―" : `${Math.round(v * 10) / 10}${unit}`;

function Trajectory({ kgi }: { kgi: Kgi }) {
  const W = 320, H = 150, padL = 38, padR = 14, padT = 16, padB = 26;
  const pts = kgi.trajectory;
  if (pts.length === 0) return null;
  const targets = pts.map((p) => p.target);
  const all = [...targets, ...(kgi.currentActual != null ? [kgi.currentActual] : [])];
  let min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  min -= span * 0.25; max += span * 0.2;
  const n = pts.length;
  const x = (i: number) => padL + (W - padL - padR) * (n < 2 ? 0 : i / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  let d = "";
  pts.forEach((p, i) => { d += (i ? "L" : "M") + x(i) + " " + y(p.target) + " "; });
  return (
    <svg width="100%" height="150" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 10 }}>
      <text x={padL} y={11} fontSize="10" fill="#94a3b8">― 目標(線形補間) ● 実績(年換算)</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e2e8f0" />
      <path d={d} fill="none" stroke="#1f3864" strokeWidth={2.5} strokeDasharray="5 4" />
      {pts.map((p, i) => (
        <circle key={p.period} cx={x(i)} cy={y(p.target)} r={3.5} fill="#1f3864" />
      ))}
      {kgi.currentActual != null && (
        <>
          <circle cx={x(0)} cy={y(kgi.currentActual)} r={5} fill="#dc2626" />
          <line x1={x(0)} y1={y(kgi.currentActual)} x2={x(0)} y2={y(pts[0].target)} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="2 2" />
        </>
      )}
      {pts.map((p, i) => (
        <text key={p.period} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="#64748b">{p.period}期</text>
      ))}
    </svg>
  );
}

export default function KeieiDashboardPage() {
  const [header, setHeader] = useState<Header | null>(null);
  const [kgis, setKgis] = useState<Kgi[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [registered, setRegistered] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/keiei/dashboard`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setHeader(d.header);
      setKgis(d.kgis ?? []);
      setElapsed(d.elapsedMonths);
      setRegistered(d.registered);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>経営ダッシュボード ― 中期経営計画 進捗</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            {header && <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{header.name || header.planId}（{header.startPeriod}→{header.endPeriod}期）</span>}
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>経過 {elapsed}ヶ月</span>
            <button onClick={load} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
        ) : !registered ? (
          <div style={{ fontSize: 13, padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
            <AlertCircle size={14} style={{ verticalAlign: "-2px" }} /> 中期経営計画が未登録です。「中計マスタ管理」でKGI（売上・ROA・労働生産性 等）と各年度目標を登録してください。
          </div>
        ) : (
          <>
            {error && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{error}</div>}
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              <TrendingUp size={14} style={{ verticalAlign: "-2px" }} /> 最終年度（{header?.endPeriod}期）のKGIへの到達度。破線＝線形補間トラジェクトリ、赤点＝当期の年換算実績。
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {kgis.map((k) => (
                <div key={k.indicator} style={card}>
                  <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{k.indicator}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 2px" }}>
                    {fmt(k.currentActual, k.unit)}
                    {k.currentActual == null && <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}> （実績未入力）</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    最終{k.finalPeriod}期目標 <b>{k.finalTarget}{k.unit}</b>
                    {k.attainment != null && <> ／ 到達度 {Math.round(k.attainment * 100)}%</>}
                  </div>
                  <Trajectory kgi={k} />
                </div>
              ))}
            </div>
            {kgis.length === 0 && (
              <div style={{ fontSize: 13, color: "#64748b", padding: 20 }}>KGI明細が未登録です。中計マスタ管理で各年度目標を登録してください。</div>
            )}
          </>
        )}

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 16, lineHeight: 1.7 }}>
          実績は会計データ（KAIKEI_ACTUAL）から年換算で算出。売上＝売上高、ROA＝経常利益÷総資産、労働生産性＝控除法付加価値÷人員。会計実績が未入力の指標は「実績未入力」と表示されます。
        </div>
      </div>
    </MainLayout>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
