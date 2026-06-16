"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { JudgmentBadge } from "@/components/features/seisan-kpi";
import { useIsMobile } from "@/lib/use-is-mobile";
import { RefreshCw, AlertCircle } from "lucide-react";

type Judgment = "緑" | "黄" | "赤";

interface PlRow {
  name: string;
  target: number;
  monthlyTarget: number | null;
  actual: number | null;
  pace: number | null;
  landing: number | null;
  judgment: Judgment | null;
  major: boolean;
  dir: "高" | "少";
}
interface OtherRow { name: string; target: string; actual: string; judgment: Judgment | null; }

const oku = (v: number | null) => (v == null ? "―" : `${(Math.round(v * 10) / 10).toFixed(1)}億`);
const pct = (v: number | null) => (v == null ? "―" : `${Math.round(v * 100)}%`);

function PaceBar({ p, judgment }: { p: number | null; judgment: Judgment | null }) {
  if (p == null) return <>―</>;
  const w = Math.min(Math.round(p * 100), 100);
  const color = judgment === "緑" ? "#16a34a" : judgment === "赤" ? "#dc2626" : "#d97706";
  return (
    <div>
      <div style={{ height: 7, borderRadius: 6, background: "#e2e8f0", overflow: "hidden", minWidth: 80, marginLeft: "auto" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{Math.round(p * 100)}%</div>
    </div>
  );
}

export default function CompanyKpiPage() {
  const [period, setPeriod] = useState(50);
  const [selectablePeriods, setSelectablePeriods] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hasActuals, setHasActuals] = useState(true);
  const [plRows, setPlRows] = useState<PlRow[]>([]);
  const [otherRows, setOtherRows] = useState<OtherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const load = async (p?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/keiei/company-kpi${p ? `?period=${p}` : ""}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setPeriod(d.period);
      setSelectablePeriods(d.selectablePeriods ?? []);
      setElapsed(d.elapsedMonths);
      setHasActuals(d.hasActuals);
      setPlRows(d.plRows ?? []);
      setOtherRows(d.otherRows ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = plRows.filter((r) => ["売上高", "営業利益", "経常利益"].includes(r.name));

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#4f46e5", margin: 0 }}>全社KPI ― 年度計画 vs 実績</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            {selectablePeriods.length > 0 && (
              <select value={period} onChange={(e) => load(Number(e.target.value))} title="表示する期" style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "#fff", cursor: "pointer" }}>
                {selectablePeriods.map((p) => <option key={p} value={p}>{p}期</option>)}
              </select>
            )}
            <span style={{ background: "#4f46e5", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>経過 {elapsed}ヶ月</span>
            <button onClick={() => load(period || undefined)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
          </div>
        </div>

        {!hasActuals && !loading && (
          <div style={{ fontSize: 13, padding: "9px 14px", borderRadius: 10, marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
            <AlertCircle size={14} style={{ verticalAlign: "-2px" }} /> 会計実績(KAIKEI_ACTUAL)が未入力です。年度目標のみ表示しています。「会計データ入力」で実績を入れると進捗・判定が出ます。
          </div>
        )}
        {error && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{error}</div>}

        {/* サマリーカード */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
          {summary.map((r) => (
            <div key={r.name} style={card}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{r.name}{r.name === "経常利益" ? "（ROA分子）" : ""}</div>
              <div style={{ fontSize: 26, fontWeight: 800, margin: "4px 0 2px" }}>{oku(r.actual)}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                年度目標 {oku(r.target)} ／ 着地見込 {oku(r.landing)} {r.judgment && <span style={{ marginLeft: 4 }}><JudgmentBadge judgment={r.judgment} size="sm" /></span>}
              </div>
            </div>
          ))}
        </div>

        {/* PL */}
        <div style={sectionTitle}>損益計算書ベース（年度計画 vs 実績累計）</div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
          ) : (
            <table style={table}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                  <th style={thLeft}>科目</th><th style={th}>年度目標</th><th style={th}>月次目標</th>
                  <th style={th}>実績累計</th><th style={th}>進捗(ペース)</th><th style={th}>着地見込</th><th style={th}>判定</th>
                </tr>
              </thead>
              <tbody>
                {plRows.map((r) => (
                  <tr key={r.name} style={r.major ? { background: "#f8fafc" } : undefined}>
                    <td style={{ ...tdLeft, fontWeight: r.major ? 800 : 600, color: r.major ? "#4f46e5" : undefined }}>{r.name}</td>
                    <td style={td}>{oku(r.target)}</td>
                    <td style={td}>{r.monthlyTarget ? oku(r.monthlyTarget) : "―"}</td>
                    <td style={td}>{oku(r.actual)}</td>
                    <td style={td}><PaceBar p={r.pace} judgment={r.judgment} /></td>
                    <td style={td}>{oku(r.landing)}</td>
                    <td style={td}>{r.judgment ? <JudgmentBadge judgment={r.judgment} size="sm" /> : "―"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", margin: "8px 4px" }}>
          進捗(ペース)=実績累計 ÷ (年度目標×経過月/12)。着地見込=実績累計 ÷ 経過月 ×12。判定 緑≥95%/黄≥80%/赤。
        </div>
        <a href="/seisan-kpi/dashboard" style={{ display: "inline-block", fontSize: 12, color: "#2563eb", margin: "4px 4px 0", textDecoration: "none" }}>▶ 生産本部KPI（Lv2 粗利率/総資産回転率/材料金額比率）へ ― 同一の会計データを参照</a>

        {/* 率・その他 */}
        <div style={sectionTitle}>限界利益・率・その他計画（年度計画 vs 実績）</div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflowX: "auto" }}>
          <table style={table}>
            <thead><tr style={{ background: "#f1f5f9", color: "#64748b" }}><th style={thLeft}>指標</th><th style={th}>目標</th><th style={th}>実績</th><th style={th}>判定</th></tr></thead>
            <tbody>
              {otherRows.map((r) => (
                <tr key={r.name}><td style={tdLeft}>{r.name}</td><td style={td}>{r.target}</td><td style={td}>{r.actual}</td><td style={td}>{r.judgment ? <JudgmentBadge judgment={r.judgment} size="sm" /> : "―"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", margin: "8px 4px" }}>
          実績算出: 限界利益=売上高−変動費 / 固定費=限界利益−営業利益 / 製造原価率=製造原価÷売上高 / 外注発注率=外注費÷製造原価 / 人員=人員数。「会計データ入力」で変動費・外注費を入れると実績・判定が出ます。
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 14, lineHeight: 1.7 }}>
          年度目標＝既存「全社KPI（COMPANY_KPI）」。実績＝会計データ（KAIKEI_ACTUAL／月・四半期・半期を年度累計に正規化）。ROA分子＝経常利益。
          粗利・売上原価は会計実績の製造原価から算出。
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#4f46e5", margin: "20px 4px 10px" };
const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 12.5 };
const th: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, fontSize: 11.5 };
const thLeft: React.CSSProperties = { ...th, textAlign: "left" };
const td: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdLeft: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600 };
