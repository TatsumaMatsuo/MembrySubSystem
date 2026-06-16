"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { Save, RefreshCw } from "lucide-react";

type Granularity = "月" | "四半期" | "半期";
interface AccountInput {
  account: string;
  unit: string;
  granularity: Granularity;
  values: Record<string, string>;
}

const MONTH_LABELS = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];

/** 開始年から月別スパン(YYYY-MM)を生成。8月=startYear、1月以降=startYear+1 */
function monthSpans(startYear: number): { key: string; label: string }[] {
  return MONTH_LABELS.map((label, i) => {
    const fm = i + 1;
    const monthNum = ((fm - 1 + 7) % 12) + 1; // 1→8..6→1..12→7
    const year = fm <= 5 ? startYear : startYear + 1;
    return { key: `${year}-${String(monthNum).padStart(2, "0")}`, label };
  });
}
const QUARTER_SPANS = [
  { key: "Q1", label: "Q1(8-10)" }, { key: "Q2", label: "Q2(11-1)" },
  { key: "Q3", label: "Q3(2-4)" }, { key: "Q4", label: "Q4(5-7)" },
];
const HALF_SPANS = [{ key: "上期", label: "上期(8-1)" }, { key: "下期", label: "下期(2-7)" }];

const thCell: React.CSSProperties = { border: "1px solid #d7dee8", padding: "7px 6px", textAlign: "center", fontWeight: 600, fontSize: 11, color: "#475569", background: "#eef2f7", position: "sticky", top: 0, zIndex: 2, boxShadow: "inset 0 -1px 0 #d7dee8" };
const tdCell: React.CSSProperties = { border: "1px solid #e2e8f0", textAlign: "center", verticalAlign: "middle" };
const cellInput: React.CSSProperties = { width: "100%", border: "none", background: "transparent", padding: "6px 6px", textAlign: "right", fontSize: 12, outline: "none", boxSizing: "border-box" };

export default function KaikeiInputPage() {
  const [period, setPeriod] = useState(50);
  const [periods, setPeriods] = useState<number[]>([]);
  const [startYear, setStartYear] = useState(2025);
  const [accounts, setAccounts] = useState<AccountInput[]>([]);
  const [dirty, setDirty] = useState<Record<string, string>>({}); // `${account}::${span}` -> value
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (p: number) => {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`/api/keiei/kaikei?period=${p}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPeriod(json.data.period);
      setStartYear(json.data.startYear);
      setAccounts(json.data.accounts ?? []);
      setDirty({});
    } catch (e: any) { setMessage(`読み込みエラー: ${e.message}`); }
    finally { setLoading(false); }
  };

  // 期マスタを取得してドロップダウンに反映し、現在期を初期表示
  useEffect(() => {
    (async () => {
      let initial = 50;
      try {
        const r = await fetch("/api/seisan-kpi/periods");
        const j = await r.json();
        const list = (j.data ?? []) as { period: number; isCurrent?: boolean }[];
        const nums = list.map((x) => x.period).filter((n) => Number.isFinite(n));
        if (nums.length) {
          setPeriods(nums);
          initial = list.find((x) => x.isCurrent)?.period ?? nums[0];
        }
      } catch { /* 期マスタ取得失敗時は50期で継続 */ }
      await load(initial);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 期切替(未保存があれば確認)
  const changePeriod = (p: number) => {
    if (p === period) return;
    if (Object.keys(dirty).length > 0 && !window.confirm("未保存の入力があります。破棄して期を切り替えますか？")) return;
    load(p);
  };

  const setGranularity = (account: string, g: Granularity) =>
    setAccounts((prev) => prev.map((a) => (a.account === account ? { ...a, granularity: g } : a)));

  const setCell = (account: string, span: string, val: string) => {
    setAccounts((prev) => prev.map((a) => (a.account === account ? { ...a, values: { ...a.values, [span]: val } } : a)));
    setDirty((d) => ({ ...d, [`${account}::${span}`]: val }));
  };

  const dirtyItems = useMemo(() => {
    return Object.entries(dirty).map(([k, v]) => {
      const [account, span] = k.split("::");
      const a = accounts.find((x) => x.account === account);
      return { period, account, granularity: a?.granularity ?? "月", span, value: v === "" ? null : Number(v) };
    });
  }, [dirty, accounts, period]);

  const save = async () => {
    if (dirtyItems.length === 0) return;
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/keiei/kaikei", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: dirtyItems }) });
      // セッション切れ等で認証が外れた場合は再ログインへ誘導
      if (res.status === 401) {
        setMessage("⚠️ セッションが切れました。再ログイン画面へ移動します…");
        const cb = encodeURIComponent(window.location.pathname);
        setTimeout(() => { window.location.href = `/auth/signin?callbackUrl=${cb}`; }, 1200);
        return;
      }
      const json = await res.json();
      if (json.error) throw new Error(json.step ? `[${json.step}] ${json.error}` : json.error);
      setMessage(`✅ ${json.data.saved}件を保存しました`);
      await load(period);
    } catch (e: any) { setMessage(`保存エラー: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#4f46e5", margin: 0 }}>会計データ入力</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <select value={period} onChange={(e) => changePeriod(Number(e.target.value))} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "#fff", cursor: "pointer" }}>
              {(periods.length ? periods : [period]).map((p) => <option key={p} value={p}>{p}期</option>)}
            </select>
            <button onClick={() => load(period)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
            </button>
            <button onClick={save} disabled={saving || dirtyItems.length === 0} style={{ background: dirtyItems.length ? "#4f46e5" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: dirtyItems.length ? "pointer" : "default" }}>
              <Save size={14} style={{ verticalAlign: "-2px" }} /> {saving ? "保存中…" : `保存 (${dirtyItems.length})`}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          科目ごとに<b>粒度（月/四半期/半期）</b>を選んで入力。共通の年度累計に正規化され、全社KPI・中計・生産本部Lv2（粗利率等）が同じ実績を参照します。総資産=半期、人員数=月別 など科目に合わせて選択。
        </div>

        <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 12, padding: "8px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, lineHeight: 1.6 }}>
          ℹ️ 右上の<b>期</b>の選択肢は<b>期マスタ</b>に登録された期に連動します。新しい期（例: 51期・52期）を入力するには、先に <b>「経営 ＞ 期マスタ管理」</b>でその期を登録してください。登録すると本画面の期セレクタにも表示されます。
        </div>

        {message && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

        <style>{`.kaikei-cell:focus{background:#fffbe6;box-shadow:inset 0 0 0 2px #4f46e5;}`}</style>
        <div style={{ background: "#fff", border: "1px solid #d7dee8", borderRadius: 12, overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  <th style={{ ...thCell, position: "sticky", top: 0, left: 0, zIndex: 4, textAlign: "left", minWidth: 130, boxShadow: "inset 0 -1px 0 #d7dee8, 1px 0 0 #d7dee8" }}>科目</th>
                  <th style={{ ...thCell, minWidth: 78 }}>粒度</th>
                  {MONTH_LABELS.map((m) => <th key={m} style={{ ...thCell, minWidth: 58 }}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => {
                  const rowBg = idx % 2 === 1 ? "#f5f8fc" : "#fff"; // 1始まりの偶数行に背景
                  const monthCells = monthSpans(startYear);
                  const spanCells = a.granularity === "四半期"
                    ? QUARTER_SPANS.map((s) => ({ s, span: 3 }))
                    : HALF_SPANS.map((s) => ({ s, span: 6 }));
                  return (
                    <tr key={a.account}>
                      <td style={{ ...tdCell, position: "sticky", left: 0, zIndex: 1, background: rowBg, textAlign: "left", fontWeight: 700, padding: "6px 10px", minWidth: 130, boxShadow: "1px 0 0 #e2e8f0" }}>
                        {a.account}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>{a.unit}</div>
                      </td>
                      <td style={{ ...tdCell, background: rowBg, padding: "4px 6px" }}>
                        <select value={a.granularity} onChange={(e) => setGranularity(a.account, e.target.value as Granularity)} style={{ border: "1px solid #cbd5e1", borderRadius: 5, padding: "3px 5px", fontSize: 11.5, background: "#fff" }}>
                          <option>月</option><option>四半期</option><option>半期</option>
                        </select>
                      </td>
                      {a.granularity === "月"
                        ? monthCells.map((s) => (
                            <td key={s.key} style={{ ...tdCell, background: rowBg, padding: 0 }}>
                              <input type="number" className="kaikei-cell" value={a.values[s.key] ?? ""} onChange={(e) => setCell(a.account, s.key, e.target.value)} style={cellInput} />
                            </td>
                          ))
                        : spanCells.map(({ s, span }) => (
                            <td key={s.key} colSpan={span} style={{ ...tdCell, background: rowBg, padding: 0 }}>
                              <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "left", padding: "1px 5px 0" }}>{s.label}</div>
                              <input type="number" className="kaikei-cell" value={a.values[s.key] ?? ""} onChange={(e) => setCell(a.account, s.key, e.target.value)} style={cellInput} />
                            </td>
                          ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>粒度を変えると入力欄が切り替わります。月別を基本に、月次で出ない科目（総資産等）は四半期/半期で。保存ボタンは右上にあります。</div>
      </div>
    </MainLayout>
  );
}
