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

function spansFor(g: Granularity, startYear: number) {
  return g === "月" ? monthSpans(startYear) : g === "四半期" ? QUARTER_SPANS : HALF_SPANS;
}

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
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessage(`✅ ${json.data.saved}件を保存しました`);
      await load(period);
    } catch (e: any) { setMessage(`保存エラー: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout>
      <div style={{ padding: 20, maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f3864", margin: 0 }}>会計データ入力</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <select value={period} onChange={(e) => changePeriod(Number(e.target.value))} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#1f3864", background: "#fff", cursor: "pointer" }}>
              {(periods.length ? periods : [period]).map((p) => <option key={p} value={p}>{p}期</option>)}
            </select>
            <button onClick={() => load(period)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px" }} /> 再読込
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

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 6, overflowX: "auto" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>読み込み中…</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, whiteSpace: "nowrap" }}>
              <tbody>
                {accounts.map((a) => {
                  const spans = spansFor(a.granularity, startYear);
                  return (
                    <tr key={a.account} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700, position: "sticky", left: 0, background: "#fff", minWidth: 110 }}>{a.account}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>{a.unit}</div></td>
                      <td style={{ padding: "7px 8px" }}>
                        <select value={a.granularity} onChange={(e) => setGranularity(a.account, e.target.value as Granularity)} style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 6px", fontSize: 11.5 }}>
                          <option>月</option><option>四半期</option><option>半期</option>
                        </select>
                      </td>
                      {spans.map((s) => (
                        <td key={s.key} style={{ padding: "5px 4px", textAlign: "center" }}>
                          <div style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 2 }}>{s.label}</div>
                          <input
                            type="number"
                            value={a.values[s.key] ?? ""}
                            onChange={(e) => setCell(a.account, s.key, e.target.value)}
                            style={{ width: a.granularity === "月" ? 56 : 84, border: "1px solid #e2e8f0", borderRadius: 5, padding: "4px 5px", textAlign: "right", fontSize: 12 }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button onClick={save} disabled={saving || dirtyItems.length === 0} style={{ background: dirtyItems.length ? "#1f3864" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: dirtyItems.length ? "pointer" : "default" }}>
            <Save size={14} style={{ verticalAlign: "-2px" }} /> {saving ? "保存中…" : `保存 (${dirtyItems.length}件)`}
          </button>
          <span style={{ fontSize: 11, color: "#64748b" }}>粒度を変えると入力欄が切り替わります。月別を基本に、月次で出ない科目（総資産等）は四半期/半期で。</span>
        </div>
      </div>
    </MainLayout>
  );
}
