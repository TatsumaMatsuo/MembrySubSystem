"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { FileText, Search, RefreshCw, AlertCircle, Filter, FileSearch, ExternalLink, X, Download, List, Briefcase, Plus, Save, Pencil, Upload, ChevronDown, ChevronUp } from "lucide-react";

type Daicho = Record<string, string | number | undefined>;

interface ApiResp {
  success: boolean;
  error?: string;
  cachedAt?: number;
  counts?: { daicho: number; buhin: number };
  pdfEnabled?: boolean;
  daicho?: Daicho[];
  buhin?: Daicho[];
  hanyou?: Record<string, string[]>; // 汎用マスタ 項目名→内容[]
}

// 全体フリーワードの対象列（案件名・各製番）
const FREE_FIELDS = ["案件名", "管理名", "管理番号", "売約番号"] as const;

// 詳細表示・Excel出力に使う全列（Access 参照図面情報2 の順）
const ALL_COLS = [
  "伝票番号", "管理番号", "管理名", "売約番号", "案件名", "期", "設計ルート", "申請有無",
  "設計条件(基準風)", "設計条件(基準雪)", "建屋区分", "用途", "計画概要memo",
  "間口", "桁行", "軒高", "柱ピッチ", "勾配",
  "出入口1", "サイズ1", "出入口2", "サイズ2", "庇出巾", "壁面",
  "柱形状", "B-PL形状", "C1", "柱成", "柱ラチ", "T1", "梁成", "梁ラチ", "G1",
  "B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4", "Ga", "Gc", "WB", "ST",
  "基礎形状", "F1", "F2", "F3", "FG", "土間",
  "形状関連", "出入口関連", "膜関連", "設備関連", "構造関連", "移動建屋関連", "開閉関連", "畜舎関連",
  "ファイル名",
] as const;

// 結果一覧のグリッド列（横スクロール）
const RESULT_COLS: { col: string; label: string }[] = [
  { col: "伝票番号", label: "伝票番号" },
  { col: "案件名", label: "案件名" },
  { col: "売約番号", label: "受注製番" },
  { col: "管理番号", label: "管理番号" },
  { col: "建屋区分", label: "建屋区分" },
  { col: "用途", label: "用途" },
  { col: "申請有無", label: "申請" },
  { col: "設計ルート", label: "設計ルート" },
  { col: "間口", label: "間口" },
  { col: "桁行", label: "桁行" },
  { col: "軒高", label: "軒高" },
  { col: "柱ピッチ", label: "柱ピッチ" },
  { col: "勾配", label: "勾配" },
  { col: "設計条件(基準風)", label: "基準風速" },
  { col: "設計条件(基準雪)", label: "基準積雪" },
  { col: "期", label: "期" },
];

// Access「参考図面出力画面」のタブ構成を踏襲した検索条件定義。
//  kind: select=該当列の値から選択(検索ポップアップ) / range=From-To数値 / contains=部分一致テキスト
// select=候補から単一選択(完全一致) / range=From-To / contains=部分一致テキスト / keyword=候補から選び部分一致
type Field = { col: string; kind: "select" | "range" | "contains" | "keyword"; label?: string };
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
      { col: "サイズ1", kind: "contains" },
      { col: "サイズ2", kind: "contains" },
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
      { col: "形状関連", kind: "keyword" }, { col: "出入口関連", kind: "keyword" },
      { col: "畜舎関連", kind: "keyword" }, { col: "設備関連", kind: "keyword" },
      { col: "膜関連", kind: "keyword" }, { col: "構造関連", kind: "keyword" },
      { col: "移動建屋関連", kind: "keyword" }, { col: "開閉関連", kind: "keyword" },
      { col: "計画概要memo", kind: "contains", label: "設計概要メモ" },
    ],
  },
];

const ALL_FIELDS = TABS.flatMap((t) => t.fields);
// 候補から選ぶ項目(検索ポップアップ): select=完全一致 / keyword=部分一致
const PICK_COLS = ALL_FIELDS.filter((f) => f.kind === "select" || f.kind === "keyword").map((f) => f.col);
const KIND_BY_COL: Record<string, Field["kind"]> = Object.fromEntries(ALL_FIELDS.map((f) => [f.col, f.kind]));
const FIELD_LABEL: Record<string, string> = Object.fromEntries(ALL_FIELDS.map((f) => [f.col, f.label || f.col]));

// 候補を「参考図部品マスタ」(分類1→部品名称)から引く部材記号17項目。
const BUHIN_COLS = new Set([
  "C1", "T1", "G1", "B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4",
  "Ga", "Gc", "WB", "ST", "柱ラチ", "梁ラチ",
]);
// 汎用マスタ(項目名)から候補を引く列 → 対象の項目名(複数可)。それ以外の★は台帳実値をフォールバック。
const MASTER_ITEMS: Record<string, string[]> = {
  "用途": ["用途"], "柱形状": ["柱形状"], "壁面": ["壁面"], "土間": ["土間"], "基礎形状": ["基礎形状"],
  "B-PL形状": ["BPL"], "出入口1": ["出入口種類"], "出入口2": ["出入口種類"],
  "F1": ["F1布基礎", "F1独立基礎", "F1H鋼材"], "F2": ["F2布基礎", "F2独立基礎"],
  "F3": ["F3布基礎", "F3独立基礎"], "FG": ["FG布基礎", "FG独立基礎"],
  "形状関連": ["形状関連"], "出入口関連": ["出入口関連"], "膜関連": ["膜関連"], "設備関連": ["設備関連"],
  "構造関連": ["構造関連"], "移動建屋関連": ["移動建屋関連"], "開閉関連": ["開閉関連"], "畜舎関連": ["畜舎関連"],
};
const MAX_ROWS = 300;

// 登録フォーム: 数値入力にする列／複数行テキストにする列
const NUMERIC_COLS = new Set([
  "伝票番号", "期", "設計条件(基準風)", "設計条件(基準雪)", "間口", "桁行", "軒高", "柱ピッチ", "勾配", "庇出巾",
]);
const TEXTAREA_COLS = new Set([
  "計画概要memo", "形状関連", "出入口関連", "膜関連", "設備関連", "構造関連", "移動建屋関連", "開閉関連", "畜舎関連",
]);
// 登録フォームのグループ（全60列。ファイル名は図面アップロードで設定）
const REG_GROUPS: { name: string; cols: string[] }[] = [
  { name: "基本", cols: ["案件名", "管理名", "管理番号", "売約番号", "期", "設計ルート", "申請有無", "設計条件(基準風)", "設計条件(基準雪)", "建屋区分", "用途", "計画概要memo"] },
  { name: "寸法", cols: ["間口", "桁行", "軒高", "柱ピッチ", "勾配"] },
  { name: "出入口", cols: ["出入口1", "サイズ1", "出入口2", "サイズ2", "庇出巾", "壁面"] },
  { name: "部材", cols: ["柱形状", "B-PL形状", "C1", "柱成", "柱ラチ", "T1", "梁成", "梁ラチ", "G1", "B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4", "Ga", "Gc", "WB", "ST"] },
  { name: "基礎", cols: ["基礎形状", "F1", "F2", "F3", "FG", "土間"] },
  { name: "関連", cols: ["形状関連", "出入口関連", "膜関連", "設備関連", "構造関連", "移動建屋関連", "開閉関連", "畜舎関連"] },
];

function s(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}

// 参考図台帳検索の本体。営業部(閲覧のみ)と設計部(登録/編集可)で別ルートから props で呼び分ける。
//  - canRegister: 登録/編集ボタンを表示するか(設計部=true / 営業部=false)
//  - deptLabel: 題名下のパンくず表記(部署別)
// ※以前は同一URL(?register=1)で切替えていたが、Next の同一パス遷移で追従しないため
//   /eigyo/sankou-zu(営業部) と /sekkei/sankou-zu(設計部) の別ルートに分離した。
export function SankouZuView({ canRegister, deptLabel }: { canRegister: boolean; deptLabel: string }) {
  const [all, setAll] = useState<Daicho[]>([]);
  const [buhin, setBuhin] = useState<Daicho[]>([]);
  const [hanyou, setHanyou] = useState<Record<string, string[]>>({});
  const [pdfEnabled, setPdfEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);
  const lastSearchSig = useRef<string>(""); // 情報取得計測の重複防止(同一条件は再計上しない)

  // 検索条件
  const [word, setWord] = useState(""); // 全体フリーワード（案件名・製番）
  const [activeTab, setActiveTab] = useState(TABS[0].name);
  const [sel, setSel] = useState<Record<string, string>>({}); // 単一選択
  const [rng, setRng] = useState<Record<string, { min: string; max: string }>>({}); // From-To
  const [txt, setTxt] = useState<Record<string, string>>({}); // 部分一致
  const [filterOpen, setFilterOpen] = useState(true); // 絞り込みパネルの開閉（モバイルで結果確保のため折りたたみ可）

  // モーダル
  const [picker, setPicker] = useState<string | null>(null); // 検索ポップアップ中の列
  const [detail, setDetail] = useState<Daicho | null>(null); // 詳細表示中の行
  const [register, setRegister] = useState<Daicho | null>(null); // 登録/編集中の行(空={}=新規)

  // 利用状況の計測(失敗してもUIに影響させない fire-and-forget)
  function logUsage(type: "launch" | "fetch") {
    try {
      fetch("/api/eigyo/sankou-zu/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* noop */ }
  }

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<ApiResp>(`/api/eigyo/sankou-zu${refresh ? "?refresh=1" : ""}`);
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      setAll(json.daicho || []);
      setBuhin(json.buhin || []);
      setHanyou(json.hanyou || {});
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
    logUsage("launch"); // 起動回数 +1(メニュー選択=ページ起動)
    load();
  }, []);

  // 検索ポップアップの候補。優先順:
  //  部材記号17項目(BUHIN_COLS) → 参考図部品マスタ(分類1→部品名称)
  //  汎用マスタ対象(MASTER_ITEMS) → 汎用マスタ(システム名=参考図面情報, 項目名→内容。複数項目は統合)
  //  どちらでもない★ → 台帳の実値(フォールバック)
  const optionsByCol = useMemo(() => {
    const out: Record<string, string[]> = {};
    const sort = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));

    // 部品マスタ: 分類1 → 部品名称 候補
    const buhinByKigou: Record<string, Set<string>> = {};
    for (const r of buhin) {
      const k = s(r["分類1"]);
      const name = s(r["部品名称"]);
      if (!k || !name) continue;
      (buhinByKigou[k] ||= new Set()).add(name);
    }

    // 台帳実値（部品/汎用マスタを持たない列のフォールバック）
    const fallbackCols = PICK_COLS.filter((c) => !BUHIN_COLS.has(c) && !MASTER_ITEMS[c]);
    const daichoSets: Record<string, Set<string>> = {};
    for (const c of fallbackCols) daichoSets[c] = new Set();
    for (const r of all) for (const c of fallbackCols) {
      const v = s(r[c]);
      if (v) daichoSets[c].add(v);
    }

    for (const c of PICK_COLS) {
      if (BUHIN_COLS.has(c)) {
        out[c] = sort([...(buhinByKigou[c] || new Set())]);
      } else if (MASTER_ITEMS[c]) {
        const set = new Set<string>();
        for (const item of MASTER_ITEMS[c]) for (const v of hanyou[item] || []) set.add(v);
        out[c] = sort([...set]);
      } else {
        out[c] = sort([...(daichoSets[c] || new Set())]);
      }
    }
    return out;
  }, [all, buhin, hanyou]);

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
        } else if (f.kind === "keyword") {
          const v = sel[f.col]; // 候補から選び、該当列に部分一致
          if (v && !s(r[f.col]).includes(v)) return false;
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

  const activeCount =
    Object.values(sel).filter(Boolean).length +
    Object.values(rng).filter((r) => r.min || r.max).length +
    Object.values(txt).filter((v) => v.trim()).length +
    (word.trim() ? 1 : 0);
  const hasCondition = activeCount > 0;

  // 情報取得回数: 検索条件が確定し結果が表示されるたびに +1。
  // 入力中の多重計上はデバウンスで抑え、同一条件の再計上は防ぐ。
  useEffect(() => {
    if (!hasCondition || filtered.length === 0) return;
    const sig = JSON.stringify({ word: word.trim(), sel, rng, txt });
    const h = setTimeout(() => {
      if (sig !== lastSearchSig.current) {
        lastSearchSig.current = sig;
        logUsage("fetch");
      }
    }, 1000);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, hasCondition, word, sel, rng, txt]);

  const tabActiveCount = (tab: Tab) =>
    tab.fields.reduce((n, f) => {
      if (f.kind === "select" || f.kind === "keyword") return n + (sel[f.col] ? 1 : 0);
      if (f.kind === "range") return n + (rng[f.col]?.min || rng[f.col]?.max ? 1 : 0);
      return n + ((txt[f.col] || "").trim() ? 1 : 0);
    }, 0);

  function resetAll() {
    setWord(""); setSel({}); setRng({}); setTxt({});
  }

  function setRngVal(col: string, key: "min" | "max", v: string) {
    setRng((p) => ({ ...p, [col]: { min: p[col]?.min || "", max: p[col]?.max || "", [key]: v } }));
  }
  function setTxtVal(col: string, v: string) { setTxt((p) => ({ ...p, [col]: v })); }

  // 売約詳細を別タブで表示。受注製番(売約番号)で存在確認し、無ければメッセージ。
  async function openBaiyaku(r: Daicho) {
    const seiban = s(r["売約番号"]).trim();
    if (!seiban) { setError("この図面には受注製番(売約番号)が登録されていません"); return; }
    // ポップアップブロック回避のため先に同期で新規タブを開く
    const win = window.open("", "_blank");
    if (win) win.document.write("<p style='font:14px sans-serif;padding:16px;color:#555'>売約情報を確認中…</p>");
    try {
      const json = await fetchJson<{ success: boolean }>(`/api/baiyaku-detail?seiban=${encodeURIComponent(seiban)}`);
      if (json.success) {
        const target = `/baiyaku/${encodeURIComponent(seiban)}`;
        if (win) win.location.href = target;
        else window.open(target, "_blank", "noopener,noreferrer");
      } else {
        win?.close();
        setError(`売約情報が存在しません（受注製番: ${seiban}）`);
      }
    } catch {
      // baiyaku-detail は未存在で404を返す → 存在しません扱い
      win?.close();
      setError(`売約情報が存在しません（受注製番: ${seiban}）`);
    }
  }

  function openPdf(r: Daicho) {
    const name = s(r["ファイル名"]);
    if (!name) { setError("この行にはファイル名が登録されていません"); return; }
    // 売約詳細と同方式: 新規タブの pdf-viewer(pdf.js)で表示。ダウンロードはしない。
    const src = `/api/eigyo/sankou-zu/file?name=${encodeURIComponent(name)}`;
    window.open(
      `/pdf-viewer?src=${encodeURIComponent(src)}&name=${encodeURIComponent(name)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // Excel(CSV)出力: 現在の検索結果(全件)を全列でダウンロード。Excel用にBOM付きUTF-8。
  function exportCsv() {
    const esc = (v: unknown) => {
      const t = v == null ? "" : String(v);
      return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = [ALL_COLS.map(esc).join(",")];
    for (const r of filtered) lines.push(ALL_COLS.map((c) => esc(r[c])).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `参考図台帳検索_${filtered.length}件.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400";
  const rangeClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400";

  const current = TABS.find((t) => t.name === activeTab)!;

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-fuchsia-50 to-amber-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
                <FileSearch className="w-6 h-6 text-fuchsia-500 shrink-0" />
                <span className="truncate bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 bg-clip-text text-transparent">
                  参考図台帳検索
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{deptLabel}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canRegister && (
                <button
                  onClick={() => setRegister({})}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-bold rounded-lg hover:from-fuchsia-600 hover:to-purple-600 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">新規登録</span>
                </button>
              )}
              <button
                onClick={() => load(true)}
                disabled={loading}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">更新</span>
              </button>
            </div>
          </div>
        </div>

        {/* メイン: 左=絞り込み / 右=結果 */}
        <main className="flex-1 overflow-hidden p-4 sm:p-6">
          <div className="h-full max-w-full mx-auto flex flex-col lg:flex-row gap-4">
            {/* 絞り込み（モバイルは高さを抑えて結果一覧を確保） */}
            <aside className="lg:w-96 flex-shrink-0 max-h-[45vh] lg:max-h-none bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-sky-500 px-4 py-3 flex items-center justify-between gap-2">
                {/* モバイルではヘッダータップで開閉。PCは常時展開 */}
                <button
                  type="button"
                  onClick={() => setFilterOpen((o) => !o)}
                  className="text-sm font-bold text-white flex items-center gap-2 min-w-0 lg:cursor-default"
                  aria-expanded={filterOpen}
                >
                  <Filter className="w-4 h-4 shrink-0" />
                  <span className="truncate">絞り込み{activeCount > 0 && `（${activeCount}）`}</span>
                  {filterOpen ? <ChevronUp className="w-4 h-4 shrink-0 lg:hidden" /> : <ChevronDown className="w-4 h-4 shrink-0 lg:hidden" />}
                </button>
                {hasCondition && (
                  <button onClick={resetAll} className="text-xs text-white/90 hover:text-white flex items-center gap-1 shrink-0">
                    <X className="w-3 h-3" /> クリア
                  </button>
                )}
              </div>

              {/* 折りたたみ対象（モバイルのみ開閉。PC=lgは常時表示） */}
              <div className={`${filterOpen ? "flex" : "hidden"} lg:flex flex-col flex-1 min-h-0`}>
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
                        on ? "text-fuchsia-700 border-fuchsia-500 bg-fuchsia-50" : "text-gray-500 border-transparent hover:bg-gray-50"
                      }`}
                    >
                      {t.name}{cnt > 0 && <span className="ml-1 text-fuchsia-500">({cnt})</span>}
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
                  // select / keyword: ★検索ポップアップを開くボタン（keywordは選んだ値で部分一致）
                  const v = sel[f.col] || "";
                  const isKw = f.kind === "keyword";
                  return (
                    <div key={f.col} className={isKw ? "col-span-2" : ""}>
                      <label className="block text-xs font-bold text-gray-600 mb-1 truncate">{label}{isKw && "（部分一致）"}</label>
                      <button
                        type="button"
                        onClick={() => setPicker(f.col)}
                        className={`w-full px-2 py-1.5 border rounded-md text-sm text-left truncate flex items-center justify-between gap-1 ${
                          v ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800" : "border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                        title={v || "指定なし"}
                      >
                        <span className="truncate">{v || "指定なし"}</span>
                        <Search className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      </button>
                    </div>
                  );
                })}
              </div>
              </div>
            </aside>

            {/* 結果 */}
            <section className="flex-1 bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 gap-2">
                <h3 className="text-sm font-bold text-gray-700">検索結果</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {loading ? "読込中..." : `${filtered.length.toLocaleString()} / ${all.length.toLocaleString()} 件`}
                    {filtered.length > MAX_ROWS && `（上位 ${MAX_ROWS} 件表示）`}
                  </span>
                  <button
                    onClick={exportCsv}
                    disabled={loading || filtered.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-md hover:from-emerald-600 hover:to-teal-600 shadow-sm disabled:opacity-40"
                    title="検索結果をExcel(CSV)で出力"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel出力
                  </button>
                </div>
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
                  <table className="text-sm border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-2 py-2 font-bold sticky left-0 bg-gray-50">操作</th>
                        {RESULT_COLS.map((c) => (
                          <th key={c.col} className="px-2 py-2 font-bold">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, i) => (
                        <tr key={`${s(r["伝票番号"])}-${i}`} className="border-t border-gray-100 hover:bg-fuchsia-50/40">
                          <td className="px-2 py-1.5 sticky left-0 bg-white">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setDetail(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200"
                                title="詳細表示"
                              >
                                <List className="w-3.5 h-3.5" /> 詳細
                              </button>
                              {canRegister && (
                                <button
                                  onClick={() => setRegister(r)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100"
                                  title="編集"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> 編集
                                </button>
                              )}
                              <button
                                onClick={() => openBaiyaku(r)}
                                disabled={!s(r["売約番号"])}
                                title={s(r["売約番号"]) ? `売約詳細を表示（受注製番: ${s(r["売約番号"])}）` : "受注製番が未登録"}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Briefcase className="w-3.5 h-3.5" /> 売約
                              </button>
                              <button
                                onClick={() => openPdf(r)}
                                disabled={!pdfEnabled || !s(r["ファイル名"])}
                                title={pdfEnabled ? s(r["ファイル名"]) : "PDF連携は準備中です"}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-md hover:bg-fuchsia-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <FileText className="w-3.5 h-3.5" /> 図面
                              </button>
                            </div>
                          </td>
                          {RESULT_COLS.map((c) => (
                            <td key={c.col} className="px-2 py-1.5 text-gray-700">
                              {s(r[c.col]) || <span className="text-gray-300">—</span>}
                            </td>
                          ))}
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

      {/* ★検索ポップアップ（候補から選択） */}
      {picker && (
        <PickerModal
          title={FIELD_LABEL[picker] || picker}
          options={optionsByCol[picker] || []}
          value={sel[picker] || ""}
          onSelect={(v) => { setSel((p) => ({ ...p, [picker]: v })); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}

      {/* 行詳細モーダル */}
      {detail && (
        <DetailModal
          record={detail}
          pdfEnabled={pdfEnabled}
          onOpenPdf={() => openPdf(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      {/* 登録/編集モーダル */}
      {register && (
        <RegisterModal
          initial={register}
          optionsByCol={optionsByCol}
          pdfEnabled={pdfEnabled}
          onClose={() => setRegister(null)}
          onSaved={() => { setRegister(null); load(true); }}
        />
      )}
    </MainLayout>
  );
}

// 営業部ルート(/eigyo/sankou-zu): 閲覧のみ。登録/編集ボタンは非表示。
export default function SankouZuPage() {
  return <SankouZuView canRegister={false} deptLabel="営業部 > 参考図台帳検索" />;
}

/** 登録/編集モーダル: 参考図面台帳の全項目を入力。図面PDFはBoxへアップロードしてファイル名を記録。 */
function RegisterModal({
  initial, optionsByCol, pdfEnabled, onClose, onSaved,
}: {
  initial: Daicho;
  optionsByCol: Record<string, string[]>;
  pdfEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const denpyo = s(initial["伝票番号"]);
  const isEdit = denpyo !== "";
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const g of REG_GROUPS) for (const c of g.cols) d[c] = s(initial[c]);
    d["ファイル名"] = s(initial["ファイル名"]);
    return d;
  });
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState(REG_GROUPS[0].name);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<string | null>(null); // マスタ選択中の列
  const [baiyakuSearch, setBaiyakuSearch] = useState(false); // 売約検索モーダル

  const set = (c: string, v: string) => setDraft((p) => ({ ...p, [c]: v }));

  function pickFile(f: File | null) {
    setFile(f);
    if (f && !draft["ファイル名"]) set("ファイル名", f.name); // 未入力ならファイル名を初期化
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      // 1) PDFがあればBoxへアップロード（ファイル名はフォームの「ファイル名」を使用）
      let fileName = draft["ファイル名"].trim();
      if (file) {
        if (!pdfEnabled) throw new Error("PDF連携(Box)が未設定のためアップロードできません");
        const fd = new FormData();
        fd.append("file", file);
        if (fileName) fd.append("name", fileName);
        const up = await fetch("/api/eigyo/sankou-zu/upload", { method: "POST", body: fd });
        const uj = await up.json();
        if (!up.ok || !uj.success) throw new Error(uj.error || "アップロードに失敗しました");
        fileName = uj.name;
      }
      // 2) 台帳へ登録/更新
      const fields: Record<string, string> = { ...draft, ファイル名: fileName };
      const res = await fetch("/api/eigyo/sankou-zu/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denpyo: isEdit ? denpyo : undefined, fields }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "登録に失敗しました");
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400";
  const current = REG_GROUPS.find((g) => g.name === tab)!;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-t-xl">
          <h3 className="text-sm font-bold text-white">
            {isEdit ? `参考図面の編集（伝票番号 ${denpyo}）` : "参考図面の新規登録"}
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {err && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {err}
          </div>
        )}

        {/* タブ */}
        <div className="flex flex-wrap gap-1 px-3 pt-3">
          {REG_GROUPS.map((g) => (
            <button
              key={g.name}
              onClick={() => setTab(g.name)}
              className={`px-3 py-1 text-xs font-bold rounded-t-md border-b-2 ${
                g.name === tab ? "text-fuchsia-700 border-fuchsia-500 bg-fuchsia-50" : "text-gray-500 border-transparent hover:bg-gray-50"
              }`}
            >
              {g.name}
            </button>
          ))}
          <button
            onClick={() => setTab("__figure__")}
            className={`px-3 py-1 text-xs font-bold rounded-t-md border-b-2 ${
              tab === "__figure__" ? "text-fuchsia-700 border-fuchsia-500 bg-fuchsia-50" : "text-gray-500 border-transparent hover:bg-gray-50"
            }`}
          >
            図面
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "__figure__" ? (
            <div className="space-y-3 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">ファイル名（PDF突合キー）</label>
                <input className={inputClass} value={draft["ファイル名"]} onChange={(e) => set("ファイル名", e.target.value)} placeholder="例: ★-案件名.pdf" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">図面PDFをアップロード（任意）</label>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 text-sm font-bold rounded-md cursor-pointer hover:bg-fuchsia-100">
                  <Upload className="w-4 h-4" />
                  {file ? "別のファイルを選択" : "ファイルを選択"}
                  <input type="file" className="hidden" accept="application/pdf,.pdf,.xdw" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
                </label>
                {file && <p className="text-xs text-gray-600 mt-1">選択中: {file.name}（{Math.round(file.size / 1024)} KB）→ 保存時にBoxへアップロード</p>}
                {!pdfEnabled && <p className="text-[11px] text-amber-600 mt-1">PDF連携(Box)未設定のためアップロードは無効です。ファイル名のみ記録できます。</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {current.cols.map((c) => {
                const opts = optionsByCol[c] || [];
                // 完全一致でマスタ選択する項目(検索ポップアップ)=自由入力不可。部分一致(関連/サイズ等)=自由入力可。
                const selectMaster = KIND_BY_COL[c] === "select" && opts.length > 0;

                // 売約番号: 自由入力 + 売約検索モーダル(複数条件)。選択時に案件名へ品名+品名2を設定。
                if (c === "売約番号") {
                  return (
                    <div key={c}>
                      <label className="block text-xs font-bold text-gray-600 mb-1">売約番号（受注製番）</label>
                      <div className="flex items-center gap-1">
                        <input className={`${inputClass} flex-1`} value={draft[c] || ""} onChange={(e) => set(c, e.target.value)} />
                        <button
                          type="button"
                          onClick={() => setBaiyakuSearch(true)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-md hover:bg-amber-100 whitespace-nowrap"
                          title="売約情報を検索して選択"
                        >
                          <Briefcase className="w-3.5 h-3.5" /> 売約検索
                        </button>
                      </div>
                    </div>
                  );
                }

                // 完全一致マスタ選択: ポップアップ選択のみ
                if (selectMaster) {
                  const v = draft[c] || "";
                  return (
                    <div key={c}>
                      <label className="block text-xs font-bold text-gray-600 mb-1 truncate">{c}</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPick(c)}
                          className={`flex-1 min-w-0 px-2 py-1.5 border rounded-md text-sm text-left truncate flex items-center justify-between gap-1 ${
                            v ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800" : "border-gray-300 text-gray-500 hover:bg-gray-50"
                          }`}
                          title={v || "選択してください"}
                        >
                          <span className="truncate">{v || "選択してください"}</span>
                          <Search className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        </button>
                        {v && (
                          <button type="button" onClick={() => set(c, "")} className="text-gray-400 hover:text-gray-600 px-1" title="クリア">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // 複数行(関連=部分一致/メモ): 自由入力可。マスタ候補があれば「候補から追加」で末尾に挿入。
                if (TEXTAREA_COLS.has(c)) {
                  return (
                    <div key={c} className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                        <span>{c}</span>
                        {opts.length > 0 && (
                          <button type="button" onClick={() => setPick(c)} className="text-fuchsia-600 hover:text-fuchsia-700 inline-flex items-center gap-0.5 text-[11px]">
                            <Plus className="w-3 h-3" /> 候補から追加
                          </button>
                        )}
                      </label>
                      <textarea className={`${inputClass} h-20`} value={draft[c] || ""} onChange={(e) => set(c, e.target.value)} />
                    </div>
                  );
                }

                // 自由入力(数値/テキスト)。部分一致のサイズ等もここ。
                return (
                  <div key={c}>
                    <label className="block text-xs font-bold text-gray-600 mb-1">{c}</label>
                    <input
                      className={inputClass}
                      type={NUMERIC_COLS.has(c) ? "number" : "text"}
                      value={draft[c] || ""}
                      onChange={(e) => set(c, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">キャンセル</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-bold rounded-lg hover:from-fuchsia-600 hover:to-purple-600 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中..." : isEdit ? "更新する" : "登録する"}
          </button>
        </div>
      </div>
    </div>

    {/* 登録フォーム内のマスタ選択ポップアップ（完全一致=置換 / 関連=末尾に追加） */}
    {pick && (
      <PickerModal
        title={pick}
        options={optionsByCol[pick] || []}
        value={TEXTAREA_COLS.has(pick) ? "" : (draft[pick] || "")}
        onSelect={(val) => {
          const col = pick;
          if (TEXTAREA_COLS.has(col)) {
            if (val) set(col, draft[col] ? `${draft[col]}\n${val}` : val);
          } else {
            set(col, val);
          }
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
    )}

    {/* 売約検索モーダル: 複数条件で売約を検索→選択で 売約番号=製番 / 案件名=品名+品名2 */}
    {baiyakuSearch && (
      <BaiyakuSearchModal
        onSelect={(row) => {
          set("売約番号", row.seiban);
          const anken = `${row.hinmei || ""}${row.hinmei2 || ""}`.trim();
          if (anken) set("案件名", anken);
          setBaiyakuSearch(false);
        }}
        onClose={() => setBaiyakuSearch(false)}
      />
    )}
    </>
  );
}

interface BaiyakuRow {
  seiban: string;
  hinmei: string;
  hinmei2?: string;
  tantousha?: string;
  juchu_date?: string;
  juchu_kingaku?: number;
  tokuisaki_atena1?: string;
  tokuisaki_atena2?: string;
}

/** 売約検索モーダル: 売約情報検索画面と同様の複数条件で /api/baiyaku を検索し、行を選択する。 */
function BaiyakuSearchModal({
  onSelect, onClose,
}: {
  onSelect: (row: BaiyakuRow) => void;
  onClose: () => void;
}) {
  const [seiban, setSeiban] = useState("");
  const [ankenName, setAnkenName] = useState("");
  const [tantousha, setTantousha] = useState("");
  const [tokuisaki, setTokuisaki] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<BaiyakuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [searched, setSearched] = useState(false);

  async function search() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (seiban.trim()) qs.set("seiban", seiban.trim());
      if (ankenName.trim()) qs.set("anken_name", ankenName.trim());
      if (tantousha.trim()) qs.set("tantousha", tantousha.trim());
      if (tokuisaki.trim()) qs.set("tokuisaki", tokuisaki.trim());
      if (dateFrom) qs.set("juchu_date_from", dateFrom);
      if (dateTo) qs.set("juchu_date_to", dateTo);
      qs.set("sales_status", status);
      const json = await fetchJson<{ success: boolean; data: BaiyakuRow[]; error?: string }>(`/api/baiyaku?${qs.toString()}`);
      if (!json.success) throw new Error(json.error || "検索に失敗しました");
      setRows(json.data || []);
      setSearched(true);
    } catch (e: any) {
      setErr(e?.message || "検索に失敗しました");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Briefcase className="w-4 h-4" /> 売約検索</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* 検索条件 */}
        <div className="p-3 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">製番</label>
            <input className={inputClass} value={seiban} onChange={(e) => setSeiban(e.target.value)} placeholder="部分一致" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">案件名（品名）</label>
            <input className={inputClass} value={ankenName} onChange={(e) => setAnkenName(e.target.value)} placeholder="部分一致" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">担当者</label>
            <input className={inputClass} value={tantousha} onChange={(e) => setTantousha(e.target.value)} placeholder="部分一致" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">得意先</label>
            <input className={inputClass} value={tokuisaki} onChange={(e) => setTokuisaki(e.target.value)} placeholder="部分一致" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">ステータス</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">全て</option>
              <option value="juchu_zan">受注残</option>
              <option value="uriagezumi">売上済</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-0.5">受注日</label>
            <div className="flex items-center gap-1">
              <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="text-gray-400 text-xs">〜</span>
              <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end">
            <button onClick={search} disabled={loading} className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50">
              <Search className="w-4 h-4" /> {loading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>

        {err && (
          <div className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {err}
          </div>
        )}

        {/* 結果 */}
        <div className="flex-1 overflow-auto p-3 min-h-0">
          {!searched ? (
            <p className="text-sm text-gray-500 text-center py-10">条件を入れて検索してください。</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">該当する売約が見つかりませんでした。</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-2 py-2 font-bold">製番</th>
                  <th className="px-2 py-2 font-bold">案件名（品名+品名2）</th>
                  <th className="px-2 py-2 font-bold">担当者</th>
                  <th className="px-2 py-2 font-bold">得意先</th>
                  <th className="px-2 py-2 font-bold">受注日</th>
                  <th className="px-2 py-2 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.seiban}-${i}`} className="border-t border-gray-100 hover:bg-amber-50/50">
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{r.seiban}</td>
                    <td className="px-2 py-1.5 text-gray-800">{`${r.hinmei || ""}${r.hinmei2 || ""}`.trim() || <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{r.tantousha || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-600">{`${r.tokuisaki_atena1 || ""} ${r.tokuisaki_atena2 || ""}`.trim() || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{r.juchu_date || "—"}</td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => onSelect(r)} className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 whitespace-nowrap">選択</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/** ★検索ポップアップ: 候補一覧を絞り込んで単一選択（Accessの検索画面相当）。 */
function PickerModal({
  title, options, value, onSelect, onClose,
}: {
  title: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => (q.trim() ? options.filter((o) => o.includes(q.trim())) : options), [options, q]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">{title} を選択</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-fuchsia-400"
              placeholder="候補を絞り込み"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{list.length.toLocaleString()} 件の候補</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => onSelect("")}
            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 ${!value ? "bg-fuchsia-50 text-fuchsia-700 font-bold" : "text-gray-500 hover:bg-gray-50"}`}
          >
            指定なし（クリア）
          </button>
          {list.map((o) => (
            <button
              key={o}
              onClick={() => onSelect(o)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${o === value ? "bg-fuchsia-100 text-fuchsia-800 font-bold" : "text-gray-700 hover:bg-gray-50"}`}
            >
              {o}
            </button>
          ))}
          {list.length === 0 && <p className="text-sm text-gray-400 text-center py-6">該当する候補がありません</p>}
        </div>
      </div>
    </div>
  );
}

/** 行詳細モーダル: 図面の全項目を表示。 */
function DetailModal({
  record, pdfEnabled, onOpenPdf, onClose,
}: {
  record: Daicho;
  pdfEnabled: boolean;
  onOpenPdf: () => void;
  onClose: () => void;
}) {
  const title = s(record["案件名"]) || s(record["管理名"]) || "（無題）";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-800 truncate">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenPdf}
              disabled={!pdfEnabled || !s(record["ファイル名"])}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-fuchsia-600 rounded-md hover:bg-fuchsia-700 disabled:opacity-40"
              title={pdfEnabled ? s(record["ファイル名"]) : "PDF連携は準備中です"}
            >
              <FileText className="w-3.5 h-3.5" /> 図面を開く {pdfEnabled && <ExternalLink className="w-3 h-3" />}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {ALL_COLS.map((c) => {
              const val = s(record[c]);
              const wide = c.endsWith("関連") || c === "計画概要memo";
              return (
                <div key={c} className={wide ? "sm:col-span-2" : ""}>
                  <dt className="text-[11px] font-bold text-gray-500">{c}</dt>
                  <dd className={`text-sm text-gray-800 ${wide ? "whitespace-pre-wrap" : "truncate"}`}>
                    {val || <span className="text-gray-300">—</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </div>
  );
}
