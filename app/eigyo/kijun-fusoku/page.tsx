"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { computeSnow } from "@/lib/kijun-fusoku-snow";
import { PREFECTURE_ORDER, youtoChikiMapUrlForPrefecture } from "@/lib/prefectures";
import { Wind, Snowflake, MapPin, RefreshCw, AlertCircle, Search, Mountain, Map as MapIcon, ExternalLink } from "lucide-react";

interface KijunFusokuRecord {
  ken: string;
  shi: string;
  k1: string;
  k2: string;
  k3: string;
  wind: number | null;
  snow: number | null;
  elev: boolean;
  elevSign: string;
  elevBase: number | null;
  elevMethod: string;
  note: string;
  patternId: string;
  consts: (number | null)[];
}

// 区分の段階レベル（県・市の次に絞り込む）
const SUB_LEVELS = ["k1", "k2", "k3"] as const;
type SubLevel = (typeof SUB_LEVELS)[number];

function distinct(values: string[]): string[] {
  return [...new Set(values.filter((v) => v && v.trim()))].sort((a, b) => a.localeCompare(b, "ja"));
}

export default function KijunFusokuPage() {
  // records は「選択中の県」のレコードのみ保持（県単位でサーバ取得）
  const [records, setRecords] = useState<KijunFusokuRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  // 県ごとの取得結果をクライアント側でもキャッシュ（再選択時の再取得を防ぐ）
  const cacheRef = useRef<Map<string, KijunFusokuRecord[]>>(new Map());

  // 選択状態
  const [ken, setKen] = useState("");
  const [shi, setShi] = useState("");
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [k3, setK3] = useState("");
  const [shiQuery, setShiQuery] = useState(""); // 市・郡・区のインクリメンタル検索
  const [elevation, setElevation] = useState(""); // 標高(m)・標高依存地域の積雪算出用
  // 地理院地図(GSI)の代表点標高（目安）。実敷地標高とは異なるため自動入力はしない
  const [gsi, setGsi] = useState<{ lat: number; lon: number; elevation: number | null; title: string } | null>(null);
  const [gsiLoading, setGsiLoading] = useState(false);

  // 地理院地図APIで地域の代表点標高を取得し、地図を中心表示で開く
  async function lookupGsi(r: KijunFusokuRecord) {
    setGsiLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ ken: r.ken, shi: r.shi, k1: r.k1, k2: r.k2, k3: r.k3 });
      const json = await fetchJson<{ success: boolean; lat: number; lon: number; elevation: number | null; title: string; error?: string }>(
        `/api/eigyo/gsi-elevation?${qs.toString()}`
      );
      if (!json.success) throw new Error(json.error || "代表地点を特定できませんでした");
      setGsi({ lat: json.lat, lon: json.lon, elevation: json.elevation, title: json.title });
      window.open(`https://maps.gsi.go.jp/#15/${json.lat}/${json.lon}/`, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "標高の取得に失敗しました");
    } finally {
      setGsiLoading(false);
    }
  }

  // 選択した県のレコードを取得（県単位。キャッシュ優先）
  async function fetchPrefecture(targetKen: string, refresh = false) {
    if (!targetKen) { setRecords([]); return; }
    const cached = cacheRef.current.get(targetKen);
    if (cached && !refresh) { setRecords(cached); return; }
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<{ success: boolean; records: KijunFusokuRecord[]; error?: string }>(
        `/api/eigyo/kijun-fusoku?ken=${encodeURIComponent(targetKen)}${refresh ? "&refresh=1" : ""}`
      );
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      const recs = json.records || [];
      cacheRef.current.set(targetKen, recs);
      setRecords(recs);
    } catch (e: any) {
      setError(e?.message || "取得に失敗しました");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  // 選択をリセット（上位変更時に下位をクリア。標高入力も都度リセット）。県確定でその県を取得。
  function selectKen(v: string) {
    setKen(v); setShi(""); setK1(""); setK2(""); setK3(""); setShiQuery(""); setElevation(""); setGsi(null);
    fetchPrefecture(v);
  }
  function selectShi(v: string) { setShi(v); setK1(""); setK2(""); setK3(""); setElevation(""); setGsi(null); }
  function selectSub(level: SubLevel, v: string) {
    if (level === "k1") { setK1(v); setK2(""); setK3(""); }
    else if (level === "k2") { setK2(v); setK3(""); }
    else setK3(v);
    setElevation(""); setGsi(null);
  }

  // 県プルダウン（都道府県コード昇順。北海道→沖縄）。一覧は定数なのでDB取得不要。
  const prefectures = PREFECTURE_ORDER;

  // 市・郡・区プルダウン（県で絞り込み + インクリメンタル検索）
  const cities = useMemo(() => {
    if (!ken) return [];
    const all = distinct(records.filter((r) => r.ken === ken).map((r) => r.shi));
    if (!shiQuery.trim()) return all;
    return all.filter((c) => c.includes(shiQuery.trim()));
  }, [records, ken, shiQuery]);

  // 現在の選択に一致する候補
  const sel = { ken, shi, k1, k2, k3 };
  const candidates = useMemo(() => {
    if (!ken) return [];
    return records.filter(
      (r) =>
        r.ken === ken &&
        (!shi || r.shi === shi) &&
        (!k1 || r.k1 === k1) &&
        (!k2 || r.k2 === k2) &&
        (!k3 || r.k3 === k3)
    );
  }, [records, ken, shi, k1, k2, k3]);

  // 次に選択すべき区分レベルと、その候補
  const subSteps = useMemo(() => {
    // 各レベルについて、現在の候補中の非空の値集合を求める
    const steps: { level: SubLevel; options: string[]; value: string }[] = [];
    let pool = candidates;
    for (const level of SUB_LEVELS) {
      const options = distinct(pool.map((r) => r[level]));
      const value = sel[level];
      if (options.length === 0) break; // このレベルの区分は不要
      steps.push({ level, options, value });
      if (!value) break; // 未選択ならここで止める（下位はまだ出さない）
      pool = pool.filter((r) => r[level] === value);
    }
    return steps;
  }, [candidates, k1, k2, k3]);

  // 結果の確定判定
  const result = useMemo(() => {
    if (!ken || !shi) return { state: "incomplete" as const };
    // まだ選ぶべき区分が残っているか
    const pendingStep = subSteps.find((s) => !s.value);
    if (pendingStep) return { state: "need-sub" as const };
    if (candidates.length === 0) return { state: "none" as const };
    // 候補が複数でも風速/積雪/標高が同一なら確定とみなす
    const uniq = new Set(candidates.map((c) => `${c.wind}/${c.snow}/${c.elev}`));
    if (uniq.size === 1 || candidates.length === 1) {
      return { state: "ok" as const, rec: candidates[0] };
    }
    return { state: "ambiguous" as const };
  }, [ken, shi, subSteps, candidates]);

  // 標高依存地域: 入力標高から垂直積雪量を確定算出（計算パターン×定数）。
  // パターンID未割当・定数未設定・式外の場合は manual（算出方法の原文を参照）。
  const snowCalc = useMemo(() => {
    if (result.state !== "ok" || !result.rec?.elev) return null;
    const elv = Number(elevation);
    if (!elevation.trim() || !Number.isFinite(elv) || elv < 0) return null;
    return computeSnow(
      { patternId: result.rec.patternId, consts: result.rec.consts, base: result.rec.elevBase, snow: result.rec.snow },
      elv
    );
  }, [result, elevation]);

  const selectClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 disabled:bg-gray-100 disabled:text-gray-400";

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-sky-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Wind className="w-6 h-6 text-sky-500" />
                基準風速・垂直積雪量 検索
              </h1>
              <p className="text-sm text-gray-500">営業部 &gt; 基準風速・垂直積雪量 検索</p>
            </div>
            <button
              onClick={() => ken && fetchPrefecture(ken, true)}
              disabled={loading || !ken}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              更新
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* 検索条件 */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 地域を選択
                </h3>
                <span className="text-xs text-white/90">
                  {loading ? "読込中..." : ken ? `${records.length.toLocaleString()} 地域` : "県を選択"}
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 県名 */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">県名</label>
                  <select className={selectClass} value={ken} onChange={(e) => selectKen(e.target.value)} disabled={loading}>
                    <option value="">選択してください</option>
                    {prefectures.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 市・郡・区 */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">市・郡・区</label>
                  {ken && (
                    <div className="relative mb-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-emerald-300"
                        placeholder="絞り込み検索"
                        value={shiQuery}
                        onChange={(e) => setShiQuery(e.target.value)}
                      />
                    </div>
                  )}
                  <select className={selectClass} value={shi} onChange={(e) => selectShi(e.target.value)} disabled={!ken}>
                    <option value="">{ken ? "選択してください" : "先に県名を選択"}</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* 区分1〜3（必要な地域のみ動的表示） */}
                {subSteps.map((step, idx) => (
                  <div key={step.level}>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      区分{idx + 1}
                    </label>
                    <select
                      className={selectClass}
                      value={step.value}
                      onChange={(e) => selectSub(step.level, e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {step.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* 結果 */}
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">検索結果</h3>
                <span className="text-xs text-gray-400">2026年4月時点のデータ</span>
              </div>
              <div className="p-6">
                {result.state === "incomplete" && (
                  <p className="text-sm text-gray-500 text-center py-6">県名・市・郡・区を選択してください。</p>
                )}
                {result.state === "need-sub" && (
                  <p className="text-sm text-gray-500 text-center py-6">区分を選択すると結果が表示されます。</p>
                )}
                {result.state === "none" && (
                  <p className="text-sm text-gray-500 text-center py-6">該当する地域が見つかりませんでした。</p>
                )}
                {result.state === "ambiguous" && (
                  <p className="text-sm text-amber-600 text-center py-6">
                    候補が複数あります。区分をさらに絞り込んでください。
                  </p>
                )}
                {result.state === "ok" && result.rec && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 基準風速 */}
                      <div className="rounded-xl border border-sky-100 bg-sky-50 p-5 text-center">
                        <div className="flex items-center justify-center gap-2 text-sky-600 mb-2">
                          <Wind className="w-5 h-5" />
                          <span className="text-sm font-bold">基準風速</span>
                        </div>
                        <div className="text-4xl font-extrabold text-sky-700">
                          {result.rec.wind ?? "—"}
                          <span className="text-lg font-bold ml-1">m/s</span>
                        </div>
                      </div>
                      {/* 垂直積雪量 */}
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                        <div className="flex items-center justify-center gap-2 text-emerald-600 mb-2">
                          <Snowflake className="w-5 h-5" />
                          <span className="text-sm font-bold">垂直積雪量</span>
                        </div>
                        {result.rec.elev ? (
                          <div className="w-full space-y-2">
                            <div className="flex items-center justify-center gap-1 text-amber-600">
                              <Mountain className="w-4 h-4" />
                              <span className="text-xs font-bold">標高依存地域</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={elevation}
                                onChange={(e) => setElevation(e.target.value)}
                                placeholder="標高"
                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                              />
                              <span className="text-sm text-gray-500">m</span>
                            </div>
                            {/* 地理院地図で標高を確認（区分まで確定後）。代表点標高は目安・自動入力しない */}
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => result.rec && lookupGsi(result.rec)}
                                disabled={gsiLoading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 disabled:opacity-50"
                              >
                                <MapIcon className="w-3.5 h-3.5" />
                                {gsiLoading ? "取得中…" : "地理院地図で標高を確認"}
                              </button>
                              {gsi && (
                                <p className="text-[10px] text-gray-500 text-center leading-tight">
                                  目安: 約 <span className="font-bold text-gray-700">{gsi.elevation ?? "—"}</span>m
                                  <span className="text-gray-400">（{gsi.title} の代表点・要敷地確認）</span>
                                  <a
                                    href={`https://maps.gsi.go.jp/#15/${gsi.lat}/${gsi.lon}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 ml-1 text-sky-600 hover:underline"
                                  >
                                    地図 <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </p>
                              )}
                            </div>
                            {snowCalc?.kind === "auto" && snowCalc.cm != null ? (
                              <div className="text-center">
                                <div className="text-4xl font-extrabold text-emerald-700">
                                  {snowCalc.cm}
                                  <span className="text-lg font-bold ml-1">cm</span>
                                </div>
                                <p className="text-[11px] text-emerald-600 mt-1">
                                  標高 {Number(elevation)}m での算出値
                                </p>
                              </div>
                            ) : elevation.trim() ? (
                              <p className="text-[11px] text-gray-500 text-center px-2">
                                この地域は現在自動算出の準備中です。下記の算出方法で確認してください。
                              </p>
                            ) : (
                              <p className="text-[11px] text-gray-400 text-center">標高(m)を入力</p>
                            )}
                          </div>
                        ) : (
                          <div className="text-4xl font-extrabold text-emerald-700">
                            {result.rec.snow ?? "—"}
                            <span className="text-lg font-bold ml-1">cm</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 用途地域の確認: 不動産情報ライブラリ(国交省)の公式地図を当該県・住所検索モードで開く。
                        実敷地を住所検索・クリックして用途地域を確認する(用途地域は区画単位のため代表点では不正確)。 */}
                    {youtoChikiMapUrlForPrefecture(result.rec.ken) && (
                      <a
                        href={youtoChikiMapUrlForPrefecture(result.rec.ken)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl shadow-md hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg transition-all"
                      >
                        <MapPin className="w-5 h-5" />
                        用途地域を確認する（公式地図）
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {/* 選択地域・備考 */}
                    <div className="text-sm text-gray-600">
                      <p className="font-bold text-gray-800">
                        {[result.rec.ken, result.rec.shi, result.rec.k1, result.rec.k2, result.rec.k3]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      {result.rec.note && <p className="mt-1 text-xs text-gray-500">備考: {result.rec.note}</p>}
                    </div>

                    {/* 標高依存地域: 算出方法の原文（根拠・手計算用） */}
                    {result.rec.elev && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                        <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                          <Mountain className="w-3.5 h-3.5" /> 標高による積雪量の算出方法（公式の根拠）
                        </p>
                        {(result.rec.elevSign || result.rec.elevBase != null) && (
                          <p className="text-[11px] text-gray-600">
                            {result.rec.elevBase != null && <>基準標高: {result.rec.elevBase}m　</>}
                            {result.rec.elevSign && <>符号: {result.rec.elevSign}</>}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {result.rec.elevMethod || "（算出方法の記載がありません。所管自治体にご確認ください。）"}
                        </p>
                        {snowCalc?.kind === "auto" && (
                          <p className="text-[11px] text-emerald-600">
                            ※ 上の積雪量は、この算出方法（公式）に標高を当てはめて算出した値です。
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                      ※ 海率は考慮しておりません。リストに無い地域の基準風速は 30m/s が目安です。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
