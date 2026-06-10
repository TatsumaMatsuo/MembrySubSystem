"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { RefreshCw } from "lucide-react";

type Judgment = "緑" | "黄" | "赤";
interface Signal { kpiId: string; name: string; unit: string; current: number; target: number; judgment: Judgment; }
interface Rank { department: string; stars: number; }

const badge: Record<Judgment, string> = { 緑: "#16a34a", 黄: "#d97706", 赤: "#dc2626" };
const fmtNum = (v: number) => (Math.abs(v) >= 100000 ? `${(v / 100000000).toFixed(1)}億` : v.toLocaleString());

export default function SeisanDashboardPage() {
  const [period, setPeriod] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alert, setAlert] = useState<{ red: number; amber: number }>({ red: 0, amber: 0 });
  const [manuf, setManuf] = useState<Rank[]>([]);
  const [manage, setManage] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/seisan-kpi/dashboard?period=${period}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setPeriod(d.period); setElapsed(d.elapsedMonths);
      setSignals(d.signals ?? []); setAlert(d.alert ?? { red: 0, amber: 0 });
      setManuf(d.manufacturingRank ?? []); setManage(d.managementRank ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const maxStar = Math.max(1, ...manuf.map((r) => r.stars), ...manage.map((r) => r.stars));

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>生産本部 KPIダッシュボード</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{period}期 / 経過 {elapsed}ヶ月</span>
            <button onClick={load} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
          </div>
        </div>

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#78350f", marginBottom: 18 }}>
          <b>【月次レビューの進め方】</b> ①信号盤で全体把握 → ②赤・黄の件数を確認 → ③該当KPIを特定 → ④原因分析・施策決定 → ⑤★達成で各課の取組状況を確認
        </div>

        {error && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{error}</div>}

        {/* 信号盤 */}
        <div style={sectionTitle}>経営KPI 信号盤（生産本部全体・Lv2）</div>
        {loading ? <div style={{ padding: 30, color: "#64748b" }}>読み込み中…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {signals.map((s) => (
              <div key={s.kpiId} style={{ ...card, borderLeft: `6px solid ${badge[s.judgment]}`, position: "relative" }}>
                <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: "#fff", background: badge[s.judgment] }}>{s.judgment}</span>
                <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, minHeight: 34 }}>{s.name}</div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 1px" }}>{fmtNum(s.current)}<span style={{ fontSize: 12, color: "#64748b" }}> {s.unit}</span></div>
                <div style={{ fontSize: 11, color: "#64748b" }}>目標 {fmtNum(s.target)} {s.unit}</div>
              </div>
            ))}
            {signals.length === 0 && <div style={{ color: "#64748b", padding: 20 }}>Lv2 KPIの実績がありません。</div>}
          </div>
        )}

        {/* 要対応 + ★ランキング */}
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.1fr 1.1fr", gap: 16, marginTop: 8 }}>
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
          <div>
            <div style={sectionTitle}>製造部 ★達成ランキング（6課）</div>
            <div style={card}>{manuf.map((r, i) => <StarRow key={r.department} rank={i + 1} {...r} max={maxStar} crown={["🥇", "🥈", "🥉"][i]} />)}</div>
          </div>
          <div>
            <div style={sectionTitle}>生産管理部 ★達成（3課）</div>
            <div style={card}>{manage.map((r, i) => <StarRow key={r.department} rank={i + 1} {...r} max={maxStar} crown={["🥇", "🥈", "🥉"][i]} />)}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 16, lineHeight: 1.7 }}>
          信号盤・判定は <code>lib/kpi</code> 共通ロジック（緑≥95%/黄≥80%/赤）。★は各課KPIの月間目標達成数（経過月内）。基礎データ算出KPI（粗利率等）は会計データ入力後に表示。
        </div>
      </div>
    </MainLayout>
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
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#1f3864", margin: "20px 4px 10px" };
