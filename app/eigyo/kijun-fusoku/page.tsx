"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { Wind, Snowflake, MapPin, RefreshCw, AlertCircle, Search, Mountain } from "lucide-react";

interface KijunFusokuRecord {
  ken: string;
  shi: string;
  k1: string;
  k2: string;
  k3: string;
  wind: number | null;
  snow: number | null;
  elev: boolean;
  note: string;
}

// 区分の段階レベル（県・市の次に絞り込む）
const SUB_LEVELS = ["k1", "k2", "k3"] as const;
type SubLevel = (typeof SUB_LEVELS)[number];

function distinct(values: string[]): string[] {
  return [...new Set(values.filter((v) => v && v.trim()))].sort((a, b) => a.localeCompare(b, "ja"));
}

export default function KijunFusokuPage() {
  const [records, setRecords] = useState<KijunFusokuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // 選択状態
  const [ken, setKen] = useState("");
  const [shi, setShi] = useState("");
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [k3, setK3] = useState("");
  const [shiQuery, setShiQuery] = useState(""); // 市・郡・区のインクリメンタル検索

  async function fetchData(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const json = await fetchJson<{ success: boolean; records: KijunFusokuRecord[]; error?: string }>(
        `/api/eigyo/kijun-fusoku${refresh ? "?refresh=1" : ""}`
      );
      if (!json.success) throw new Error(json.error || "取得に失敗しました");
      setRecords(json.records || []);
    } catch (e: any) {
      setError(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 選択をリセット（上位変更時に下位をクリア）
  function selectKen(v: string) { setKen(v); setShi(""); setK1(""); setK2(""); setK3(""); setShiQuery(""); }
  function selectShi(v: string) { setShi(v); setK1(""); setK2(""); setK3(""); }
  function selectSub(level: SubLevel, v: string) {
    if (level === "k1") { setK1(v); setK2(""); setK3(""); }
    else if (level === "k2") { setK2(v); setK3(""); }
    else setK3(v);
  }

  // 県プルダウン
  const prefectures = useMemo(() => distinct(records.map((r) => r.ken)), [records]);

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
              onClick={() => fetchData(true)}
              disabled={loading}
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
                  {loading ? "読込中..." : `${records.length.toLocaleString()} 地域`}
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
                          <div className="flex flex-col items-center justify-center text-amber-600 py-2">
                            <Mountain className="w-6 h-6 mb-1" />
                            <span className="text-sm font-bold">標高計算が必要</span>
                            <span className="text-xs text-amber-500">(標高依存地域・v2対応予定)</span>
                          </div>
                        ) : (
                          <div className="text-4xl font-extrabold text-emerald-700">
                            {result.rec.snow ?? "—"}
                            <span className="text-lg font-bold ml-1">cm</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 選択地域・備考 */}
                    <div className="text-sm text-gray-600">
                      <p className="font-bold text-gray-800">
                        {[result.rec.ken, result.rec.shi, result.rec.k1, result.rec.k2, result.rec.k3]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      {result.rec.note && <p className="mt-1 text-xs text-gray-500">備考: {result.rec.note}</p>}
                    </div>

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
