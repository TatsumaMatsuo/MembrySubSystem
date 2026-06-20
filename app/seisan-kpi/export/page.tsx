"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink } from "@/components/features/seisan-kpi";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type ExportType = "actuals" | "measures" | "stars";
const DATASETS: { key: ExportType; label: string; desc: string }[] = [
  { key: "actuals", label: "KPI実績", desc: "KPIマスタ × 月次実績 + 現在値/判定(全部署)" },
  { key: "measures", label: "施策ログ", desc: "重点施策 × 月次PDCA(計画/実施/効果/翌月アクション)" },
  { key: "stars", label: "★達成表", desc: "部署 × 項目 × 月の★達成 + 部署総合計(製造/間接)" },
];

export default function SeisanKpiExportPage() {
  const [type, setType] = useState<ExportType>("actuals");
  const [period, setPeriod] = useState<number>(50);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (t: ExportType) => {
    setLoading(true); setMessage(null);
    try {
      const json = await fetchJson(`/api/seisan-kpi/export?type=${t}&format=json`);
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setPeriod(d.period);
      setRows(d.rows ?? []);
      setCols(d.rows?.length ? Object.keys(d.rows[0]) : []);
    } catch (e: any) { setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(type); /* eslint-disable-next-line */ }, [type]);

  const download = (format: "csv" | "xlsx") => {
    window.location.href = `/api/seisan-kpi/export?type=${type}&format=${format}&period=${period}`;
  };

  const current = DATASETS.find((d) => d.key === type)!;
  const previewRows = rows.slice(0, 50);

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }} className="no-print">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>データエクスポート</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>{period}期</span>
            <button onClick={() => load(type)} style={btn}><RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込</button>
            <HelpLink section="features" />
          </div>
        </div>

        {message && <div className="no-print" style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#fef2f2", color: "#991b1b" }}>{message}</div>}

        {/* データ種別選択 */}
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
          {DATASETS.map((d) => {
            const sel = d.key === type;
            return (
              <button key={d.key} onClick={() => setType(d.key)}
                style={{ textAlign: "left", border: sel ? "2px solid #1f3864" : "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: sel ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                <div style={{ fontWeight: 700, color: "#1f3864", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><FileText size={15} /> {d.label}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>{d.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 出力ボタン */}
        <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={() => download("csv")} disabled={!rows.length} style={btnPrimary}><Download size={14} style={{ verticalAlign: "-2px" }} /> CSV出力</button>
          <button onClick={() => download("xlsx")} disabled={!rows.length} style={btnPrimary}><Download size={14} style={{ verticalAlign: "-2px" }} /> Excel出力</button>
          <button onClick={() => window.print()} disabled={!rows.length} style={btn}><Printer size={14} style={{ verticalAlign: "-2px" }} /> PDF出力(印刷)</button>
          <span style={{ fontSize: 12, color: "#64748b" }}>{loading ? "読み込み中…" : `${rows.length}件`}（プレビューは先頭50件・CSV/Excelは全件）</span>
        </div>

        {/* プレビュー(印刷対象) */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, overflowX: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1f3864", marginBottom: 8 }}>{current.label}(生産本部KPI {period}期）</div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
            : rows.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>データがありません。</div>
            : (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                    {cols.map((c) => <th key={c} style={th}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>{cols.map((c) => <td key={c} style={td}>{String(r[c] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
          {rows.length > 50 && <div className="no-print" style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>… 他 {rows.length - 50} 件(CSV/Excel出力で全件取得できます)</div>}
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

const btn: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1f3864" };
const btnPrimary: React.CSSProperties = { border: "none", borderRadius: 8, padding: "8px 16px", background: "#1f3864", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const th: React.CSSProperties = { padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "left", fontWeight: 600, fontSize: 10.5 };
const td: React.CSSProperties = { padding: "5px 8px", border: "1px solid #f1f5f9", textAlign: "left" };
