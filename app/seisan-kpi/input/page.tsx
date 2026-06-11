"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink } from "@/components/features/seisan-kpi";
import { Save, RefreshCw, Lock, AlertCircle, Check } from "lucide-react";
import {
  aggregate,
  judge,
  type AggType,
  type Direction,
  type Judgment,
  type MonthlyActual,
} from "@/lib/kpi";

interface InputRow {
  kpiId: string;
  level: string;
  department: string;
  category: string;
  kpiName: string;
  unit: string;
  aggType: AggType;
  direction: Direction;
  annualTarget: number;
  monthlyTarget: number;
  months: { fiscalMonth: number; value: number | null; recordId?: string }[];
  current: number;
  judgment: Judgment;
}

const FY_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

const badgeColor: Record<Judgment, string> = {
  緑: "#16a34a",
  黄: "#d97706",
  赤: "#dc2626",
};

export default function SeisanKpiInputPage() {
  const [period, setPeriod] = useState<number>(50);
  const [elapsed, setElapsed] = useState<number>(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dept, setDept] = useState<string>("");
  const [rows, setRows] = useState<InputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // 編集中の値: key = `${kpiId}:${fiscalMonth}` → string
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async (p?: number, d?: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (p) params.set("period", String(p));
      if (d) params.set("dept", d);
      const res = await fetch(`/api/seisan-kpi/input?${params.toString()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const data = json.data;
      setPeriod(data.period);
      setElapsed(data.elapsedMonths);
      setDepartments(data.departments ?? []);
      if (!d && data.departments?.length) setDept(data.departments[0]);
      setRows(data.rows ?? []);
      setEdits({});
    } catch (e: any) {
      setMessage(`読み込みエラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 部署変更
  const onDeptChange = (d: string) => {
    setDept(d);
    load(period, d);
  };

  // 入力中の行から、即時に現在値/判定を再計算
  const recompute = (row: InputRow): { current: number; judgment: Judgment } => {
    const ma: MonthlyActual[] = row.months.map((m) => {
      const key = `${row.kpiId}:${m.fiscalMonth}`;
      const edited = edits[key];
      const value = edited !== undefined ? (edited === "" ? null : Number(edited)) : m.value;
      return { fiscalMonth: m.fiscalMonth, value };
    });
    const current = aggregate(row.aggType, ma, elapsed);
    const judgment = judge(
      { aggType: row.aggType, direction: row.direction, annualTarget: row.annualTarget },
      current,
      elapsed
    );
    return { current, judgment };
  };

  const setEdit = (kpiId: string, fm: number, val: string) => {
    setEdits((e) => ({ ...e, [`${kpiId}:${fm}`]: val }));
  };

  const dirtyItems = useMemo(() => {
    const items: { period: number; kpiId: string; fiscalMonth: number; value: number | null }[] = [];
    for (const [key, val] of Object.entries(edits)) {
      const [kpiId, fmStr] = key.split(":");
      items.push({
        period,
        kpiId,
        fiscalMonth: Number(fmStr),
        value: val === "" ? null : Number(val),
      });
    }
    return items;
  }, [edits, period]);

  const save = async () => {
    if (dirtyItems.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seisan-kpi/actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: dirtyItems }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessage(`✅ ${json.data.saved}件を保存しました`);
      await load(period, dept);
    } catch (e: any) {
      setMessage(`保存エラー: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 入力対象月 = 経過月数の次の月(確定済みは elapsed まで)
  const inputTargetFm = elapsed + 1;

  return (
    <MainLayout>
      <div style={{ padding: "20px", maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>
            KPI実績入力 ― 月次実績
          </h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>
              {period}期 / 経過 {elapsed}ヶ月
            </span>
            <select
              value={dept}
              onChange={(e) => onDeptChange(e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" }}
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={() => load(period, dept)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}
            >
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <HelpLink section="timing" />
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          <span style={{ display: "inline-block", width: 11, height: 11, background: "#fef9c3", border: "1px solid #facc15", verticalAlign: "-1px", marginRight: 4 }} />
          入力対象月({FY_MONTHS[inputTargetFm - 1] ?? "—"})
          <span style={{ display: "inline-block", width: 11, height: 11, background: "#f1f5f9", verticalAlign: "-1px", margin: "0 4px 0 12px" }} />
          確定済み(ロック)
          <span style={{ marginLeft: 12 }}>数値入力で判定が即時更新されます。</span>
        </div>

        {message && (
          <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
            {message}
          </div>
        )}

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 6, overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>該当KPIがありません。</div>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                  <th style={thLeft}>KPI名称</th>
                  <th style={th}>単位</th>
                  <th style={th}>年間目標</th>
                  <th style={th}>月割</th>
                  {FY_MONTHS.map((m, i) => (
                    <th key={m} style={{ ...th, background: i + 1 === inputTargetFm ? "#fef9c3" : undefined, color: i + 1 === inputTargetFm ? "#92400e" : undefined }}>{m}</th>
                  ))}
                  <th style={th}>年累計/平均</th>
                  <th style={th}>判定</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { current, judgment } = recompute(row);
                  return (
                    <tr key={row.kpiId}>
                      <td style={tdLeft}>{row.kpiName}</td>
                      <td style={tdSub}>{row.unit}</td>
                      <td style={tdSub}>{row.annualTarget}</td>
                      <td style={tdSub}>{row.monthlyTarget}</td>
                      {row.months.map((m) => {
                        const locked = m.fiscalMonth <= elapsed;
                        const isTarget = m.fiscalMonth === inputTargetFm;
                        const key = `${row.kpiId}:${m.fiscalMonth}`;
                        const editVal = edits[key];
                        const shown = editVal !== undefined ? editVal : m.value ?? "";
                        const future = m.fiscalMonth > inputTargetFm;
                        if (future) {
                          return <td key={m.fiscalMonth} style={{ ...tdMon, background: "#fafafa", color: "#cbd5e1" }}>―</td>;
                        }
                        return (
                          <td key={m.fiscalMonth} style={{ ...tdMon, background: locked ? "#f1f5f9" : isTarget ? "#fef9c3" : undefined }}>
                            {locked ? (
                              <span style={{ color: "#94a3b8" }}>{m.value ?? "―"}</span>
                            ) : (
                              <input
                                type="number"
                                value={shown}
                                onChange={(e) => setEdit(row.kpiId, m.fiscalMonth, e.target.value)}
                                style={{ width: 52, border: isTarget ? "2px solid #facc15" : "1px solid #e2e8f0", borderRadius: 4, padding: "3px 4px", textAlign: "right", fontSize: 12 }}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td style={{ ...tdMon, background: "#f8fafc", fontWeight: 700 }}>
                        {Number.isFinite(current) ? Math.round(current * 100) / 100 : "―"}
                      </td>
                      <td style={tdMon}>
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: "#fff", background: badgeColor[judgment] }}>
                          {judgment}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button
            onClick={save}
            disabled={saving || dirtyItems.length === 0}
            style={{ background: dirtyItems.length ? "#1f3864" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: dirtyItems.length ? "pointer" : "default" }}
          >
            <Save size={14} style={{ verticalAlign: "-2px" }} /> {saving ? "保存中…" : `保存 (${dirtyItems.length}件)`}
          </button>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            <Lock size={11} style={{ verticalAlign: "-1px" }} /> 確定済み月は編集不可。基礎データ算出KPI(粗利率等)は「経営」エリアの会計データから算出されます。
          </span>
        </div>
      </div>
    </MainLayout>
  );
}

const th: React.CSSProperties = { padding: "7px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11 };
const thLeft: React.CSSProperties = { ...th, textAlign: "left", minWidth: 160 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "center" };
const tdLeft: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600 };
const tdSub: React.CSSProperties = { ...td, color: "#64748b" };
const tdMon: React.CSSProperties = { ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" };
