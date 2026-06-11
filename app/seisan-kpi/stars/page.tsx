"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink } from "@/components/features/seisan-kpi";
import { RefreshCw } from "lucide-react";

const FY_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

interface StarCell { fiscalMonth: number; value: number | null; star: boolean; future: boolean }
interface StarItemRow { kpiId: string; category: string; name: string; unit: string; monthlyTarget: number; direction: string; cells: StarCell[]; total: number }
interface ManualStarRow { type: string; months: (number | null)[]; total: number }
interface DeptStars {
  department: string; items: StarItemRow[]; monthlySubtotal: number[]; autoTotal: number;
  manualRows: ManualStarRow[]; yearEndBonus: number; grandTotal: number;
}
interface StarsData {
  period: number; elapsedMonths: number; isPeriodClosed: boolean;
  manufacturing: DeptStars[]; indirect: DeptStars[];
}

const crowns = ["🥇", "🥈", "🥉"];

export default function SeisanKpiStarsPage() {
  const [data, setData] = useState<StarsData | null>(null);
  const [tab, setTab] = useState<"manufacturing" | "indirect">("manufacturing");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // 手入力編集: key=`${dept}:${type}:${fm}` → string
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/seisan-kpi/stars`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
      setEdits({});
    } catch (e: any) {
      setMessage(`読み込みエラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const depts = data ? (tab === "manufacturing" ? data.manufacturing : data.indirect) : [];
  const ranking = [...depts].map((d) => ({ department: d.department, grandTotal: d.grandTotal })).sort((a, b) => b.grandTotal - a.grandTotal);
  const maxStar = Math.max(1, ...ranking.map((r) => r.grandTotal));

  const saveAdj = async (dept: string, type: string, fm: number, val: string) => {
    try {
      const res = await fetch(`/api/seisan-kpi/stars`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: data?.period, department: dept, fiscalMonth: fm, type, delta: val === "" ? null : Number(val) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
      setMessage(`✅ ${dept} ${type} ${FY_MONTHS[fm - 1]} を保存しました`);
    } catch (e: any) {
      setMessage(`保存エラー: ${e.message}`);
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>★達成評価 ― 部署ごと</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>
              {data?.period ?? "—"}期 / 経過 {data?.elapsedMonths ?? 0}ヶ月
            </span>
            <button onClick={load} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <HelpLink section="star" />
          </div>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {([["manufacturing", "製造部(6課)"], ["indirect", "間接部門(調達・管理・検査)"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === key ? "#1f3864" : "#dde5ef", color: tab === key ? "#fff" : "#475569" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px 2px" }}>
          【ルール】月間目標達成で★{tab === "indirect" && "(経過月内の空欄も達成扱い)"} / 年間目標を期末累計で達成すると★+3(期末のみ) / 5S大賞・労災は手入力
        </div>

        {message && (
          <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
        ) : !data ? null : (
          <>
            {/* ランキング */}
            <SectionTitle>★達成ランキング(部署ごと・総合計★)</SectionTitle>
            <div style={card}>
              {ranking.map((r, i) => (
                <div key={r.department} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, fontSize: 13 }}>
                  <span style={{ width: 24, textAlign: "center", fontWeight: 800, color: "#eab308" }}>{i + 1}</span>
                  <span style={{ width: 110, fontWeight: 600 }}>{crowns[i] ?? ""} {r.department}</span>
                  <span style={{ flex: 1, height: 16, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${(r.grandTotal / maxStar) * 100}%`, background: "linear-gradient(90deg,#facc15,#eab308)", borderRadius: 8 }} />
                  </span>
                  <span style={{ width: 52, textAlign: "right", fontWeight: 800, color: "#a16207" }}>★{r.grandTotal}</span>
                </div>
              ))}
            </div>

            {/* 部署別★表 */}
            <SectionTitle>部署別 ★達成表(行=項目 × 列=月 ／ 月間目標達成で★)</SectionTitle>
            {depts.map((d) => (
              <div key={d.department} style={{ ...card, marginBottom: 16, overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                      <th style={{ ...th, ...stickyLeft, zIndex: 2, background: "#f1f5f9", textAlign: "left", minWidth: 92 }}>部署</th>
                      <th style={{ ...th, textAlign: "left", minWidth: 150 }}>項目</th>
                      <th style={th}>月間目標</th>
                      {FY_MONTHS.map((m) => <th key={m} style={th}>{m}</th>)}
                      <th style={th}>合計★</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((it, idx) => (
                      <tr key={it.kpiId}>
                        {idx === 0 && (
                          <td rowSpan={d.items.length} style={{ ...td, ...stickyLeft, background: "#fff", textAlign: "left", fontWeight: 700, verticalAlign: "top" }}>{d.department}</td>
                        )}
                        <td style={{ ...td, textAlign: "left", color: "#475569" }}>{it.category}: {it.name}</td>
                        <td style={{ ...td, color: "#64748b", fontSize: 11 }}>{it.monthlyTarget}</td>
                        {it.cells.map((c) => (
                          <td key={c.fiscalMonth} style={{ ...td, color: c.star ? "#eab308" : c.future ? "#f1f5f9" : "#e2e8f0", fontWeight: c.star ? 800 : 400 }}
                            title={c.value != null ? `実績 ${c.value}` : c.future ? "未到来" : "実績なし"}>
                            {c.future ? "" : c.star ? "★" : "・"}
                          </td>
                        ))}
                        <td style={{ ...td, background: "#fffbeb", fontWeight: 800, color: "#a16207" }}>{it.total}</td>
                      </tr>
                    ))}
                    {/* 自動小計 */}
                    <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                      <td style={{ ...td, ...stickyLeft, background: "#f8fafc" }}></td>
                      <td colSpan={2} style={{ ...td, textAlign: "right" }}>合計★数(自動)</td>
                      {d.monthlySubtotal.map((v, mi) => (
                        <td key={mi} style={td}>{mi + 1 > data.elapsedMonths ? "" : v || ""}</td>
                      ))}
                      <td style={{ ...td, background: "#fffbeb", color: "#a16207" }}>{d.autoTotal}</td>
                    </tr>
                    {/* 手入力行 */}
                    {d.manualRows.map((mr) => (
                      <tr key={mr.type} style={{ background: "#fff7ed" }}>
                        <td style={{ ...td, ...stickyLeft, background: "#fff7ed" }}></td>
                        <td colSpan={2} style={{ ...td, textAlign: "right" }}>{mr.type}(手入力)</td>
                        {mr.months.map((v, mi) => {
                          const fm = mi + 1;
                          const key = `${d.department}:${mr.type}:${fm}`;
                          const shown = edits[key] !== undefined ? edits[key] : (v ?? "");
                          return (
                            <td key={mi} style={{ ...td, padding: 2 }}>
                              <input
                                type="number"
                                value={shown}
                                onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                                onBlur={(e) => {
                                  const cur = e.target.value;
                                  if (cur !== String(v ?? "")) saveAdj(d.department, mr.type, fm, cur);
                                }}
                                style={{ width: 40, border: "1px solid #facc15", borderRadius: 4, padding: "3px 2px", textAlign: "center", fontSize: 11, background: "#fef9c3", color: "#92400e", fontWeight: 700 }}
                                placeholder={mr.type === "労災" ? "−" : "＋"}
                              />
                            </td>
                          );
                        })}
                        <td style={{ ...td, background: "#fffbeb", fontWeight: 800, color: "#a16207" }}>{mr.total}</td>
                      </tr>
                    ))}
                    {/* 総合計 */}
                    <tr style={{ background: "#1f3864", color: "#fff", fontWeight: 800 }}>
                      <td style={{ ...td, ...stickyLeft, background: "#1f3864", color: "#fff" }}></td>
                      <td colSpan={2} style={{ ...td, textAlign: "right", color: "#fff" }}>
                        総合計★数(5S・労災込{d.yearEndBonus ? ` ＋期末★${d.yearEndBonus}` : ""})
                      </td>
                      <td colSpan={12} style={{ ...td, color: "#fff" }}></td>
                      <td style={{ ...td, color: "#fff" }}>★{d.grandTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            <div style={{ fontSize: 11, color: "#64748b", padding: "0 4px", lineHeight: 1.8 }}>
              月間★は <code>SEISAN_KPI_ACTUAL</code> と月間目標の比較で自動判定(<code>lib/kpi/monthlyStar</code>)。5S大賞・労災は <code>SEISAN_KPI_STAR_ADJ</code>(手入力・セルを編集してフォーカスを外すと保存)。総合計★=自動★+期末ボーナス(年間達成で★+3)+手入力調整。部署=Lark部門。
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#1f3864", margin: "18px 4px 10px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 5, height: 15, background: "#1f3864", borderRadius: 3, display: "inline-block" }} />
      {children}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const th: React.CSSProperties = { padding: "6px 7px", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "6px 7px", border: "1px solid #e2e8f0", textAlign: "center", verticalAlign: "middle" };
const stickyLeft: React.CSSProperties = { position: "sticky", left: 0, zIndex: 1 };
