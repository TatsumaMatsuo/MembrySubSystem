"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { Save, Plus, Trash2, RefreshCw } from "lucide-react";

interface PeriodRow {
  period: number;
  startDate: string;
  endDate: string;
  elapsedMonths: number;
  isCurrent: boolean;
  notes: string;
  _isNew?: boolean;
}

export default function PeriodMasterPage() {
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPeriod, setBusyPeriod] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/keiei/periods");
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* 非JSON */ }
      if (!res.ok || json.error) throw new Error(json.error || `読み込みに失敗しました (HTTP ${res.status})`);
      const list = (json.data ?? []) as any[];
      setRows(list.map((p) => ({
        period: p.period,
        startDate: p.startDate ?? "",
        endDate: p.endDate ?? "",
        elapsedMonths: p.elapsedMonths ?? 0,
        isCurrent: !!p.isCurrent,
        notes: p.notes ?? "",
      })));
    } catch (e: any) { setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setField = (idx: number, field: keyof PeriodRow, val: any) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addRow = () => {
    const maxP = rows.reduce((m, r) => Math.max(m, r.period), 0);
    setRows((prev) => [{ period: maxP + 1, startDate: "", endDate: "", elapsedMonths: 0, isCurrent: false, notes: "", _isNew: true }, ...prev]);
  };

  const saveRow = async (idx: number) => {
    const r = rows[idx];
    if (!r.period) { setMessage("期(数値)を入力してください"); return; }
    setBusyPeriod(r.period); setMessage(null);
    try {
      const res = await fetch("/api/keiei/periods", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: r.period, startDate: r.startDate, endDate: r.endDate, elapsedMonths: Number(r.elapsedMonths), isCurrent: r.isCurrent, notes: r.notes }),
      });
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* 非JSON */ }
      if (!res.ok || json.error) {
        const hint = res.status === 504 || res.status === 502 ? "（サーバ処理が時間内に完了しませんでした）" : "";
        throw new Error(json.error || `保存に失敗しました (HTTP ${res.status})${hint}`);
      }
      setMessage(`✅ ${r.period}期を保存しました`);
      await load();
    } catch (e: any) { setMessage(`保存エラー: ${e.message}`); }
    finally { setBusyPeriod(null); }
  };

  const deleteRow = async (idx: number) => {
    const r = rows[idx];
    if (r._isNew) { setRows((prev) => prev.filter((_, i) => i !== idx)); return; }
    if (!window.confirm(`${r.period}期の期マスタを削除します。よろしいですか？（実績などの関連データは削除されません）`)) return;
    setBusyPeriod(r.period); setMessage(null);
    try {
      const res = await fetch(`/api/keiei/periods?period=${r.period}`, { method: "DELETE" });
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* 非JSON */ }
      if (!res.ok || json.error) throw new Error(json.error || `削除に失敗しました (HTTP ${res.status})`);
      setMessage(`🗑️ ${r.period}期を削除しました`);
      await load();
    } catch (e: any) { setMessage(`削除エラー: ${e.message}`); }
    finally { setBusyPeriod(null); }
  };

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#4f46e5", margin: 0 }}>期マスタ管理</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={addRow} style={ghostBtn}><Plus size={13} style={{ verticalAlign: "-2px" }} /> 期を追加</button>
            <button onClick={load} style={ghostBtn}><RefreshCw size={13} style={{ verticalAlign: "-2px" }} /> 再読込</button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, padding: "8px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, lineHeight: 1.6 }}>
          ℹ️ 期（会計年度）は<b>全社共通のマスタ</b>です。ここで登録した期は、<b>経営</b>（会計データ入力・中計）と<b>生産本部KPI</b>の両方で参照されます。<b>当期</b>は常に1つだけ設定でき、チェックを付けて保存すると他の期の当期は自動で外れます。
        </div>

        {message && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : message.startsWith("🗑️") ? "#f1f5f9" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : message.startsWith("🗑️") ? "#475569" : "#991b1b" }}>{message}</div>}

        <div style={{ ...card, padding: 6, overflowX: "auto" }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                  <th style={th}>期</th><th style={th}>期間開始日</th><th style={th}>期間終了日</th>
                  <th style={th}>経過月数</th><th style={th}>当期</th><th style={th}>備考</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>期が未登録です。「期を追加」から登録してください。</td></tr>}
                {rows.map((r, idx) => (
                  <tr key={`${r.period}-${idx}`} style={{ background: r.isCurrent ? "#eef2ff" : undefined }}>
                    <td style={td}><input type="number" value={r.period} disabled={!r._isNew} onChange={(e) => setField(idx, "period", Number(e.target.value))} style={{ ...inpS, width: 72, background: r._isNew ? "#fff" : "#f8fafc", fontWeight: 700 }} /></td>
                    <td style={td}><input type="date" value={r.startDate} onChange={(e) => setField(idx, "startDate", e.target.value)} style={{ ...inpS, width: 140 }} /></td>
                    <td style={td}><input type="date" value={r.endDate} onChange={(e) => setField(idx, "endDate", e.target.value)} style={{ ...inpS, width: 140 }} /></td>
                    <td style={td}><input type="number" value={r.elapsedMonths} onChange={(e) => setField(idx, "elapsedMonths", Number(e.target.value))} style={{ ...inpS, width: 64 }} /></td>
                    <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={r.isCurrent} onChange={(e) => setField(idx, "isCurrent", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} /></td>
                    <td style={td}><input value={r.notes} onChange={(e) => setField(idx, "notes", e.target.value)} placeholder="備考" style={{ ...inpS, width: 180, textAlign: "left" }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => saveRow(idx)} disabled={busyPeriod === r.period} style={{ ...primaryBtn, marginRight: 6 }}>
                        <Save size={12} style={{ verticalAlign: "-2px" }} /> {busyPeriod === r.period ? "…" : "保存"}
                      </button>
                      <button onClick={() => deleteRow(idx)} disabled={busyPeriod === r.period} style={{ ...ghostBtn, color: "#dc2626" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const inpS: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 7px", fontSize: 12.5, textAlign: "right" };
const th: React.CSSProperties = { padding: "8px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11.5 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "center" };
const ghostBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 11px", fontSize: 12, color: "#4f46e5", cursor: "pointer", fontWeight: 600 };
const primaryBtn: React.CSSProperties = { background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 12, cursor: "pointer", fontWeight: 600 };
