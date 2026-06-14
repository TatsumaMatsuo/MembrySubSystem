"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { HelpLink } from "@/components/features/seisan-kpi";
import { RefreshCw, Plus, Save, Copy, X } from "lucide-react";

const AGG_TYPES = ["累計", "平均", "直近月値", "基礎データ算出"];
const DIRECTIONS = ["高い方が良い", "少ない方が良い"];
const GROUP_TYPES = ["機能別", "拠点別"];

interface KpiRow {
  recordId: string; kpiId: string; period: number; level: string; departmentDiv: string;
  department: string; departmentId: string; category: string; kpiName: string; unit: string;
  aggType: string; direction: string; annualTarget: number; monthlyTarget: number;
  owner: string; dataSource: string; inputTiming: string; sortOrder: number; isActive: boolean; notes: string;
}
interface MatrixGroup { recordId: string; groupId: string; groupName: string; groupType: string; sortOrder: number; isActive: boolean }
interface GroupMatrix { period: number; departments: string[]; groups: MatrixGroup[]; membership: Record<string, Record<string, string>> }

export default function SeisanKpiMasterPage() {
  const [tab, setTab] = useState<"kpi" | "group">("kpi");
  const [period, setPeriod] = useState<number>(50);
  const [periods, setPeriods] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // 期マスタからドロップダウンを生成し、現在期を初期選択
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/seisan-kpi/periods");
        const j = await r.json();
        const list = (j.data ?? []) as { period: number; isCurrent?: boolean }[];
        const nums = list.map((x) => x.period).filter((n) => Number.isFinite(n));
        if (nums.length) { setPeriods(nums); setPeriod(list.find((x) => x.isCurrent)?.period ?? nums[0]); }
      } catch { /* 取得失敗時は50期で継続 */ }
    })();
  }, []);

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>KPIマスタ / グループマスタ管理</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#1f3864", background: "#fff", cursor: "pointer" }}>
              {(periods.length ? periods : [period]).map((p) => <option key={p} value={p}>{p}期</option>)}
            </select>
            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600 }}>管理者専用</span>
            <HelpLink section="features" />
          </div>
        </div>

        {message && (
          <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
            {message}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["kpi", "KPIマスタ管理"], ["group", "グループマスタ管理"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === k ? "#1f3864" : "#dde5ef", color: tab === k ? "#fff" : "#475569" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "kpi"
          ? <KpiMasterTab period={period} setPeriod={setPeriod} setMessage={setMessage} />
          : <GroupMasterTab period={period} setMessage={setMessage} />}
      </div>
    </MainLayout>
  );
}

/* ===== KPIマスタ管理タブ ===== */
function KpiMasterTab(props: { period: number; setPeriod: (p: number) => void; setMessage: (m: string | null) => void }) {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, Partial<KpiRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fLevel, setFLevel] = useState(""); const [fDiv, setFDiv] = useState(""); const [fCat, setFCat] = useState(""); const [q, setQ] = useState("");
  const [showClone, setShowClone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); props.setMessage(null);
    try {
      const res = await fetch(`/api/seisan-kpi/master?period=${props.period}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data.rows ?? []);
      setEdits({});
    } catch (e: any) { props.setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  }, [props.period]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [props.period]);

  const filtered = useMemo(() => rows.filter((r) =>
    (!fLevel || r.level === fLevel) && (!fDiv || r.departmentDiv === fDiv) &&
    (!fCat || r.category === fCat) && (!q || r.kpiName.includes(q) || r.kpiId.includes(q))
  ), [rows, fLevel, fDiv, fCat, q]);

  const divs = useMemo(() => [...new Set(rows.map((r) => r.departmentDiv).filter(Boolean))], [rows]);
  const cats = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))], [rows]);

  const getVal = <K extends keyof KpiRow>(r: KpiRow, key: K): KpiRow[K] => {
    const e = edits[r.kpiId]?.[key];
    return (e !== undefined ? e : r[key]) as KpiRow[K];
  };
  const setVal = (kpiId: string, patch: Partial<KpiRow>) => setEdits((s) => ({ ...s, [kpiId]: { ...s[kpiId], ...patch } }));

  const saveRow = async (r: KpiRow) => {
    const e = edits[r.kpiId]; if (!e) return;
    setSavingId(r.kpiId);
    try {
      const res = await fetch(`/api/seisan-kpi/master`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: props.period, kpiId: r.kpiId, ...e }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      props.setMessage(`✅ ${r.kpiId} を保存しました`);
      await load();
    } catch (err: any) { props.setMessage(`保存エラー: ${err.message}`); }
    finally { setSavingId(null); }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
        <select value={fLevel} onChange={(e) => setFLevel(e.target.value)} style={sel}><option value="">階層: すべて</option>{["Lv2", "Lv3", "Lv4"].map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={fDiv} onChange={(e) => setFDiv(e.target.value)} style={sel}><option value="">部門: すべて</option>{divs.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={sel}><option value="">カテゴリ: すべて</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="KPI名称/IDで検索" style={{ ...sel, minWidth: 160 }} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setShowClone(true)} style={btnGhost}><Copy size={13} style={{ verticalAlign: "-2px" }} /> 新期作成(前期複製)</button>
          <button onClick={load} style={btnGhost}><RefreshCw size={13} style={{ verticalAlign: "-2px" }} /> 再読込</button>
        </span>
      </div>

      {showClone && <CloneDialog fromPeriod={props.period} onClose={() => setShowClone(false)} setMessage={props.setMessage} />}

      <div style={{ ...card, overflowX: "auto" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{props.period}期 / {filtered.length}件(全{rows.length}件)。セルを編集して各行の保存ボタンで確定(AUDIT記録)。</div>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                {["KPI_ID", "階層", "部署", "カテゴリ", "KPI名称", "単位", "集計", "方向", "年間目標", "月次目標", "オーナー", "有効", ""].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const dirty = !!edits[r.kpiId];
                return (
                  <tr key={r.recordId} style={{ background: r.isActive ? undefined : "#f8fafc" }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.kpiId}</td>
                    <td style={td}>{r.level}</td>
                    <td style={td}>{r.department}</td>
                    <td style={td}>{r.category}</td>
                    <td style={tdEd}><input value={getVal(r, "kpiName")} onChange={(e) => setVal(r.kpiId, { kpiName: e.target.value })} style={{ ...cellInput, width: 180 }} /></td>
                    <td style={tdEd}><input value={getVal(r, "unit")} onChange={(e) => setVal(r.kpiId, { unit: e.target.value })} style={{ ...cellInput, width: 50 }} /></td>
                    <td style={tdEd}><select value={getVal(r, "aggType")} onChange={(e) => setVal(r.kpiId, { aggType: e.target.value })} style={cellInput}>{AGG_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select></td>
                    <td style={tdEd}><select value={getVal(r, "direction")} onChange={(e) => setVal(r.kpiId, { direction: e.target.value })} style={cellInput}>{DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></td>
                    <td style={tdEd}><input type="number" value={getVal(r, "annualTarget")} onChange={(e) => setVal(r.kpiId, { annualTarget: Number(e.target.value) })} style={{ ...cellInput, width: 70, textAlign: "right" }} /></td>
                    <td style={tdEd}><input type="number" value={getVal(r, "monthlyTarget")} onChange={(e) => setVal(r.kpiId, { monthlyTarget: Number(e.target.value) })} style={{ ...cellInput, width: 70, textAlign: "right" }} /></td>
                    <td style={tdEd}><input value={getVal(r, "owner")} onChange={(e) => setVal(r.kpiId, { owner: e.target.value })} style={{ ...cellInput, width: 100 }} /></td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <input type="checkbox" checked={getVal(r, "isActive")} onChange={(e) => setVal(r.kpiId, { isActive: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#16a34a" }} />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => saveRow(r)} disabled={!dirty || savingId === r.kpiId}
                        style={{ background: dirty ? "#1f3864" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 6, padding: "5px 7px", cursor: dirty ? "pointer" : "default" }}><Save size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
          編集項目: KPI名称・単位・集計タイプ・良い方向・年間目標・月次目標換算・オーナー・有効フラグ。期切替=新期作成で前期定義を複製→目標値のみ更新。部署はLark部門に追従。
        </div>
      </div>
    </>
  );
}

/* ===== 新期作成ダイアログ ===== */
function CloneDialog(props: { fromPeriod: number; onClose: () => void; setMessage: (m: string | null) => void }) {
  const [toPeriod, setToPeriod] = useState<number>(props.fromPeriod + 1);
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!confirm(`${props.fromPeriod}期の定義(KPIマスタ・グループ・所属)を ${toPeriod}期に複製します。よろしいですか?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/seisan-kpi/period-clone`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPeriod: props.fromPeriod, toPeriod, startDate, endDate }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const c = json.data.cloned;
      props.setMessage(`✅ ${toPeriod}期を作成しました(KPI ${c.master} / グループ ${c.groups} / 所属 ${c.members})`);
      props.onClose();
    } catch (e: any) { props.setMessage(`複製エラー: ${e.message}`); }
    finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <div style={{ ...card, width: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1f3864" }}>新期作成(前期を複製)</div>
          <button onClick={props.onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <label style={lbl}>複製元の期<input value={props.fromPeriod} disabled style={{ ...inp, background: "#f1f5f9" }} /></label>
          <label style={lbl}>新しい期<input type="number" value={toPeriod} onChange={(e) => setToPeriod(Number(e.target.value))} style={inp} /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...lbl, flex: 1 }}>期間開始日<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inp} /></label>
            <label style={{ ...lbl, flex: 1 }}>期間終了日<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inp} /></label>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>KPIマスタ・グループ・所属の<b>定義のみ</b>複製します(実績/PDCA/★は複製しません)。新期にマスタが存在する場合は中止します。</div>
          <button onClick={run} disabled={busy} style={{ background: "#1f3864", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            <Copy size={14} style={{ verticalAlign: "-2px" }} /> {busy ? "複製中…" : "複製を実行"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== グループマスタ管理タブ ===== */
function GroupMasterTab(props: { period: number; setMessage: (m: string | null) => void }) {
  const [data, setData] = useState<GroupMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); props.setMessage(null);
    try {
      const res = await fetch(`/api/seisan-kpi/groups?period=${props.period}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
    } catch (e: any) { props.setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  }, [props.period]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [props.period]);

  const toggle = async (dept: string, groupId: string, member: boolean) => {
    const key = `${dept}:${groupId}`;
    setBusyCell(key);
    try {
      const res = await fetch(`/api/seisan-kpi/groups/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: props.period, groupId, department: dept, member }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e: any) { props.setMessage(`保存エラー: ${e.message}`); }
    finally { setBusyCell(null); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div>;
  if (!data) return null;
  const activeGroups = data.groups;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, alignItems: "start" }}>
      {/* グループ一覧 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1f3864", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          グループ一覧
          <button onClick={() => setShowNew(true)} style={{ ...btnGhost, padding: "3px 10px", fontSize: 11 }}><Plus size={12} style={{ verticalAlign: "-2px" }} /> 追加</button>
        </div>
        {showNew && <NewGroupForm period={props.period} nextOrder={(data.groups.at(-1)?.sortOrder ?? 0) + 10} onClose={() => setShowNew(false)} onSaved={async () => { setShowNew(false); await load(); props.setMessage("✅ グループを追加しました"); }} setMessage={props.setMessage} />}
        {data.groups.map((g) => {
          const count = data.departments.filter((d) => data.membership[d]?.[g.groupId]).length;
          return (
            <div key={g.groupId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 8, fontSize: 13, opacity: g.isActive ? 1 : 0.5 }}>
              <span><b>{g.groupName}</b><div style={{ fontSize: 10, color: "#64748b" }}>{g.groupType || "—"} ・ {count}部署</div></span>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>グループ種別(機能別/拠点別)・並び順・有効フラグを設定。期ごとに構成変更可。</div>
      </div>

      {/* 所属マトリクス */}
      <div style={{ ...card, overflowX: "auto" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1f3864", marginBottom: 8 }}>
          所属マトリクス(行=部署 × 列=グループ)― チェックで所属。<span style={{ fontSize: 10, color: "#92400e", fontWeight: 700 }}>1部署を複数グループに重複所属可</span>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thMx, textAlign: "left" }}>部署 \ グループ</th>
              {activeGroups.map((g) => <th key={g.groupId} style={thMx}>{g.groupName}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.departments.map((d) => {
              const memberOf = activeGroups.filter((g) => data.membership[d]?.[g.groupId]).length;
              const dup = memberOf > 1;
              return (
                <tr key={d} style={dup ? { background: "#fffbeb" } : undefined}>
                  <td style={{ ...tdMx, textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {d} {dup && <span style={{ fontSize: 10, color: "#92400e", fontWeight: 700 }}>⮂重複</span>}
                  </td>
                  {activeGroups.map((g) => {
                    const checked = !!data.membership[d]?.[g.groupId];
                    const key = `${d}:${g.groupId}`;
                    return (
                      <td key={g.groupId} style={tdMx}>
                        <input type="checkbox" checked={checked} disabled={busyCell === key}
                          onChange={(e) => toggle(d, g.groupId, e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
          ⭐ 北関東鉄工課は「鉄工課グループ」と「北関東工場グループ」の両方にチェック → 両グループで重複表示。実績は部署単位で1回登録(複製なし)。変更はAUDIT記録。
        </div>
      </div>
    </div>
  );
}

/* ===== 新規グループフォーム ===== */
function NewGroupForm(props: { period: number; nextOrder: number; onClose: () => void; onSaved: () => void; setMessage: (m: string | null) => void }) {
  const [name, setName] = useState(""); const [type, setType] = useState(GROUP_TYPES[0]); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) { props.setMessage("グループ名を入力してください"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/seisan-kpi/groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: props.period, groupName: name, groupType: type, sortOrder: props.nextOrder, isActive: true }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      props.onSaved();
    } catch (e: any) { props.setMessage(`保存エラー: ${e.message}`); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ border: "1px dashed #cbd5e1", borderRadius: 9, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="グループ名" style={inp} />
      <select value={type} onChange={(e) => setType(e.target.value)} style={inp}>{GROUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ ...btnGhost, background: "#1f3864", color: "#fff", border: "none", flex: 1 }}>{busy ? "保存中…" : "追加"}</button>
        <button onClick={props.onClose} style={{ ...btnGhost, flex: 1 }}>取消</button>
      </div>
    </div>
  );
}

/* ===== styles ===== */
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const sel: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#1f3864", border: "1px solid #1f3864", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const th: React.CSSProperties = { padding: "7px 9px", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "6px 9px", borderBottom: "1px solid #f1f5f9", textAlign: "left" };
const tdEd: React.CSSProperties = { ...td, background: "#fcfcfd" };
const cellInput: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 5px", fontSize: 12 };
const thMx: React.CSSProperties = { padding: "7px 9px", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11, background: "#f1f5f9", color: "#64748b" };
const tdMx: React.CSSProperties = { padding: "6px 9px", border: "1px solid #e2e8f0", textAlign: "center" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#475569", fontWeight: 600 };
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 9px", fontSize: 13, fontWeight: 400 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
