"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink, JudgmentBadge, EFFECT_COLORS, JUDGMENT_COLORS } from "@/components/features/seisan-kpi";
import { useIsMobile } from "@/lib/use-is-mobile";
import { RefreshCw, Plus, Save, X } from "lucide-react";
import type { Judgment, Effect } from "@/lib/kpi";
import { fetchJson } from "@/lib/fetch-json";

const FY_MONTHS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
const STATUSES = ["下書き", "実施中", "完了", "中止"];
const EFFECTS: Effect[] = ["改善", "横ばい", "悪化"];
const NEXT_ACTIONS = ["継続", "強化", "見直し", "完了"];

const effectColor = EFFECT_COLORS as Record<string, string>;
// 判定の並び順(赤→黄→緑)と枠内の淡色背景
const JUDGMENT_RANK: Record<Judgment, number> = { 赤: 0, 黄: 1, 緑: 2 };
const JUDGMENT_TINT: Record<Judgment, string> = { 赤: "#fef2f2", 黄: "#fffbeb", 緑: "#f0fdf4" };
const statusColor: Record<string, string> = {
  下書き: "#64748b", 実施中: "#5b21b6", 完了: "#166534", 中止: "#991b1b",
};

interface GroupInfo { groupId: string; groupName: string; groupType: string; members: string[] }
interface GroupKpi { kpiId: string; department: string; kpiName: string; unit: string; current: number; target: number; judgment: Judgment }
interface PdcaRow {
  recordId: string; pdcaId: string; fiscalMonth: number; targetYm: string;
  plan: string; do: string; kpiActual: number | null; effectAuto: Effect | null;
  effect: Effect | ""; effectMemo: string; directorComment: string; nextAction: string; writer: string;
}
interface MeasureRow {
  recordId: string; measureId: string; no: number; measureName: string; groupId: string;
  targetKpiId: string; targetKpiName: string; unit: string; status: string;
  startMonth: number | null; endMonth: number | null; baseValue: number | null; goalValue: number | null;
  current: number; judgment: Judgment; direction: string; pdca: PdcaRow[];
}
interface ScreenData {
  period: number; elapsedMonths: number; groups: GroupInfo[]; selectedGroupId: string | null;
  members: string[]; kpis: GroupKpi[]; measures: MeasureRow[];
}

export default function SeisanKpiMeasuresPage() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [group, setGroup] = useState<string>("");
  const [period, setPeriod] = useState<number>(0);
  const [periods, setPeriods] = useState<number[]>([]);
  const [selectedMeasure, setSelectedMeasure] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showNewMeasure, setShowNewMeasure] = useState(false);
  const isMobile = useIsMobile();

  const load = useCallback(async (g?: string, p?: number) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (g) params.set("group", g);
      if (p) params.set("period", String(p));
      const json = await fetchJson(`/api/seisan-kpi/measures?${params.toString()}`);
      if (json.error) throw new Error(json.error);
      const d: ScreenData = json.data;
      setData(d);
      setPeriod(d.period);
      setGroup(d.selectedGroupId ?? "");
      setSelectedMeasure((prev) =>
        d.measures.find((m) => m.measureId === prev)?.measureId ?? d.measures[0]?.measureId ?? ""
      );
    } catch (e: any) {
      setMessage(`読み込みエラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let initial: number | undefined;
      try {
        const j = await fetchJson("/api/seisan-kpi/periods");
        const list = (j.data ?? []) as { period: number; isCurrent?: boolean }[];
        const nums = list.map((x) => x.period).filter((n) => Number.isFinite(n));
        if (nums.length) { setPeriods(nums); initial = list.find((x) => x.isCurrent)?.period ?? nums[0]; }
      } catch { /* 取得失敗時はサーバ既定(当期) */ }
      await load(undefined, initial);
    })();
    /* eslint-disable-next-line */
  }, []);

  const onGroupChange = (g: string) => { setGroup(g); setShowNewMeasure(false); load(g, period); };

  const measures = data?.measures ?? [];
  const current = useMemo(
    () => measures.find((m) => m.measureId === selectedMeasure) ?? null,
    [measures, selectedMeasure]
  );

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1340, margin: "0 auto" }}>
        {/* ヘッダ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>
            施策管理 ― 重点施策の月次PDCA
          </h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <select value={period} onChange={(e) => load(group, Number(e.target.value))}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#1f3864", background: "#fff", cursor: "pointer" }}>
              {(periods.length ? periods : [period]).map((p) => <option key={p} value={p}>{p}期</option>)}
            </select>
            <span style={{ background: "#1f3864", color: "#fff", borderRadius: 8, padding: "6px 12px" }}>
              経過 {data?.elapsedMonths ?? 0}ヶ月
            </span>
            <select value={group} onChange={(e) => onGroupChange(e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", minWidth: 220 }}>
              {(data?.groups ?? []).map((g) => (
                <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
              ))}
            </select>
            <button onClick={() => load(group, period)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <HelpLink section="features" />
          </div>
        </div>

        {message && (
          <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
            {message}
          </div>
        )}

        {/* グループ構成 */}
        {data && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
            <b>{data.groups.find((g) => g.groupId === group)?.groupName ?? "—"}</b> の所属部署:{" "}
            {data.members.map((m) => (
              <span key={m} style={{ display: "inline-block", border: "1px solid #cbd5e1", borderRadius: 7, padding: "2px 9px", margin: "2px 3px", fontSize: 11 }}>{m}</span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>
        ) : !data ? null : (
          <>
            {/* 主要KPI */}
            <SectionTitle>このグループの主要KPI(所属部署を集約)</SectionTitle>
            <div style={card}>
              {data.kpis.length === 0 ? (
                <span style={{ color: "#94a3b8", fontSize: 12 }}>対象KPIがありません。</span>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[...data.kpis].sort((a, b) => JUDGMENT_RANK[a.judgment] - JUDGMENT_RANK[b.judgment]).map((k) => (
                    <div key={k.kpiId} style={{ border: `2px solid ${JUDGMENT_COLORS[k.judgment]}`, background: JUDGMENT_TINT[k.judgment], borderRadius: 10, padding: "8px 12px", fontSize: 12, minWidth: 150 }}>
                      <div style={{ color: "#64748b", fontWeight: 600 }}>{k.department} {k.kpiName}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                        {k.current}/目標{k.target}{" "}
                        <JudgmentBadge judgment={k.judgment} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* マスター・ディテール */}
            <SectionTitle>重点施策(件数無制限)＝マスター ／ 選択施策のPDCA履歴＝ディテール</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(380px, 1fr) 1.4fr", gap: 14, alignItems: "start" }}>
              {/* マスター */}
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f3864", marginBottom: 8 }}>
                  重点施策一覧 <span style={{ color: "#64748b", fontWeight: 400 }}>(全{measures.length}件)</span>
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                      <th style={{ ...th, width: 32 }}>No</th>
                      <th style={{ ...th, textAlign: "left" }}>施策名 / 対象KPI</th>
                      <th style={{ ...th, width: 60 }}>状態</th>
                      <th style={{ ...th, width: 92 }}>基準→現在</th>
                      <th style={{ ...th, width: 54 }}>PDCA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measures.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>施策がありません。「＋施策を追加」から登録してください。</td></tr>
                    ) : measures.map((m) => {
                      const sel = m.measureId === selectedMeasure;
                      return (
                        <tr key={m.measureId} onClick={() => { setSelectedMeasure(m.measureId); setShowNewMeasure(false); }}
                          style={{ cursor: "pointer", background: sel ? "#eff6ff" : undefined, boxShadow: sel ? "inset 3px 0 0 #2563eb" : undefined }}>
                          <td style={{ ...td, textAlign: "center" }}>{m.no}</td>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{m.measureName}</div>
                            <div style={{ fontSize: 11, color: "#2563eb" }}>{m.targetKpiName}</div>
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <span style={pill(statusColor[m.status] ?? "#64748b")}>{m.status}</span>
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {m.baseValue ?? "—"}→<b>{m.current}</b>
                            {m.goalValue != null && <div style={{ fontSize: 10, color: "#2563eb" }}>狙い{m.goalValue}</div>}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <JudgmentBadge judgment={m.judgment} size="sm" />
                            <div style={{ fontSize: 10, color: "#64748b" }}>{m.pdca.length}件</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button onClick={() => { setShowNewMeasure(true); setSelectedMeasure(""); }}
                  style={{ marginTop: 10, fontSize: 12, color: "#2563eb", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Plus size={13} style={{ verticalAlign: "-2px" }} /> 施策を追加
                </button>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                  状態(下書き/実施中/完了/中止)で管理。期途中の追加・状態変更可、全操作をAUDITに記録。
                </div>
              </div>

              {/* ディテール */}
              <div style={card}>
                {showNewMeasure ? (
                  <NewMeasureForm
                    period={data.period}
                    groupId={group}
                    kpis={data.kpis}
                    onCancel={() => setShowNewMeasure(false)}
                    onSaved={async (mid) => { setShowNewMeasure(false); await load(group, period); setSelectedMeasure(mid); setMessage("✅ 施策を登録しました"); }}
                    onError={(msg) => setMessage(msg)}
                  />
                ) : current ? (
                  <PdcaDetail
                    key={current.measureId}
                    measure={current}
                    period={data.period}
                    elapsed={data.elapsedMonths}
                    onSaved={async () => { await load(group, period); setMessage("✅ PDCAを保存しました"); }}
                    onError={(msg) => setMessage(msg)}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>左の一覧から施策を選択してください。</div>
                )}
              </div>
            </div>
          </>
        )}

        <PastMeasures />
      </div>
      </div>
    </MainLayout>
  );
}

/* ===== 過去施策の参照(期またぎ) ===== */
interface PastRow { period: number; measureId: string; measureName: string; targetKpiId: string; targetKpiName: string; status: string; baseValue: number | null; goalValue: number | null; landing: number | null; pdcaCount: number; lastEffect: string; lastAction: string; }
function PastMeasures() {
  const [rows, setRows] = useState<PastRow[]>([]);
  const [kpiOptions, setKpiOptions] = useState<{ kpiId: string; kpiName: string }[]>([]);
  const [periodsOpt, setPeriodsOpt] = useState<number[]>([]);
  const [fKpi, setFKpi] = useState(""); const [fStatus, setFStatus] = useState(""); const [fPeriod, setFPeriod] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (fKpi) p.set("targetKpi", fKpi); if (fStatus) p.set("status", fStatus); if (fPeriod) p.set("period", fPeriod);
      const json = await fetchJson(`/api/seisan-kpi/measures/past?${p.toString()}`);
      if (!json.error) { setRows(json.data.rows ?? []); setKpiOptions(json.data.kpiOptions ?? []); setPeriodsOpt(json.data.periods ?? []); }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [fKpi, fStatus, fPeriod]);
  useEffect(() => { load(); }, [load]);

  const eff = (e: string) => ({ "改善": "#16a34a", "悪化": "#dc2626", "横ばい": "#64748b" } as Record<string, string>)[e] ?? "#94a3b8";

  return (
    <>
      <SectionTitle>過去施策の参照（期またぎ・KPI別の打ち手の蓄積）</SectionTitle>
      <div style={card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", fontSize: 13 }}>
          <select value={fPeriod} onChange={(e) => setFPeriod(e.target.value)} style={pmSel}><option value="">期: すべて</option>{periodsOpt.map((p) => <option key={p} value={p}>{p}期</option>)}</select>
          <select value={fKpi} onChange={(e) => setFKpi(e.target.value)} style={pmSel}><option value="">対象KPI: すべて</option>{kpiOptions.map((k) => <option key={k.kpiId} value={k.kpiId}>{k.kpiName}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={pmSel}><option value="">状態: すべて</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                <th style={pmTh}>期</th><th style={{ ...pmTh, textAlign: "left" }}>施策名</th><th style={{ ...pmTh, textAlign: "left" }}>対象KPI</th><th style={pmTh}>状態</th><th style={pmTh}>基準→着地</th><th style={pmTh}>PDCA件数</th><th style={pmTh}>最終効果</th><th style={pmTh}>最終アクション</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ ...pmTd, textAlign: "center", color: "#64748b", padding: 18 }}>読み込み中…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} style={{ ...pmTd, textAlign: "center", color: "#94a3b8", padding: 18 }}>該当する過去施策がありません。</td></tr>
                : rows.map((r) => (
                  <tr key={`${r.period}-${r.measureId}`}>
                    <td style={pmTd}>{r.period}期</td>
                    <td style={{ ...pmTd, textAlign: "left", fontWeight: 600 }}>{r.measureName}</td>
                    <td style={{ ...pmTd, textAlign: "left", color: "#64748b" }}>{r.targetKpiName}</td>
                    <td style={pmTd}>{r.status}</td>
                    <td style={pmTd}>{r.baseValue ?? "—"} → <b>{r.landing ?? "—"}</b></td>
                    <td style={pmTd}>{r.pdcaCount}</td>
                    <td style={pmTd}><span style={{ fontWeight: 700, color: eff(r.lastEffect) }}>{r.lastEffect}</span></td>
                    <td style={pmTd}>{r.lastAction}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
const pmSel: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff" };
const pmTh: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11.5 };
const pmTd: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center", fontVariantNumeric: "tabular-nums" };

/* ===== 施策(ヘッダ)新規フォーム ===== */
function NewMeasureForm(props: {
  period: number; groupId: string; kpis: GroupKpi[];
  onCancel: () => void; onSaved: (measureId: string) => void; onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [targetKpiId, setTargetKpiId] = useState(props.kpis[0]?.kpiId ?? "");
  const [status, setStatus] = useState("実施中");
  const [startMonth, setStartMonth] = useState<number>(1);
  const [baseValue, setBaseValue] = useState<string>("");
  const [goalValue, setGoalValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // 対象KPI選択時、現在値を基準値の初期値に
  const onPickKpi = (id: string) => {
    setTargetKpiId(id);
    const k = props.kpis.find((x) => x.kpiId === id);
    if (k && baseValue === "") setBaseValue(String(k.current));
  };

  const save = async () => {
    if (!name.trim()) { props.onError("施策名を入力してください"); return; }
    setSaving(true);
    try {
      const json = await fetchJson("/api/seisan-kpi/measures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: props.period, groupId: props.groupId, measureName: name, targetKpiId,
          status, startMonth, baseValue: baseValue === "" ? null : Number(baseValue),
          goalValue: goalValue === "" ? null : Number(goalValue),
        }),
      });
      if (json.error) throw new Error(json.error);
      props.onSaved(json.data.measureId);
    } catch (e: any) {
      props.onError(`保存エラー: ${e.message}`);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1f3864" }}>＋ 新規施策の追加</div>
        <button onClick={props.onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={16} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
        <label style={lbl}>施策名
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 鉄工チェックリスト" style={inp} />
        </label>
        <label style={lbl}>対象KPI
          <select value={targetKpiId} onChange={(e) => onPickKpi(e.target.value)} style={inp}>
            {props.kpis.map((k) => <option key={k.kpiId} value={k.kpiId}>{k.department} {k.kpiName}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...lbl, flex: 1 }}>状態
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ ...lbl, flex: 1 }}>開始月
            <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} style={inp}>
              {FY_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...lbl, flex: 1 }}>基準値(施策開始時)
            <input type="number" value={baseValue} onChange={(e) => setBaseValue(e.target.value)} style={inp} />
          </label>
          <label style={{ ...lbl, flex: 1 }}>狙い値(任意)
            <input type="number" value={goalValue} onChange={(e) => setGoalValue(e.target.value)} style={inp} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={save} disabled={saving}
            style={{ background: "#1f3864", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Save size={14} style={{ verticalAlign: "-2px" }} /> {saving ? "保存中…" : "施策を登録"}
          </button>
          <button onClick={props.onCancel} style={{ background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 9, padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

/* ===== PDCA ディテール(編集) ===== */
function PdcaDetail(props: {
  measure: MeasureRow; period: number; elapsed: number;
  onSaved: () => void; onError: (msg: string) => void;
}) {
  const { measure } = props;
  // 既存PDCA月 + 「追加した月」をマージ
  const [extraMonths, setExtraMonths] = useState<number[]>([]);
  // 編集状態: fiscalMonth → 部分フィールド
  const [edits, setEdits] = useState<Record<number, Partial<PdcaRow>>>({});
  const [savingFm, setSavingFm] = useState<number | null>(null);

  const existingFms = measure.pdca.map((p) => p.fiscalMonth);
  const allFms = [...new Set([...existingFms, ...extraMonths])].sort((a, b) => a - b);
  const rowByFm = new Map(measure.pdca.map((p) => [p.fiscalMonth, p]));

  // 次に追加できる月(経過月数までで未登録の最小月)
  const nextMonth = useMemo(() => {
    for (let fm = 1; fm <= Math.max(props.elapsed, 1); fm++) {
      if (!allFms.includes(fm)) return fm;
    }
    return Math.min(allFms.length ? Math.max(...allFms) + 1 : 1, 12);
  }, [allFms, props.elapsed]);

  const getField = <K extends keyof PdcaRow>(fm: number, key: K, fallback: PdcaRow[K]): PdcaRow[K] => {
    const e = edits[fm]?.[key];
    return (e !== undefined ? e : fallback) as PdcaRow[K];
  };
  const setField = (fm: number, patch: Partial<PdcaRow>) =>
    setEdits((s) => ({ ...s, [fm]: { ...s[fm], ...patch } }));

  const saveRow = async (fm: number) => {
    const e = edits[fm] ?? {};
    setSavingFm(fm);
    try {
      const json = await fetchJson("/api/seisan-kpi/pdca", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: props.period, measureId: measure.measureId, fiscalMonth: fm,
          plan: e.plan, do: e.do,
          kpiActual: e.kpiActual === undefined ? undefined : e.kpiActual,
          effect: e.effect, directorComment: e.directorComment, nextAction: e.nextAction,
        }),
      });
      if (json.error) throw new Error(json.error);
      props.onSaved();
    } catch (err: any) {
      props.onError(`保存エラー: ${err.message}`);
    } finally { setSavingFm(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1f3864" }}>施策{measure.no}: {measure.measureName}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            対象KPI: {measure.targetKpiName} ／ 基準値 {measure.baseValue ?? "—"} → 現在 <b>{measure.current}</b>
            {measure.goalValue != null && <> ／ 狙い値 {measure.goalValue}</>} ／ PDCA {measure.pdca.length}件
            <span style={{ ...pill(statusColor[measure.status] ?? "#64748b"), marginLeft: 8 }}>{measure.status}</span>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#475569" }}>
              <th style={{ ...th, width: 40 }}>月</th>
              <th style={{ ...th, textAlign: "left", background: "#dbeafe" }}>計画(Plan)</th>
              <th style={{ ...th, textAlign: "left", background: "#cffafe" }}>実施(Do)</th>
              <th style={{ ...th, width: 70, background: "#e2e8f0" }}>対象KPI</th>
              <th style={{ ...th, width: 116, background: "#fef9c3" }}>効果<br /><span style={{ fontWeight: 400, fontSize: 10 }}>自動→確定</span></th>
              <th style={{ ...th, textAlign: "left", background: "#ffedd5" }}>本部長ｺﾒﾝﾄ</th>
              <th style={{ ...th, width: 88, background: "#dcfce7" }}>翌月ｱｸｼｮﾝ</th>
              <th style={{ ...th, width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {allFms.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>PDCAがありません。下の「＋月を追加」から記入を開始してください。</td></tr>
            ) : allFms.map((fm) => {
              const row = rowByFm.get(fm);
              const effectAuto = row?.effectAuto ?? null;
              return (
                <tr key={fm}>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#1f3864" }}>{FY_MONTHS[fm - 1]}</td>
                  <td style={{ ...td, background: "#eff6ff" }}>
                    <textarea value={getField(fm, "plan", row?.plan ?? "")} onChange={(e) => setField(fm, { plan: e.target.value })} style={ta} rows={2} placeholder="(責任者記入)" />
                  </td>
                  <td style={{ ...td, background: "#ecfeff" }}>
                    <textarea value={getField(fm, "do", row?.do ?? "")} onChange={(e) => setField(fm, { do: e.target.value })} style={ta} rows={2} placeholder="―" />
                  </td>
                  <td style={{ ...td, background: "#f8fafc", textAlign: "center" }}>
                    <input type="number" value={getField(fm, "kpiActual", row?.kpiActual ?? null) ?? ""} onChange={(e) => setField(fm, { kpiActual: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 56, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 4px", textAlign: "right", fontSize: 12 }} placeholder="自動" />
                  </td>
                  <td style={{ ...td, background: "#fefce8", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>
                      自動: {effectAuto ? <span style={{ color: effectColor[effectAuto], fontWeight: 700 }}>{effectAuto}</span> : "—"}
                    </div>
                    <select value={getField(fm, "effect", row?.effect ?? "")} onChange={(e) => setField(fm, { effect: e.target.value as Effect | "" })}
                      style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px", fontSize: 11 }}>
                      <option value="">確定待ち</option>
                      {EFFECTS.map((ef) => <option key={ef} value={ef}>{ef}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, background: "#fff7ed" }}>
                    <textarea value={getField(fm, "directorComment", row?.directorComment ?? "")} onChange={(e) => setField(fm, { directorComment: e.target.value })} style={ta} rows={2} placeholder="(会議で本部長記入)" />
                  </td>
                  <td style={{ ...td, background: "#f0fdf4", textAlign: "center" }}>
                    <select value={getField(fm, "nextAction", row?.nextAction ?? "")} onChange={(e) => setField(fm, { nextAction: e.target.value })}
                      style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px", fontSize: 11 }}>
                      <option value="">―</option>
                      {NEXT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => saveRow(fm)} disabled={savingFm === fm || !edits[fm]}
                      title="この月を保存"
                      style={{ background: edits[fm] ? "#1f3864" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 6, padding: "5px 7px", cursor: edits[fm] ? "pointer" : "default" }}>
                      <Save size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextMonth <= 12 && (
        <button onClick={() => setExtraMonths((s) => [...new Set([...s, nextMonth])])}
          style={{ marginTop: 10, fontSize: 12, color: "#2563eb", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> {FY_MONTHS[nextMonth - 1]}のPDCAを追加
        </button>
      )}

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", color: "#78350f", fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
        <b>効果の自動判定:</b> 対象KPI実績が基準値より良い方向に5%以上 or 判定ランク上昇=改善 ／ ±5%以内=横ばい ／ 逆方向5%以上 or ランク低下=悪化。自動判定は目安で、責任者が「確定」を選択(上書き可)。対象KPI実績は空欄なら月次実績から自動取込。
      </div>
    </div>
  );
}

/* ===== UI helpers ===== */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: "#1f3864", margin: "18px 4px 10px" }}>▼ {children}</div>;
}
function pill(color: string): React.CSSProperties {
  return { fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: color + "22", color };
}
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const th: React.CSSProperties = { padding: "7px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#475569", fontWeight: 600 };
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 9px", fontSize: 13, fontWeight: 400 };
const ta: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 5, padding: "4px 6px", fontSize: 11.5, resize: "vertical", fontFamily: "inherit" };
