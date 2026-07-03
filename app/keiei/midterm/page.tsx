"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { Save, Plus, Trash2, RefreshCw, Calculator } from "lucide-react";

interface KgiEdit {
  indicator: string;
  unit: string;
  finalTarget: number;
  startValue: number;
  /** period -> value(文字列で編集) */
  values: Record<number, string>;
}
interface HeaderLite { planId: string; name: string; startPeriod: number; endPeriod: number; status: string; }

const STATUSES = ["現行", "次期", "過去", "下書き"];
const DEFAULT_KGIS: { indicator: string; unit: string; finalTarget: number; startValue: number }[] = [
  { indicator: "売上高", unit: "億", finalTarget: 67, startValue: 55 },
  { indicator: "ROA", unit: "%", finalTarget: 13, startValue: 0 },
  { indicator: "労働生産性", unit: "百万円/人", finalTarget: 10, startValue: 0 },
];

function lerp(start: number, end: number, sp: number, ep: number, p: number) {
  if (ep === sp) return end;
  return Math.round((start + ((end - start) * (p - sp)) / (ep - sp)) * 100) / 100;
}

export default function MidtermAdminPage() {
  const [headers, setHeaders] = useState<HeaderLite[]>([]);
  const [planId, setPlanId] = useState("MTP-1");
  const [name, setName] = useState("第◯次中期経営計画");
  const [startPeriod, setStartPeriod] = useState(50);
  const [endPeriod, setEndPeriod] = useState(52);
  const [status, setStatus] = useState("現行");
  const [kgis, setKgis] = useState<KgiEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const periods = useMemo(() => {
    const a: number[] = [];
    for (let p = startPeriod; p <= endPeriod; p++) a.push(p);
    return a;
  }, [startPeriod, endPeriod]);

  const newKgis = () =>
    DEFAULT_KGIS.map((k) => ({ ...k, values: {} as Record<number, string> }));

  const loadHeaders = async (): Promise<HeaderLite[]> => {
    const res = await fetch("/api/keiei/midterm", { cache: "no-store" });
    const json = await res.json();
    const hs: HeaderLite[] = json.data?.headers ?? [];
    setHeaders(hs);
    return hs;
  };

  const loadPlan = async (pid: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/keiei/midterm?plan=${encodeURIComponent(pid)}`, { cache: "no-store" });
      const json = await res.json();
      const d = json.data;
      if (!d) {
        // 新規
        setKgis(newKgis());
        setLoading(false);
        return;
      }
      setName(d.name); setStartPeriod(d.startPeriod); setEndPeriod(d.endPeriod); setStatus(d.status);
      setKgis(
        d.kgis.map((k: any) => {
          const values: Record<number, string> = {};
          for (const v of k.values) values[v.period] = String(v.target);
          const startVal = k.values.find((v: any) => v.period === d.startPeriod)?.target ?? 0;
          return { indicator: k.indicator, unit: k.unit, finalTarget: k.finalTarget, startValue: startVal, values };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const hs = await loadHeaders();
      // 既存があれば現行(なければ先頭)を初期表示。無ければ新規フォーム。
      const cur = hs.find((h) => h.status === "現行") ?? hs[0];
      if (cur) { setPlanId(cur.planId); await loadPlan(cur.planId); }
      else { setKgis(newKgis()); setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 線形補間で各期を再計算(起点→最終)
  const recalcRow = (idx: number) => {
    setKgis((prev) => prev.map((k, i) => {
      if (i !== idx) return k;
      const values: Record<number, string> = {};
      for (const p of periods) values[p] = String(lerp(k.startValue, k.finalTarget, startPeriod, endPeriod, p));
      return { ...k, values };
    }));
  };
  const recalcAll = () => kgis.forEach((_, i) => recalcRow(i));

  const setKgiField = (idx: number, field: keyof KgiEdit, val: any) =>
    setKgis((prev) => prev.map((k, i) => (i === idx ? { ...k, [field]: val } : k)));
  const setCell = (idx: number, period: number, val: string) =>
    setKgis((prev) => prev.map((k, i) => (i === idx ? { ...k, values: { ...k.values, [period]: val } } : k)));
  const addKgi = () => setKgis((p) => [...p, { indicator: "", unit: "", finalTarget: 0, startValue: 0, values: {} }]);
  const removeKgi = (idx: number) => setKgis((p) => p.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const body = {
        planId, name, startPeriod, endPeriod, status,
        kgis: kgis.filter((k) => k.indicator).map((k) => ({
          indicator: k.indicator, unit: k.unit, finalTarget: Number(k.finalTarget),
          values: periods.map((p) => ({ period: p, target: Number(k.values[p] ?? lerp(k.startValue, k.finalTarget, startPeriod, endPeriod, p)) })),
        })),
      };
      const res = await fetch("/api/keiei/midterm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      // 空ボディ(タイムアウト504等)や非JSON応答でも分かりやすいメッセージにする
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* 非JSON応答 */ }
      if (!res.ok || json.error) {
        const hint = res.status === 504 || res.status === 502 ? "（サーバ処理が時間内に完了しませんでした）" : "";
        throw new Error(json.error || `保存に失敗しました (HTTP ${res.status})${hint}`);
      }
      setMessage(`✅ 中計「${planId}」を保存しました`);
      await loadHeaders();
      await loadPlan(planId); // 保存後にサーバの最新を再読込して反映
    } catch (e: any) {
      setMessage(`保存エラー: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#4f46e5", margin: 0 }}>中計マスタ管理</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <select value={headers.some((h) => h.planId === planId) ? planId : "__new"} onChange={(e) => { if (e.target.value === "__new") { setPlanId("MTP-" + (headers.length + 1)); setName("第◯次中期経営計画"); setStartPeriod(50); setEndPeriod(52); setStatus("現行"); setKgis(newKgis()); } else { setPlanId(e.target.value); loadPlan(e.target.value); } }} style={sel}>
              <option value="__new">＋ 新規中計</option>
              {headers.map((h) => <option key={h.planId} value={h.planId}>{h.name || h.planId}（{h.startPeriod}→{h.endPeriod}）</option>)}
            </select>
          </div>
        </div>

        {message && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

        {/* ヘッダ編集 */}
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 0.7fr 0.9fr", gap: 12, fontSize: 13 }}>
            <Field label="中計名"><input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></Field>
            <Field label="中計コード"><input value={planId} onChange={(e) => setPlanId(e.target.value)} style={inp} /></Field>
            <Field label="開始期"><input type="number" value={startPeriod} onChange={(e) => setStartPeriod(Number(e.target.value))} style={inp} /></Field>
            <Field label="終了期"><input type="number" value={endPeriod} onChange={(e) => setEndPeriod(Number(e.target.value))} style={inp} /></Field>
            <Field label="ステータス"><select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
        </div>

        {/* KGI明細 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 4px 8px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#4f46e5" }}>KGI と 年度目標（起点・最終を入れて「線形補間」）</div>
          <button onClick={recalcAll} style={ghostBtn}><Calculator size={13} style={{ verticalAlign: "-2px" }} /> 全行を線形補間</button>
        </div>
        <div style={{ ...card, overflowX: "auto", padding: 6 }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                  <th style={th}>指標</th><th style={th}>単位</th><th style={th}>起点({startPeriod}期)</th><th style={th}>最終目標({endPeriod}期)</th>
                  {periods.map((p) => <th key={p} style={{ ...th, background: p === endPeriod ? "#eef2ff" : undefined }}>{p}期</th>)}
                  <th style={th}>補間</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {kgis.map((k, idx) => (
                  <tr key={idx}>
                    <td style={td}>
                      {/* 指標は自由入力(候補サジェストなし)。
                          ※Lark側で「指標」「KGI指標セット」をテキスト型にすれば任意名を保存可能。
                            選択型のままだと未登録値は保存で拒否される(1254302)。 */}
                      <input value={k.indicator} onChange={(e) => setKgiField(idx, "indicator", e.target.value)} placeholder="指標名" style={{ ...inpS, width: 130, textAlign: "left" }} />
                    </td>
                    <td style={td}><input value={k.unit} onChange={(e) => setKgiField(idx, "unit", e.target.value)} style={{ ...inpS, width: 80 }} /></td>
                    <td style={td}><input type="number" value={k.startValue} onChange={(e) => setKgiField(idx, "startValue", Number(e.target.value))} style={{ ...inpS, width: 64 }} /></td>
                    <td style={td}><input type="number" value={k.finalTarget} onChange={(e) => setKgiField(idx, "finalTarget", Number(e.target.value))} style={{ ...inpS, width: 64 }} /></td>
                    {periods.map((p) => (
                      <td key={p} style={td}>
                        <input value={k.values[p] ?? ""} onChange={(e) => setCell(idx, p, e.target.value)} placeholder={String(lerp(k.startValue, k.finalTarget, startPeriod, endPeriod, p))} style={{ ...inpS, width: 60, background: p === endPeriod ? "#eef2ff" : undefined }} />
                      </td>
                    ))}
                    <td style={td}><button onClick={() => recalcRow(idx)} style={ghostBtn}>↻</button></td>
                    <td style={td}><button onClick={() => removeKgi(idx)} style={{ ...ghostBtn, color: "#dc2626" }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={addKgi} style={{ ...ghostBtn, margin: 8 }}><Plus size={13} style={{ verticalAlign: "-2px" }} /> KGIを追加</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Save size={14} style={{ verticalAlign: "-2px" }} /> {saving ? "保存中…" : "保存"}
          </button>
          <span style={{ fontSize: 11, color: "#64748b" }}>起点(開始期)と最終目標を入れて「線形補間」→ 中間年度が自動生成。各期は個別修正可。保存で中計ダッシュボードに反映。</span>
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "block" }}><div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{label}</div>{children}</label>;
}
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(15,23,42,.05)" };
const inp: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 9px", fontSize: 13 };
const inpS: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 6px", fontSize: 12, textAlign: "right" };
const sel: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff" };
const th: React.CSSProperties = { padding: "7px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "5px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "center" };
const ghostBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 10px", fontSize: 12, color: "#4f46e5", cursor: "pointer", fontWeight: 600 };
