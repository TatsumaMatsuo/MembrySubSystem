"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink, JudgmentBadge, JUDGMENT_COLORS } from "@/components/features/seisan-kpi";
import { useIsMobile } from "@/lib/use-is-mobile";
import { fetchJson } from "@/lib/fetch-json";
import { RefreshCw } from "lucide-react";

type Judgment = "緑" | "黄" | "赤";
interface Signal { kpiId: string; name: string; unit: string; current: number; target: number; judgment: Judgment; }
interface AlertRow { kpiId: string; name: string; department: string; level: string; unit: string; current: number; target: number; judgment: Judgment; }
interface Trend { kpiId: string; name: string; unit: string; target: number; monthly: (number | null)[]; }
interface Rank { department: string; stars: number; }
const FY_MONTHS = ["8", "9", "10", "11", "12", "1", "2", "3", "4", "5", "6", "7"];
const fmtNum = (v: number) => (Math.abs(v) >= 100000 ? `${(v / 100000000).toFixed(1)}億` : v.toLocaleString());

export default function SeisanDashboardPage() {
  const [period, setPeriod] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alert, setAlert] = useState<{ red: number; amber: number }>({ red: 0, amber: 0 });
  const [alertList, setAlertList] = useState<AlertRow[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [measureKv, setMeasureKv] = useState<{ 継続: number; 強化: number; 見直し: number; 完了: number; 改善: number; 悪化: number }>({ 継続: 0, 強化: 0, 見直し: 0, 完了: 0, 改善: 0, 悪化: 0 });
  const [manuf, setManuf] = useState<Rank[]>([]);
  const [manage, setManage] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const isMobile = useIsMobile();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const json = await fetchJson<{ data: any; error?: string }>(`/api/seisan-kpi/dashboard?period=${period}`);
      const d = json.data;
      setPeriod(d.period); setElapsed(d.elapsedMonths);
      setSignals(d.signals ?? []); setAlert(d.alert ?? { red: 0, amber: 0 });
      setAlertList(d.alertList ?? []);
      setTrends(d.trends ?? []);
      setManuf(d.manufacturingRank ?? []); setManage(d.managementRank ?? []);
      // 施策の進捗(当期): 過去施策参照APIを当期で集計
      try {
        const pj = await fetchJson<{ data?: { rows?: { lastAction: string; lastEffect: string }[] } }>(`/api/seisan-kpi/measures/past?period=${d.period}`);
        const kv = { 継続: 0, 強化: 0, 見直し: 0, 完了: 0, 改善: 0, 悪化: 0 };
        for (const m of (pj.data?.rows ?? []) as { lastAction: string; lastEffect: string }[]) {
          if (m.lastAction in kv) (kv as any)[m.lastAction]++;
          if (m.lastEffect === "改善") kv.改善++; else if (m.lastEffect === "悪化") kv.悪化++;
        }
        setMeasureKv(kv);
      } catch { /* noop */ }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const maxStar = Math.max(1, ...manuf.map((r) => r.stars), ...manage.map((r) => r.stars));

  // 要対応KPI明細の抽出条件(部署・レベル)。選択肢は明細データから動的生成
  const alertDepts = Array.from(new Set(alertList.map((r) => r.department).filter(Boolean)));
  const alertLevels = Array.from(new Set(alertList.map((r) => r.level).filter(Boolean))).sort();
  const filteredAlertList = alertList.filter(
    (r) => (!filterDept || r.department === filterDept) && (!filterLevel || r.level === filterLevel)
  );

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>KPIダッシュボード</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{period}期 / 経過 {elapsed}ヶ月</span>
            <button onClick={load} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <HelpLink section="features" />
          </div>
        </div>

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#78350f", marginBottom: 18 }}>
          <b>【月次レビューの進め方】</b> ①信号盤で全体把握 → ②赤・黄の件数を確認 → ③該当KPIを特定 → ④原因分析・施策決定 → ⑤★達成で各課の取組状況を確認
        </div>

        {error && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{error}</div>}

        {/* 信号盤 ＋ 要対応KPI を横並び（Web）。モバイルは縦積み */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,2.4fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
          <div>
            <div style={sectionTitle}>経営KPI 信号盤（生産本部全体・Lv2）</div>
            {loading ? <div style={{ padding: 30, color: "#64748b" }}>読み込み中…</div> : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 14 }}>
                {signals.map((s) => (
                  <div key={s.kpiId} style={{ ...card, borderLeft: `6px solid ${JUDGMENT_COLORS[s.judgment]}`, position: "relative" }}>
                    <span style={{ position: "absolute", top: 14, right: 14 }}><JudgmentBadge judgment={s.judgment} size="sm" /></span>
                    <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, minHeight: 34 }}>{s.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 1px" }}>{fmtNum(s.current)}<span style={{ fontSize: 12, color: "#64748b" }}> {s.unit}</span></div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>目標 {fmtNum(s.target)} {s.unit}</div>
                  </div>
                ))}
                {signals.length === 0 && <div style={{ color: "#64748b", padding: 20 }}>Lv2 KPIの実績がありません。</div>}
              </div>
            )}
          </div>
          <div>
            <div style={sectionTitle}>要対応KPI</div>
            <div style={card}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "#fef2f2", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{alert.red}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>「赤」判定</div>
                </div>
                <div style={{ flex: 1, background: "#fffbeb", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>{alert.amber}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>「黄」判定</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ★達成ランキング（製造部 / 生産管理部）を横並び */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <div style={sectionTitle}>製造部 ★達成ランキング（6課）</div>
            <div style={card}>{manuf.map((r, i) => <StarRow key={r.department} rank={i + 1} {...r} max={maxStar} crown={["🥇", "🥈", "🥉"][i]} />)}</div>
          </div>
          <div>
            <div style={sectionTitle}>生産管理部 ★達成（3課）</div>
            <div style={card}>{manage.map((r, i) => <StarRow key={r.department} rank={i + 1} {...r} max={maxStar} crown={["🥇", "🥈", "🥉"][i]} />)}</div>
          </div>
        </div>

        {/* 要対応KPI 明細 */}
        <div style={sectionTitle}>要対応KPI 一覧（赤・黄判定）</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 4px 10px", fontSize: 13 }}>
          <span style={{ color: "#64748b", fontWeight: 600 }}>抽出条件</span>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={selStyle}>
            <option value="">部署: すべて</option>
            {alertDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={selStyle}>
            <option value="">レベル: すべて</option>
            {alertLevels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </select>
          {(filterDept || filterLevel) && (
            <button onClick={() => { setFilterDept(""); setFilterLevel(""); }} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", color: "#64748b" }}>条件クリア</button>
          )}
          <span style={{ color: "#94a3b8", marginLeft: "auto" }}>{filteredAlertList.length} 件</span>
        </div>
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                <th style={thL}>KPI</th><th style={thL}>部署</th><th style={th}>レベル</th><th style={th}>目標</th><th style={th}>実績</th><th style={th}>判定</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlertList.map((r) => (
                <tr key={r.kpiId} style={{ background: r.judgment === "赤" ? "#fef2f2" : "#fffbeb" }}>
                  <td style={tdL}>{r.name}</td>
                  <td style={tdL}>{r.department}</td>
                  <td style={td}>{r.level}</td>
                  <td style={td}>{fmtNum(r.target)} {r.unit}</td>
                  <td style={td}>{fmtNum(r.current)} {r.unit}</td>
                  <td style={td}><JudgmentBadge judgment={r.judgment} size="sm" /></td>
                </tr>
              ))}
              {alertList.length === 0 && !loading && <tr><td colSpan={6} style={{ ...tdL, textAlign: "center", color: "#16a34a", padding: 18, fontWeight: 700 }}>要対応KPIはありません（全て緑）</td></tr>}
              {alertList.length > 0 && filteredAlertList.length === 0 && <tr><td colSpan={6} style={{ ...tdL, textAlign: "center", color: "#94a3b8", padding: 18 }}>抽出条件に該当するKPIがありません。</td></tr>}
            </tbody>
          </table>
        </div>

        {/* 施策の進捗 */}
        <div style={sectionTitle}>施策の進捗（当期・翌月アクション / 効果）</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(6,1fr)", gap: 12 }}>
          {([["継続", measureKv.継続, "#1f3864"], ["強化", measureKv.強化, "#2563eb"], ["見直し", measureKv.見直し, "#d97706"], ["完了", measureKv.完了, "#16a34a"], ["効果:改善", measureKv.改善, "#16a34a"], ["効果:悪化", measureKv.悪化, "#dc2626"]] as const).map(([label, n, color]) => (
            <div key={label} style={{ ...card, textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{n}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 経営KPIトレンド */}
        <div style={sectionTitle}>経営KPI トレンド（Lv2・月次推移）</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 16 }}>
          {trends.map((t) => <TrendChart key={t.kpiId} trend={t} />)}
          {trends.length === 0 && !loading && <div style={{ color: "#64748b", padding: 12 }}>トレンド対象KPIがありません。</div>}
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 16, lineHeight: 1.7 }}>
          信号盤・判定は <code>lib/kpi</code> 共通ロジック（緑≥95%/黄≥80%/赤）。★は各課KPIの月間目標達成数（経過月内）。基礎データ算出KPI（粗利率等）は会計データ入力後に表示。
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

function TrendChart({ trend }: { trend: Trend }) {
  const W = 460, H = 150, padL = 36, padR = 12, padT = 24, padB = 24;
  const pts = trend.monthly.map((v, i) => ({ i, v })).filter((p) => p.v != null) as { i: number; v: number }[];
  const vals = [...pts.map((p) => p.v), trend.target];
  let min = Math.min(...vals, 0), max = Math.max(...vals, trend.target);
  const span = (max - min) || 1; max += span * 0.15;
  const x = (i: number) => padL + (W - padL - padR) * (i / 11);
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  let d = ""; pts.forEach((p, k) => { d += (k ? "L" : "M") + x(p.i) + " " + y(p.v) + " "; });
  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>{trend.name}<span style={{ color: "#94a3b8", fontWeight: 400 }}> ({trend.unit})</span></div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <text x={padL} y={12} fontSize="10" fill="#94a3b8">― 実績（月次） ‑‑ 月次目標 {trend.target}</text>
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e2e8f0" />
        {trend.target ? <line x1={padL} y1={y(trend.target)} x2={W - padR} y2={y(trend.target)} stroke="#16a34a" strokeWidth={1} strokeDasharray="4 3" /> : null}
        {pts.length > 0 && <path d={d} fill="none" stroke="#1f3864" strokeWidth={2} />}
        {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.6} fill="#1f3864" />)}
        {FY_MONTHS.map((m, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{m}</text>)}
      </svg>
    </div>
  );
}

function StarRow({ rank, department, stars, max, crown }: { rank: number; department: string; stars: number; max: number; crown?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, fontSize: 13 }}>
      <span style={{ width: 22, textAlign: "center", fontWeight: 800, color: "#eab308", fontSize: 12 }}>{rank}</span>
      <span style={{ width: 96, fontWeight: 600 }}>{crown ?? ""} {department}</span>
      <span style={{ flex: 1, height: 14, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${(stars / max) * 100}%`, background: "linear-gradient(90deg,#facc15,#eab308)", borderRadius: 8 }} />
      </span>
      <span style={{ width: 48, textAlign: "right", fontWeight: 800, color: "#a16207" }}>★{stars}</span>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const selStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff", color: "#1f3864" };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#1f3864", margin: "20px 4px 10px" };
const th: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, fontSize: 11.5 };
const thL: React.CSSProperties = { ...th, textAlign: "left" };
const td: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdL: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600 };
