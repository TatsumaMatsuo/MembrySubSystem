"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink, JudgmentBadge } from "@/components/features/seisan-kpi";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Save, RefreshCw, Lock, AlertCircle, Check } from "lucide-react";
import {
  aggregate,
  judge,
  attainmentRate,
  type AggType,
  type Direction,
  type Judgment,
  type MonthlyActual,
} from "@/lib/kpi";
import { fetchJson } from "@/lib/fetch-json";

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
  attainment: number;
  judgment: Judgment;
  readOnly?: boolean;
}
interface BasicRow { kpiId: string; kpiName: string; department: string; level: string; unit: string; annualTarget: number; category: string; }

const FY_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

/** 数値を小数点以下1桁で表示(null/非数は ―) */
function fmt1(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "―" : (Math.round(v * 10) / 10).toFixed(1);
}
/** 入力文字列を小数点以下1桁までに制限(2桁目以降を切り捨て) */
function limit1(s: string): string {
  if (s === "" || s === "-") return s;
  const m = s.match(/^-?\d*\.?\d?/);
  return m ? m[0] : s;
}

export default function SeisanKpiInputPage() {
  const [period, setPeriod] = useState<number>(50);
  const [elapsed, setElapsed] = useState<number>(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dept, setDept] = useState<string>("");
  const [rows, setRows] = useState<InputRow[]>([]);
  const [basicRows, setBasicRows] = useState<BasicRow[]>([]);
  const [tab, setTab] = useState<"通常" | "基礎">("通常");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // 編集中の値: key = `${kpiId}:${fiscalMonth}` → string
  const [edits, setEdits] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  const load = useCallback(async (p?: number, d?: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (p) params.set("period", String(p));
      if (d) params.set("dept", d);
      const json = await fetchJson(`/api/seisan-kpi/input?${params.toString()}`);
      if (json.error) throw new Error(json.error);
      const data = json.data;
      setPeriod(data.period);
      setElapsed(data.elapsedMonths);
      setDepartments(data.departments ?? []);
      if (!d && data.departments?.length) setDept(data.departments[0]);
      setRows(data.rows ?? []);
      setBasicRows(data.basicRows ?? []);
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
  const recompute = (row: InputRow): { current: number; attainment: number; judgment: Judgment } => {
    const ma: MonthlyActual[] = row.months.map((m) => {
      const key = `${row.kpiId}:${m.fiscalMonth}`;
      const edited = edits[key];
      const value = edited !== undefined ? (edited === "" ? null : Number(edited)) : m.value;
      return { fiscalMonth: m.fiscalMonth, value };
    });
    const current = aggregate(row.aggType, ma, elapsed);
    const mst = { aggType: row.aggType, direction: row.direction, annualTarget: row.annualTarget };
    const attainment = attainmentRate(mst, current, elapsed);
    const judgment = judge(mst, current, elapsed);
    return { current, attainment, judgment };
  };
  const fmtPct = (v: number) => (!Number.isFinite(v) ? "―" : `${Math.round(v * 100)}%`);

  const setEdit = (kpiId: string, fm: number, val: string) => {
    setEdits((e) => ({ ...e, [`${kpiId}:${fm}`]: limit1(val) }));
  };

  const dirtyItems = useMemo(() => {
    const items: { period: number; kpiId: string; fiscalMonth: number; value: number | null }[] = [];
    for (const [key, val] of Object.entries(edits)) {
      const [kpiId, fmStr] = key.split(":");
      items.push({
        period,
        kpiId,
        fiscalMonth: Number(fmStr),
        value: val === "" ? null : Math.round(Number(val) * 10) / 10,
      });
    }
    return items;
  }, [edits, period]);

  const save = async () => {
    if (dirtyItems.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const json = await fetchJson("/api/seisan-kpi/actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: dirtyItems }),
      });
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

  // 携帯では「KPI名称」だけ左固定し、他の固定列は通常スクロール(入力欄を見やすく)。
  // PCは従来どおり左7列を固定。
  const fHead = isMobile ? headSticky : freezeHead;   // 非名称ヘッダ: 携帯は縦のみ固定
  const fCell = isMobile ? undefined : freezeCell;     // 非名称セル: 携帯は固定しない
  const nameCol = isMobile ? colNameMobile : colName;  // 名称列幅(携帯は狭く)
  const nameEdge = isMobile ? freezeEdge : undefined;  // 携帯は名称列の右に境界
  const judgeEdge = isMobile ? undefined : freezeEdge; // PCは判定列(固定の右端)に境界

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>
            KPI実績入力
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

        {/* タブ: 通常KPI / 基礎データ算出KPI */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
          {([["通常", `通常KPI (${rows.length})`], ["基礎", `基礎データ算出KPI (${basicRows.length})`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ border: "none", background: "none", padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: tab === key ? "#1f3864" : "#94a3b8", borderBottom: tab === key ? "2px solid #1f3864" : "2px solid transparent", marginBottom: -1 }}>{label}</button>
          ))}
        </div>

        {tab === "通常" && (<>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          <span style={{ display: "inline-block", width: 11, height: 11, background: "#fef9c3", border: "1px solid #facc15", verticalAlign: "-1px", marginRight: 4 }} />
          入力対象月({FY_MONTHS[inputTargetFm - 1] ?? "—"})
          <span style={{ display: "inline-block", width: 11, height: 11, background: "#f1f5f9", verticalAlign: "-1px", margin: "0 4px 0 12px" }} />
          確定済み(ロック)
          <span style={{ marginLeft: 12 }}>数値入力で判定が即時更新されます。</span>
        </div>
        {rows.some((r) => r.readOnly) && (
          <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "#eef5ff", border: "1px solid #c7ddff", color: "#1e3a8a" }}>
            積み上げ先に設定されたKPI（子を持つ行）は、子の実績を<b>集計した結果</b>です（集計タイプに従い 累計=合算／平均=単純平均・多段対応／<b>直近月値は集計せず各自入力</b>）。集計行は<b>入力不可</b>。元の値は子（各課）を選択して入力してください。
          </div>
        )}

        {message && (
          <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
            {message}
          </div>
        )}

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 6, overflow: "auto", maxHeight: "calc(100vh - 300px)" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>該当KPIがありません。</div>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                  <th style={{ ...thLeft, ...freezeHead, ...nameCol, ...nameEdge }}>KPI名称</th>
                  <th style={{ ...th, ...fHead, ...colUnit }}>単位</th>
                  <th style={{ ...th, ...fHead, ...colAnnual }}>年間目標</th>
                  <th style={{ ...th, ...fHead, ...colMonthly }}>月割</th>
                  <th style={{ ...th, ...fHead, ...colCum }}>年累計/平均</th>
                  <th style={{ ...th, ...fHead, ...colPct }}>進捗率</th>
                  <th style={{ ...th, ...fHead, ...colJudge, ...judgeEdge }}>判定</th>
                  {FY_MONTHS.map((m, i) => (
                    <th key={m} style={{ ...th, ...headSticky, background: i + 1 === inputTargetFm ? "#fef9c3" : "#f1f5f9", color: i + 1 === inputTargetFm ? "#92400e" : undefined }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { current, attainment, judgment } = recompute(row);
                  return (
                    <tr key={row.kpiId}>
                      <td style={{ ...tdLeft, ...freezeCell, ...nameCol, ...nameEdge }} title={`${row.department} / ${row.kpiName}`}>{row.kpiName}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>{row.department}</div></td>
                      <td style={{ ...tdSub, ...fCell, ...colUnit }}>{row.unit}</td>
                      <td style={{ ...tdSub, ...fCell, ...colAnnual }}>{fmt1(row.annualTarget)}</td>
                      <td style={{ ...tdSub, ...fCell, ...colMonthly }}>{fmt1(row.monthlyTarget)}</td>
                      <td style={{ ...tdMon, ...fCell, ...colCum, background: "#f8fafc", fontWeight: 700 }}>
                        {fmt1(current)}
                      </td>
                      <td style={{ ...tdMon, ...fCell, ...colPct, fontWeight: 700, color: !Number.isFinite(attainment) ? "#16a34a" : attainment >= 0.95 ? "#16a34a" : attainment >= 0.8 ? "#d97706" : "#dc2626" }}>
                        {fmtPct(attainment)}
                      </td>
                      <td style={{ ...tdMon, ...fCell, ...colJudge, ...judgeEdge }}>
                        <JudgmentBadge judgment={judgment} />
                      </td>
                      {row.months.map((m) => {
                        const locked = m.fiscalMonth <= elapsed || !!row.readOnly;
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
                              <span style={{ color: "#94a3b8" }}>{fmt1(m.value)}</span>
                            ) : (
                              <input
                                type="number"
                                step="0.1"
                                value={shown}
                                onChange={(e) => setEdit(row.kpiId, m.fiscalMonth, e.target.value)}
                                style={{ width: 52, border: isTarget ? "2px solid #facc15" : "1px solid #e2e8f0", borderRadius: 4, padding: "3px 4px", textAlign: "right", fontSize: 12 }}
                              />
                            )}
                          </td>
                        );
                      })}
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
        </>)}

        {tab === "基礎" && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 6, overflowX: "auto" }}>
            <div style={{ fontSize: 12, color: "#64748b", padding: "8px 10px" }}>
              <AlertCircle size={13} style={{ verticalAlign: "-2px" }} /> これらのKPIは<b>会計データ（経営 ＞ 会計データ入力）から自動算出</b>されます。本画面では参照のみ（直接入力しません）。
            </div>
            {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : basicRows.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>基礎データ算出KPIがありません。</div>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                    <th style={thLeft}>KPI名称</th><th style={th}>レベル</th><th style={th}>部署</th><th style={th}>区分</th><th style={th}>単位</th><th style={th}>年間目標</th>
                  </tr>
                </thead>
                <tbody>
                  {basicRows.map((b) => (
                    <tr key={b.kpiId}>
                      <td style={tdLeft}>{b.kpiName}</td>
                      <td style={tdSub}>{b.level}</td>
                      <td style={tdSub}>{b.department}</td>
                      <td style={tdSub}>{b.category}</td>
                      <td style={tdSub}>{b.unit}</td>
                      <td style={tdMon}>{b.annualTarget}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
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

// 左4列(KPI名称/単位/年間目標/月割)を横スクロール時に固定する sticky スタイル
const freezeCell: React.CSSProperties = { position: "sticky", background: "#fff", zIndex: 2, overflow: "hidden", textOverflow: "ellipsis" };
const freezeHead: React.CSSProperties = { position: "sticky", top: 0, background: "#f1f5f9", zIndex: 4, overflow: "hidden", textOverflow: "ellipsis" }; // 角セル(行+列固定)
const headSticky: React.CSSProperties = { position: "sticky", top: 0, background: "#f1f5f9", zIndex: 3 }; // ヘッダ行(縦スクロール固定)
const freezeEdge: React.CSSProperties = { boxShadow: "2px 0 4px -2px rgba(15,23,42,0.15)" }; // 固定列の右端境界
const colName: React.CSSProperties = { width: 200, minWidth: 200, maxWidth: 200, left: 0 };
// 携帯: 名称列のみ固定するため幅を狭めて入力欄の表示領域を確保
const colNameMobile: React.CSSProperties = { width: 124, minWidth: 124, maxWidth: 124, left: 0 };
const colUnit: React.CSSProperties = { width: 70, minWidth: 70, maxWidth: 70, left: 200 };
const colAnnual: React.CSSProperties = { width: 76, minWidth: 76, maxWidth: 76, left: 270 };
const colMonthly: React.CSSProperties = { width: 64, minWidth: 64, maxWidth: 64, left: 346 };
const colCum: React.CSSProperties = { width: 80, minWidth: 80, maxWidth: 80, left: 410 };
const colPct: React.CSSProperties = { width: 64, minWidth: 64, maxWidth: 64, left: 490 };
const colJudge: React.CSSProperties = { width: 64, minWidth: 64, maxWidth: 64, left: 554 };
