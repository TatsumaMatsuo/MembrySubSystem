"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { FileText, Search, RefreshCw, AlertCircle, Filter, FileSearch, ExternalLink, X } from "lucide-react";

type Daicho = Record<string, string | number | undefined>;

interface ApiResp {
  success: boolean;
  error?: string;
  cachedAt?: number;
  counts?: { daicho: number; buhin: number };
  pdfEnabled?: boolean;
  daicho?: Daicho[];
  buhin?: Daicho[];
}

// 全体フリーワードの対象列（案件名・各製番）
const FREE_FIELDS = ["案件名", "管理名", "管理番号", "売約番号"] as const;

// Access「参考図面出力画面」のタブ構成を踏襲した検索条件定義。
//  kind: select=該当列の値から単一選択 / range=From-To数値 / contains=部分一致テキスト
type Field = { col: string; kind: "select" | "range" | "contains"; label?: string };
interface Tab { name: string; fields: Field[] }

const TABS: Tab[] = [
  {
    name: "設計情報",
    fields: [
      { col: "期", kind: "range" },
      { col: "建屋区分", kind: "select" },
      { col: "用途", kind: "select" },
      { col: "申請有無", kind: "select" },
      { col: "設計ルート", kind: "select" },
      { col: "設計条件(基準風)", kind: "range", label: "基準風速(m/s)" },
      { col: "設計条件(基準雪)", kind: "range", label: "基準積雪(m)" },
    ],
  },
  {
    name: "建屋情報",
    fields: [
      { col: "間口", kind: "range", label: "間口(m)" },
      { col: "桁行", kind: "range", label: "桁行(m)" },
      { col: "柱ピッチ", kind: "range", label: "柱ピッチ(m)" },
      { col: "軒高", kind: "range", label: "軒高(m)" },
      { col: "勾配", kind: "range", label: "勾配(寸)" },
      { col: "壁面", kind: "select" },
      { col: "柱形状", kind: "select" },
    ],
  },
  {
    name: "出入口情報",
    fields: [
      { col: "出入口1", kind: "select" },
      { col: "出入口2", kind: "select" },
      { col: "サイズ1", kind: "select" },
      { col: "サイズ2", kind: "select" },
      { col: "庇出巾", kind: "range", label: "庇出巾(mm)" },
    ],
  },
  {
    name: "材料情報",
    fields: [
      { col: "C1", kind: "select" }, { col: "T1", kind: "select" }, { col: "G1", kind: "select" },
      { col: "B1", kind: "select" }, { col: "B2", kind: "select" }, { col: "B3", kind: "select" }, { col: "B4", kind: "select" },
      { col: "柱成", kind: "select", label: "柱成H(mm)" }, { col: "梁成", kind: "select", label: "梁成H(mm)" },
      { col: "Ga", kind: "select" }, { col: "WB", kind: "select" }, { col: "Gc", kind: "select" }, { col: "ST", kind: "select" },
      { col: "柱ラチ", kind: "select" }, { col: "梁ラチ", kind: "select" },
      { col: "P1", kind: "select" }, { col: "P2", kind: "select" }, { col: "P3", kind: "select" }, { col: "P4", kind: "select" },
      { col: "B-PL形状", kind: "select" },
    ],
  },
  {
    name: "基礎情報",
    fields: [
      { col: "基礎形状", kind: "select" }, { col: "土間", kind: "select" },
      { col: "F1", kind: "select" }, { col: "F2", kind: "select" }, { col: "F3", kind: "select" }, { col: "FG", kind: "select" },
    ],
  },
  {
    name: "特記事項",
    fields: [
      { col: "形状関連", kind: "contains" }, { col: "出入口関連", kind: "contains" },
      { col: "畜舎関連", kind: "contains" }, { col: "設備関連", kind: "contains" },
      { col: "膜関連", kind: "contains" }, { col: "構造関連", kind: "contains" },
      { col: "移動建屋関連", kind: "contains" }, { col: "開閉関連", kind: "contains" },
      { col: "計画概要memo", kind: "contains", label: "設計概要メモ" },
    ],
  },
];

const ALL_FIELDS = TABS.flatMap((t) => t.fields);
const SELECT_COLS = ALL_FIELDS.filter((f) => f.kind === "select").map((f) => f.col);
const MAX_ROWS = 300;

function s(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}

export default function SankouZuPage() {
  const [all, setAll] = useState<Daicho[]>([]);
  const [pdfEnabled, setPdfEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  // 検索条件
  const [word, setWord] = useState(""); // 全体フリーワード（案件名・製番）
  const [activeTab, setActiveTab] = useState(TABS[0].name);
  const [sel, setSel] = useState<Record<string, string>>({}); // 単一選択
  const [rng, setRng] = useState<Record<string, { min: string; max: string }>>({}); // From-To
  const [txt, setTxt] = useState<Record<string, string>>({}); // 部分一致

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<ApiResp>(`/api/eigyo/sankou-zu${refresh ? "?refresh=1" : ""}`);
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      setAll(json.daicho || []);
      setPdfEnabled(Boolean(json.pdfEnabled));
    } catch (e: any) {
      setError(e?.message || "取得に失敗しました");
      setAll([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, []);

  // 単一選択フィールドの候補（各列の実値から）
  const optionsByCol = useMemo(() => {
    const sets: Record<string, Set<string>> = {};
    for (const c of SELECT_COLS) sets[c] = new Set();
    for (const r of all) for (const c of SELECT_COLS) {
      const v = s(r[c]);
      if (v) sets[c].add(v);
    }
    const out: Record<string, string[]> = {};
    for (const c of SELECT_COLS) out[c] = [...sets[c]].sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
    return out;
  }, [all]);

  function inRange(val: string | number | undefined, min: string, max: string): boolean {
    if (!min && !max) return true;
    if (val == null || val === "") return false;
    const n = Number(val);
    if (!Number.isFinite(n)) return false;
    if (min && n < Number(min)) return false;
    if (max && n > Number(max)) return false;
    return true;
  }

  const filtered = useMemo(() => {
    const w = word.trim();
    return all.filter((r) => {
      if (w && !FREE_FIELDS.some((f) => s(r[f]).includes(w))) return false;
      for (const f of ALL_FIELDS) {
        if (f.kind === "select") {
          const v = sel[f.col];
          if (v && s(r[f.col]) !== v) return false;
        } else if (f.kind === "range") {
          const rr = rng[f.col];
          if (rr && !inRange(r[f.col], rr.min, rr.max)) return false;
        } else {
          const v = (txt[f.col] || "").trim();
          if (v && !s(r[f.col]).includes(v)) return false;
        }
      }
      return true;
    });
  }, [all, word, sel, rng, txt]);

  const shown = filtered.slice(0, MAX_ROWS);

  const activeCount = useMemo(
    () =>
      Object.values(sel).filter(Boolean).length +
      Object.values(rng).filter((r) => r.min || r.max).length +
      Object.values(txt).filter((v) => v.trim()).length +
      (word.trim() ? 1 : 0),
    [sel, rng, txt, word]
  );
  const hasCondition = activeCount > 0;

  // タブごとの設定数（バッジ表示用）
  const tabActiveCount = (tab: Tab) =>
    tab.fields.reduce((n, f) => {
      if (f.kind === "select") return n + (sel[f.col] ? 1 : 0);
      if (f.kind === "range") return n + (rng[f.col]?.min || rng[f.col]?.max ? 1 : 0);
      return n + ((txt[f.col] || "").trim() ? 1 : 0);
    }, 0);

  function resetAll() {
    setWord(""); setSel({}); setRng({}); setTxt({});
  }

  function setSelVal(col: string, v: string) { setSel((p) => ({ ...p, [col]: v })); }
  function setRngVal(col: string, key: "min" | "max", v: string) {
    setRng((p) => ({ ...p, [col]: { min: p[col]?.min || "", max: p[col]?.max || "", [key]: v } }));
  }
  function setTxtVal(col: string, v: string) { setTxt((p) => ({ ...p, [col]: v })); }

  function openPdf(r: Daicho) {
    const name = s(r["ファイル名"]);
    if (!name) { setError("この行にはファイル名が登録されていません"); return; }
    window.open(`/api/eigyo/sankou-zu/file?name=${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
  }

  const selectClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";
  const rangeClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";

  const current = TABS.find((t) => t.name === activeTab)!;

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileSearch className="w-6 h-6 text-indigo-500" />
                参考図台帳検索
              </h1>
              <p className="text-sm text-gray-500">営業部 &gt; 参考図台帳検索</p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              更新
            </button>
          </div>
        </div>

        {/* メイン: 左=絞り込み / 右=結果 */}
        <main className="flex-1 overflow-hidden p-4 sm:p-6">
          <div className="h-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4">
            {/* 絞り込み */}
            <aside className="lg:w-96 flex-shrink-0 bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4" /> 絞り込み{activeCount > 0 && `（${activeCount}）`}
                </h3>
                {hasCondition && (
                  <button onClick={resetAll} className="text-xs text-white/90 hover:text-white flex items-center gap-1">
                    <X className="w-3 h-3" /> クリア
                  </button>
                )}
              </div>

              {/* 全体フリーワード（常時表示） */}
              <div className="p-3 border-b border-gray-100">
                <label className="block text-xs font-bold text-gray-600 mb-1">フリーワード（案件名・管理名・各製番）</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className={`${selectClass} pl-8`} value={word} onChange={(e) => setWord(e.target.value)} placeholder="例: 倉庫、12345" />
                </div>
              </div>

              {/* タブ */}
              <div className="flex flex-wrap gap-1 px-2 pt-2">
                {TABS.map((t) => {
                  const cnt = tabActiveCount(t);
                  const on = t.name === activeTab;
                  return (
                    <button
                      key={t.name}
                      onClick={() => setActiveTab(t.name)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-t-md border-b-2 transition-colors ${
                        on ? "text-indigo-700 border-indigo-500 bg-indigo-50" : "text-gray-500 border-transparent hover:bg-gray-50"
                      }`}
                    >
                      {t.name}{cnt > 0 && <span className="ml-1 text-indigo-500">({cnt})</span>}
                    </button>
                  );
                })}
              </div>

              {/* タブ内容 */}
              <div className="p-3 grid grid-cols-2 gap-3 overflow-y-auto">
                {current.fields.map((f) => {
                  const label = f.label || f.col;
                  if (f.kind === "range") {
                    const r = rng[f.col] || { min: "", max: "" };
                    return (
                      <div key={f.col} className="col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
                        <div className="flex items-center gap-2">
                          <input type="number" className={rangeClass} value={r.min} onChange={(e) => setRngVal(f.col, "min", e.target.value)} placeholder="From" />
                          <span className="text-gray-400 text-sm">〜</span>
                          <input type="number" className={rangeClass} value={r.max} onChange={(e) => setRngVal(f.col, "max", e.target.value)} placeholder="To" />
                        </div>
                      </div>
                    );
                  }
                  if (f.kind === "contains") {
                    return (
                      <div key={f.col} className="col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
                        <input className={selectClass} value={txt[f.col] || ""} onChange={(e) => setTxtVal(f.col, e.target.value)} placeholder="キーワード（部分一致）" />
                      </div>
                    );
                  }
                  // select
                  const opts = optionsByCol[f.col] || [];
                  return (
                    <div key={f.col}>
                      <label className="block text-xs font-bold text-gray-600 mb-1 truncate">{label}</label>
                      <select className={selectClass} value={sel[f.col] || ""} onChange={(e) => setSelVal(f.col, e.target.value)}>
                        <option value="">指定なし（{opts.length}）</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* 結果 */}
            <section className="flex-1 bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-700">検索結果</h3>
                <span className="text-xs text-gray-500">
                  {loading ? "読込中..." : `${filtered.length.toLocaleString()} / ${all.length.toLocaleString()} 件`}
                  {filtered.length > MAX_ROWS && `（上位 ${MAX_ROWS} 件表示）`}
                </span>
              </div>

              {error && (
                <div className="m-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {!pdfEnabled && !loading && all.length > 0 && (
                <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  PDF連携(Box)は準備中です。図面を開く機能はBox設定後に有効になります。
                </div>
              )}

              <div className="flex-1 overflow-auto p-3 min-h-0">
                {loading ? (
                  <p className="text-sm text-gray-500 text-center py-10">読み込み中...</p>
                ) : !hasCondition ? (
                  <p className="text-sm text-gray-500 text-center py-10">
                    左の条件で絞り込んでください（全 {all.length.toLocaleString()} 件）。
                  </p>
                ) : shown.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-10">該当する図面が見つかりませんでした。</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-2 py-2 font-bold">案件名</th>
                        <th className="px-2 py-2 font-bold">用途</th>
                        <th className="px-2 py-2 font-bold">建屋区分</th>
                        <th className="px-2 py-2 font-bold whitespace-nowrap">間口×桁行×軒高</th>
                        <th className="px-2 py-2 font-bold">期</th>
                        <th className="px-2 py-2 font-bold">申請</th>
                        <th className="px-2 py-2 font-bold">図面</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, i) => (
                        <tr key={`${s(r["伝票番号"])}-${i}`} className="border-t border-gray-100 hover:bg-indigo-50/40">
                          <td className="px-2 py-2 text-gray-800">
                            {s(r["案件名"]) || s(r["管理名"]) || <span className="text-gray-400">（無題）</span>}
                            {s(r["売約番号"]) && <span className="block text-[10px] text-gray-400">売約 {s(r["売約番号"])}</span>}
                          </td>
                          <td className="px-2 py-2 text-gray-600">{s(r["用途"])}</td>
                          <td className="px-2 py-2 text-gray-600">{s(r["建屋区分"])}</td>
                          <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                            {[r["間口"], r["桁行"], r["軒高"]].map((v) => (v == null ? "—" : v)).join(" × ")}
                          </td>
                          <td className="px-2 py-2 text-gray-600">{s(r["期"])}</td>
                          <td className="px-2 py-2 text-gray-600">{s(r["申請有無"])}</td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => openPdf(r)}
                              disabled={!pdfEnabled || !s(r["ファイル名"])}
                              title={pdfEnabled ? s(r["ファイル名"]) : "PDF連携は準備中です"}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              開く
                              {pdfEnabled && <ExternalLink className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
