"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { JudgmentBadge } from "@/components/features/seisan-kpi";
import { RefreshCw, AlertCircle, TrendingUp } from "lucide-react";

interface Kgi {
  indicator: string;
  unit: string;
  trajectory: { period: number; target: number }[];
  actuals: { period: number; actual: number | null }[];
  finalTarget: number;
  finalPeriod: number;
  currentActual: number | null;
  attainment: number | null;
}
interface Header { planId: string; name: string; startPeriod: number; endPeriod: number; status: string; kgiSet: string[]; }
type Judgment = "緑" | "黄" | "赤";
interface CompanyRow { name: string; target: number; actual: number | null; pace: number | null; judgment: Judgment | null; major: boolean; }
interface InputStatus { account: string; unit: string; granularity: string; label: string; ok: boolean; }

const oku = (v: number | null) => (v == null ? "―" : `${(Math.round(v * 10) / 10).toFixed(1)}億`);
const pctv = (v: number | null) => (v == null ? "―" : `${Math.round(v * 100)}%`);

const fmt = (v: number | null, unit: string) =>
  v == null ? "―" : `${Math.round(v * 10) / 10}${unit}`;

function Trajectory({ kgi, basePeriod }: { kgi: Kgi; basePeriod: number }) {
  const W = 320, H = 150, padL = 38, padR = 14, padT = 16, padB = 26;
  const pts = kgi.trajectory;
  if (pts.length === 0) return null;
  const n = pts.length;
  const idxOf = new Map(pts.map((p, i) => [p.period, i]));
  const acts = (kgi.actuals ?? []).filter((a) => a.actual != null && idxOf.has(a.period)) as { period: number; actual: number }[];
  const targets = pts.map((p) => p.target);
  const all = [...targets, ...acts.map((a) => a.actual)];
  let min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  min -= span * 0.25; max += span * 0.2;
  const x = (i: number) => padL + (W - padL - padR) * (n < 2 ? 0 : i / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  let dT = "";
  pts.forEach((p, i) => { dT += (i ? "L" : "M") + x(i) + " " + y(p.target) + " "; });
  let dA = "";
  acts.forEach((a, i) => { dA += (i ? "L" : "M") + x(idxOf.get(a.period)!) + " " + y(a.actual) + " "; });
  return (
    <svg width="100%" height="150" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 10 }}>
      <text x={padL} y={11} fontSize="10" fill="#94a3b8">― 目標(線形補間) ―●― 実績(年換算)</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e2e8f0" />
      <path d={dT} fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeDasharray="5 4" />
      {pts.map((p, i) => (
        <circle key={p.period} cx={x(i)} cy={y(p.target)} r={3.5} fill="#4f46e5" />
      ))}
      {acts.length > 0 && <path d={dA} fill="none" stroke="#dc2626" strokeWidth={2} />}
      {acts.map((a) => (
        <circle key={a.period} cx={x(idxOf.get(a.period)!)} cy={y(a.actual)} r={a.period === basePeriod ? 5 : 3.5} fill="#dc2626" />
      ))}
      {pts.map((p, i) => (
        <text key={p.period} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill={p.period === basePeriod ? "#dc2626" : "#64748b"} fontWeight={p.period === basePeriod ? 700 : 400}>{p.period}期</text>
      ))}
    </svg>
  );
}

export default function KeieiDashboardPage() {
  const [header, setHeader] = useState<Header | null>(null);
  const [kgis, setKgis] = useState<Kgi[]>([]);
  const [companyKpi, setCompanyKpi] = useState<CompanyRow[]>([]);
  const [inputStatus, setInputStatus] = useState<InputStatus[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [basePeriod, setBasePeriod] = useState<number>(0);
  const [selectablePeriods, setSelectablePeriods] = useState<number[]>([]);
  const [registered, setRegistered] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (p?: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/keiei/dashboard${p ? `?period=${p}` : ""}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setHeader(d.header);
      setKgis(d.kgis ?? []);
      setCompanyKpi(d.companyKpi ?? []);
      setInputStatus(d.inputStatus ?? []);
      setElapsed(d.elapsedMonths);
      setBasePeriod(d.basePeriod);
      setSelectablePeriods(d.selectablePeriods ?? []);
      setRegistered(d.registered);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#4f46e5", margin: 0 }}>経営ダッシュボード ― 中期経営計画 進捗</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            {header && <span style={{ background: "#4f46e5", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{header.name || header.planId}（{header.startPeriod}→{header.endPeriod}期）</span>}
            {selectablePeriods.length > 0 && (
              <select value={basePeriod} onChange={(e) => load(Number(e.target.value))} title="基準期(この期時点の進捗で表示)" style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "#fff", cursor: "pointer" }}>
                {selectablePeriods.map((p) => <option key={p} value={p}>基準: {p}期</option>)}
              </select>
            )}
            <span style={{ background: "#4f46e5", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>経過 {elapsed}ヶ月</span>
            <button onClick={() => load(basePeriod || undefined)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
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
              <TrendingUp size={14} style={{ verticalAlign: "-2px" }} /> 最終年度（{header?.endPeriod}期）のKGIへの到達度。破線＝目標トラジェクトリ（線形補間）、赤線＝実績（年換算）の推移。右上の「基準期」で過去時点の進捗を振り返れます（数値・到達度は基準{basePeriod}期時点）。
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
                  <Trajectory kgi={k} basePeriod={basePeriod} />
                </div>
              ))}
            </div>
            {kgis.length === 0 && (
              <div style={{ fontSize: 13, color: "#64748b", padding: 20 }}>KGI明細が未登録です。中計マスタ管理で各年度目標を登録してください。</div>
            )}

            {/* 全社KPI(年度計画 vs 実績累計) + 会計データ入力状況 */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 20 }}>
              <div>
                <div style={sectionTitle}>全社KPI（{basePeriod}期 年度計画 vs 実績累計）</div>
                <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                        <th style={thLeft}>勘定科目</th><th style={thr}>年度目標</th><th style={thr}>実績累計</th><th style={thr}>進捗(ペース)</th><th style={thr}>判定</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyKpi.map((r) => (
                        <tr key={r.name} style={r.major ? { background: "#f8fafc" } : undefined}>
                          <td style={{ ...tdLeft, fontWeight: r.major ? 800 : 600, color: r.major ? "#4f46e5" : undefined }}>{r.name}</td>
                          <td style={tdr}>{oku(r.target)}</td>
                          <td style={tdr}>{oku(r.actual)}</td>
                          <td style={tdr}>{pctv(r.pace)}</td>
                          <td style={tdr}>{r.judgment ? <JudgmentBadge judgment={r.judgment} size="sm" /> : "―"}</td>
                        </tr>
                      ))}
                      {companyKpi.length === 0 && <tr><td colSpan={5} style={{ ...tdLeft, color: "#94a3b8", textAlign: "center", padding: 18 }}>データがありません</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", margin: "6px 4px" }}>※ 実績は会計データ入力から自動集計。詳細は「全社KPI」画面へ。</div>
              </div>

              <div>
                <div style={sectionTitle}>会計データ入力状況（本部長が一括入力）</div>
                <div style={{ ...card, padding: 12, maxHeight: 360, overflowY: "auto" }}>
                  {inputStatus.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", padding: 8 }}>科目がありません</div>
                  ) : inputStatus.map((s) => (
                    <div key={s.account} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 8, fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{s.account}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#e0e7ff", color: "#3730a3" }}>{s.granularity}</span>
                        <span style={{ fontWeight: 700, color: s.label === "未入力" ? "#dc2626" : s.ok ? "#16a34a" : "#d97706" }}>{s.label}</span>
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>粒度は科目ごとに 月別／四半期／半期。共通の年度累計に正規化して進捗算出。</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 16, lineHeight: 1.7 }}>
          実績は会計データ（KAIKEI_ACTUAL）から年換算で算出。売上＝売上高、ROA＝経常利益÷総資産、労働生産性＝控除法付加価値÷人員。会計実績が未入力の指標は「実績未入力」と表示されます。
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#4f46e5", margin: "0 4px 10px" };
const thr: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, fontSize: 11.5 };
const thLeft: React.CSSProperties = { ...thr, textAlign: "left" };
const tdr: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdLeft: React.CSSProperties = { ...tdr, textAlign: "left", fontWeight: 600 };
