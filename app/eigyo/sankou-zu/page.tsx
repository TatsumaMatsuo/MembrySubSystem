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

// 自由語検索の対象列
const FREE_FIELDS = ["案件名", "管理名", "管理番号", "売約番号"] as const;
// 部材キーワード検索の対象列（部材記号＋関連まとめ）
const BUZAI_FIELDS = [
  "形状関連", "出入口関連", "膜関連", "設備関連", "構造関連", "移動建屋関連", "開閉関連", "畜舎関連",
  "柱形状", "B-PL形状", "C1", "柱成", "梁成", "G1", "B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4",
  "Ga", "Gc", "WB", "ST", "基礎形状",
] as const;

const MAX_ROWS = 300; // 一覧の表示上限（超過時は件数を表示して絞り込みを促す）

function s(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}
function distinct(values: (string | number | undefined)[]): string[] {
  return [...new Set(values.map(s).filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b, "ja"));
}

export default function SankouZuPage() {
  const [all, setAll] = useState<Daicho[]>([]);
  const [buhin, setBuhin] = useState<Daicho[]>([]);
  const [pdfEnabled, setPdfEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  // 検索条件
  const [word, setWord] = useState("");
  const [buzai, setBuzai] = useState("");
  const [youto, setYouto] = useState<Set<string>>(new Set());
  const [tateya, setTateya] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<Set<string>>(new Set()); // 設計ルート
  const [shinsei, setShinsei] = useState<Set<string>>(new Set()); // 申請有無
  const [kiMin, setKiMin] = useState("");
  const [kiMax, setKiMax] = useState("");
  const [maguchiMin, setMaguchiMin] = useState("");
  const [maguchiMax, setMaguchiMax] = useState("");
  const [ketaMin, setKetaMin] = useState("");
  const [ketaMax, setKetaMax] = useState("");
  const [nokiMin, setNokiMin] = useState("");
  const [nokiMax, setNokiMax] = useState("");
  const [fuMin, setFuMin] = useState(""); // 設計条件(基準風)
  const [fuMax, setFuMax] = useState("");
  const [yukiMin, setYukiMin] = useState(""); // 設計条件(基準雪)
  const [yukiMax, setYukiMax] = useState("");
  const [pitchMin, setPitchMin] = useState(""); // 柱ピッチ
  const [pitchMax, setPitchMax] = useState("");
  const [koubaiMin, setKoubaiMin] = useState(""); // 勾配
  const [koubaiMax, setKoubaiMax] = useState("");
  const [hisashiMin, setHisashiMin] = useState(""); // 庇出巾
  const [hisashiMax, setHisashiMax] = useState("");
  const [buzaiKigou, setBuzaiKigou] = useState(""); // 部材記号(部品マスタ 分類1 = 台帳の列名)
  const [buzaiHinmei, setBuzaiHinmei] = useState(""); // 部品名称

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<ApiResp>(`/api/eigyo/sankou-zu${refresh ? "?refresh=1" : ""}`);
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      setAll(json.daicho || []);
      setBuhin(json.buhin || []);
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

  const youtoOptions = useMemo(() => distinct(all.map((r) => r["用途"])), [all]);
  const tateyaOptions = useMemo(() => distinct(all.map((r) => r["建屋区分"])), [all]);
  const routeOptions = useMemo(() => distinct(all.map((r) => r["設計ルート"])), [all]);
  const shinseiOptions = useMemo(() => distinct(all.map((r) => r["申請有無"])), [all]);

  // 部材記号(部品マスタ 分類1)の一覧。台帳の同名列を絞り込み対象にする
  const buzaiKigouOptions = useMemo(() => distinct(buhin.map((r) => r["分類1"])), [buhin]);
  // 選択中の部材記号に対応する部品名称候補
  const buzaiHinmeiOptions = useMemo(() => {
    if (!buzaiKigou) return [];
    return distinct(buhin.filter((r) => s(r["分類1"]) === buzaiKigou).map((r) => r["部品名称"]));
  }, [buhin, buzaiKigou]);

  function toggle(setFn: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) {
    setFn((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

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
    const bz = buzai.trim();
    return all.filter((r) => {
      if (w && !FREE_FIELDS.some((f) => s(r[f]).includes(w))) return false;
      if (bz && !BUZAI_FIELDS.some((f) => s(r[f]).includes(bz))) return false;
      if (youto.size > 0 && !youto.has(s(r["用途"]))) return false;
      if (tateya.size > 0 && !tateya.has(s(r["建屋区分"]))) return false;
      if (route.size > 0 && !route.has(s(r["設計ルート"]))) return false;
      if (shinsei.size > 0 && !shinsei.has(s(r["申請有無"]))) return false;
      if (!inRange(r["期"], kiMin, kiMax)) return false;
      if (!inRange(r["間口"], maguchiMin, maguchiMax)) return false;
      if (!inRange(r["桁行"], ketaMin, ketaMax)) return false;
      if (!inRange(r["軒高"], nokiMin, nokiMax)) return false;
      if (!inRange(r["設計条件(基準風)"], fuMin, fuMax)) return false;
      if (!inRange(r["設計条件(基準雪)"], yukiMin, yukiMax)) return false;
      if (!inRange(r["柱ピッチ"], pitchMin, pitchMax)) return false;
      if (!inRange(r["勾配"], koubaiMin, koubaiMax)) return false;
      if (!inRange(r["庇出巾"], hisashiMin, hisashiMax)) return false;
      if (buzaiKigou && buzaiHinmei && s(r[buzaiKigou]) !== buzaiHinmei) return false;
      return true;
    });
  }, [all, word, buzai, youto, tateya, route, shinsei, kiMin, kiMax, maguchiMin, maguchiMax,
      ketaMin, ketaMax, nokiMin, nokiMax, fuMin, fuMax, yukiMin, yukiMax, pitchMin, pitchMax,
      koubaiMin, koubaiMax, hisashiMin, hisashiMax, buzaiKigou, buzaiHinmei]);

  const shown = filtered.slice(0, MAX_ROWS);

  // 条件が初期状態か（全件＝条件なしのときは一覧を出さず件数だけ案内）
  const hasCondition =
    !!word.trim() || !!buzai.trim() || youto.size > 0 || tateya.size > 0 ||
    route.size > 0 || shinsei.size > 0 ||
    !!(kiMin || kiMax || maguchiMin || maguchiMax || ketaMin || ketaMax || nokiMin || nokiMax) ||
    !!(fuMin || fuMax || yukiMin || yukiMax || pitchMin || pitchMax || koubaiMin || koubaiMax || hisashiMin || hisashiMax) ||
    !!(buzaiKigou && buzaiHinmei);

  function resetAll() {
    setWord(""); setBuzai(""); setYouto(new Set()); setTateya(new Set());
    setRoute(new Set()); setShinsei(new Set());
    setKiMin(""); setKiMax(""); setMaguchiMin(""); setMaguchiMax("");
    setKetaMin(""); setKetaMax(""); setNokiMin(""); setNokiMax("");
    setFuMin(""); setFuMax(""); setYukiMin(""); setYukiMax("");
    setPitchMin(""); setPitchMax(""); setKoubaiMin(""); setKoubaiMax("");
    setHisashiMin(""); setHisashiMax("");
    setBuzaiKigou(""); setBuzaiHinmei("");
  }

  function openPdf(r: Daicho) {
    const name = s(r["ファイル名"]);
    if (!name) { setError("この行にはファイル名が登録されていません"); return; }
    window.open(`/api/eigyo/sankou-zu/file?name=${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";
  const rangeClass =
    "w-20 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";

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
            <aside className="lg:w-80 flex-shrink-0 bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4" /> 絞り込み
                </h3>
                {hasCondition && (
                  <button onClick={resetAll} className="text-xs text-white/90 hover:text-white flex items-center gap-1">
                    <X className="w-3 h-3" /> クリア
                  </button>
                )}
              </div>
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* フリーワード */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">フリーワード（案件名・管理名・管理番号・売約番号）</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputClass} pl-8`} value={word} onChange={(e) => setWord(e.target.value)} placeholder="例: 倉庫、12345" />
                  </div>
                </div>

                {/* 部材キーワード */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">部材・仕様キーワード</label>
                  <input className={inputClass} value={buzai} onChange={(e) => setBuzai(e.target.value)} placeholder="例: ハンガードア、芯材" />
                </div>

                {/* 期 範囲 */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">期</label>
                  <div className="flex items-center gap-2">
                    <input type="number" className={rangeClass} value={kiMin} onChange={(e) => setKiMin(e.target.value)} placeholder="最小" />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input type="number" className={rangeClass} value={kiMax} onChange={(e) => setKiMax(e.target.value)} placeholder="最大" />
                  </div>
                </div>

                {/* 寸法・条件 範囲 */}
                {([
                  ["間口（m）", maguchiMin, setMaguchiMin, maguchiMax, setMaguchiMax],
                  ["桁行（m）", ketaMin, setKetaMin, ketaMax, setKetaMax],
                  ["軒高（m）", nokiMin, setNokiMin, nokiMax, setNokiMax],
                  ["柱ピッチ（m）", pitchMin, setPitchMin, pitchMax, setPitchMax],
                  ["勾配", koubaiMin, setKoubaiMin, koubaiMax, setKoubaiMax],
                  ["庇出巾（m）", hisashiMin, setHisashiMin, hisashiMax, setHisashiMax],
                  ["基準風速（m/s）", fuMin, setFuMin, fuMax, setFuMax],
                  ["垂直積雪量（cm）", yukiMin, setYukiMin, yukiMax, setYukiMax],
                ] as const).map(([label, vmin, setMin, vmax, setMax]) => (
                  <div key={label}>
                    <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className={rangeClass} value={vmin} onChange={(e) => setMin(e.target.value)} placeholder="最小" />
                      <span className="text-gray-400 text-sm">〜</span>
                      <input type="number" className={rangeClass} value={vmax} onChange={(e) => setMax(e.target.value)} placeholder="最大" />
                    </div>
                  </div>
                ))}

                {/* 部材検索（部品マスタ連携: 部材記号→部品名称で台帳の該当列を絞り込み） */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">部材検索（記号→部品名称）</label>
                  <select
                    className={inputClass}
                    value={buzaiKigou}
                    onChange={(e) => { setBuzaiKigou(e.target.value); setBuzaiHinmei(""); }}
                  >
                    <option value="">部材記号を選択</option>
                    {buzaiKigouOptions.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  {buzaiKigou && (
                    <select
                      className={`${inputClass} mt-1`}
                      value={buzaiHinmei}
                      onChange={(e) => setBuzaiHinmei(e.target.value)}
                    >
                      <option value="">部品名称を選択（{buzaiHinmeiOptions.length}件）</option>
                      {buzaiHinmeiOptions.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 用途（複数） */}
                <FacetGroup label="用途" options={youtoOptions} selected={youto} onToggle={(v) => toggle(setYouto, v)} />
                {/* 建屋区分（複数） */}
                <FacetGroup label="建屋区分" options={tateyaOptions} selected={tateya} onToggle={(v) => toggle(setTateya, v)} />
                {/* 設計ルート（複数） */}
                <FacetGroup label="設計ルート" options={routeOptions} selected={route} onToggle={(v) => toggle(setRoute, v)} />
                {/* 申請有無（複数） */}
                <FacetGroup label="申請有無" options={shinseiOptions} selected={shinsei} onToggle={(v) => toggle(setShinsei, v)} />
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

/** 複数選択のファセット（チェックボックス一覧・件数多いので絞り込み入力付き）。 */
function FacetGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => (q.trim() ? options.filter((o) => o.includes(q.trim())) : options),
    [options, q]
  );
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">
        {label}
        {selected.size > 0 && <span className="ml-1 text-indigo-500">（{selected.size}）</span>}
      </label>
      {options.length > 8 && (
        <input
          className="w-full px-2 py-1 mb-1 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-indigo-300"
          placeholder={`${label}を絞り込み`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-md p-1 space-y-0.5">
        {list.length === 0 ? (
          <p className="text-[11px] text-gray-400 px-1 py-2">該当なし</p>
        ) : (
          list.map((o) => (
            <label key={o} className="flex items-center gap-2 px-1 py-0.5 text-xs text-gray-700 hover:bg-gray-50 rounded cursor-pointer">
              <input type="checkbox" checked={selected.has(o)} onChange={() => onToggle(o)} className="rounded text-indigo-500 focus:ring-indigo-400" />
              <span className="truncate">{o}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
