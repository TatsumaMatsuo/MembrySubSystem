"use client";

// 工事写真台帳作成機能(Web版) — 売約詳細「工事写真台帳」タブ (#94)
// 段階実装:
//   ① タブ+写真取込(業者別表示・選択)  ← 本コミット
//   ② 情報欄編集+レイアウト+A4プレビュー+表紙
//   ③ PDF出力(jspdf+html2canvas) / ④ 案件書庫保管 / ⑤ EXCEL出力
//
// 写真は当該製番の現場作業日報(現場写真)を施工業者(受付コード→会社名)ごとに取り込む。
// 画像は /api/file/proxy(同一オリジンでinline配信, 後段のhtml2canvasでもCORS汚染なし)を直接 <img src> に指定。

import { useEffect, useMemo, useState } from "react";
import { Images, Loader2, CheckSquare, Square, RefreshCw } from "lucide-react";

// /api/nippou のレスポンス形(サーバ専用のlib/nippouは import せず自前定義)
interface NippouReportUI {
  record_id: string;
  reporter: string;
  company: string;
  reportDate: string;
  reportDateTs: number;
  workers: number | null;
  content: string;
  notes: string;
  tomorrow: string;
  photos: { file_token?: string; name?: string }[];
  uketsukeCode: string;
}
interface NippouAnkenUI {
  record_id: string;
  contractor: string;
  uketsukeCode: string;
}

// 台帳の1写真アイテム(写真＋情報欄データ。情報欄は②で編集可能にする)
export interface LedgerPhoto {
  token: string;
  name: string;
  company: string; // 施工業者(会社名)
  reportDate: string; // 撮影日=作業報告日
  content: string; // 工種・内容=作業内容
  reporter: string; // 撮影者
  notes: string; // 備考=特記事項
  uketsukeCode: string;
}
interface ContractorGroup {
  key: string;
  label: string; // 施工業者名
  photos: LedgerPhoto[];
}

export function PhotoLedger({ seiban }: { seiban: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<NippouReportUI[]>([]);
  const [ankenList, setAnkenList] = useState<NippouAnkenUI[]>([]);
  const [tableId, setTableId] = useState("");
  // 選択中の写真トークン(既定=全選択)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nippou?seiban=${encodeURIComponent(seiban)}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        setAnkenList(data.ankenList || []);
        setTableId(data.tableId || "");
      } else {
        setError(data.error || "日報の取得に失敗しました。");
      }
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seiban]);

  // 施工業者(受付コード)ごとに写真をグルーピング。業者内は撮影日昇順。
  const groups = useMemo<ContractorGroup[]>(() => {
    const codeToContractor = new Map(ankenList.map((a) => [a.uketsukeCode, a.contractor]));
    const map = new Map<string, ContractorGroup>();
    // 撮影日昇順に処理するため、reportsをtsで整列
    const sorted = [...reports].sort((a, b) => a.reportDateTs - b.reportDateTs || a.reportDate.localeCompare(b.reportDate));
    for (const r of sorted) {
      const code = r.uketsukeCode || "";
      const key = code || r.company || "(業者不明)";
      if (!map.has(key)) {
        map.set(key, { key, label: codeToContractor.get(code) || r.company || "(業者不明)", photos: [] });
      }
      const g = map.get(key)!;
      for (const p of r.photos || []) {
        if (!p.file_token) continue;
        g.photos.push({
          token: p.file_token,
          name: p.name || "photo",
          company: r.company,
          reportDate: r.reportDate,
          content: r.content,
          reporter: r.reporter,
          notes: r.notes,
          uketsukeCode: code,
        });
      }
    }
    // 写真のある業者のみ
    return Array.from(map.values()).filter((g) => g.photos.length > 0);
  }, [reports, ankenList]);

  const allTokens = useMemo(() => groups.flatMap((g) => g.photos.map((p) => p.token)), [groups]);

  // 初回ロード/再取得時に全選択
  useEffect(() => {
    setSelected(new Set(allTokens));
  }, [allTokens]);

  const totalPhotos = allTokens.length;
  const selectedCount = selected.size;

  const toggle = (token: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });

  const toggleGroup = (g: ContractorGroup) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = g.photos.every((p) => next.has(p.token));
      for (const p of g.photos) {
        if (allOn) next.delete(p.token);
        else next.add(p.token);
      }
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === totalPhotos ? new Set() : new Set(allTokens)));

  const imgSrc = (p: LedgerPhoto) =>
    `/api/file/proxy?file_token=${encodeURIComponent(p.token)}&table_id=${encodeURIComponent(tableId)}&name=${encodeURIComponent(p.name)}`;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-none rounded-xl bg-white/20 p-2.5 backdrop-blur">
              <Images className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">工事写真台帳</h2>
              <p className="text-xs text-fuchsia-100">現場作業日報の写真を施工業者ごとに取り込み、台帳を作成します。</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex-none inline-flex items-center gap-1.5 rounded-lg bg-white/15 border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 再取得
          </button>
        </div>
      </div>

      {/* 選択サマリ */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={toggleAll}
          disabled={totalPhotos === 0}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fuchsia-700 disabled:opacity-40"
        >
          {selectedCount === totalPhotos && totalPhotos > 0 ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          全選択
        </button>
        <span className="text-sm text-gray-600">
          選択 <b className="text-gray-800">{selectedCount}</b> / {totalPhotos} 枚
        </span>
        <span className="ml-auto text-xs text-gray-400">※ 台帳のレイアウト・情報欄編集・出力は次段階で追加します</span>
      </div>

      {/* 本体 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-fuchsia-600" />
          <span className="ml-3">読み込み中...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
          この製番の現場作業日報に写真がありません。
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const groupAll = g.photos.every((p) => selected.has(p.token));
            const groupSel = g.photos.filter((p) => selected.has(p.token)).length;
            return (
              <div key={g.key} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-pink-500">
                  <button onClick={() => toggleGroup(g)} className="flex items-center gap-2 min-w-0 text-white">
                    {groupAll ? <CheckSquare className="w-4 h-4 flex-none" /> : <Square className="w-4 h-4 flex-none" />}
                    <span className="text-sm font-bold truncate">{g.label}</span>
                  </button>
                  <span className="text-xs text-fuchsia-100 flex-none">
                    {groupSel}/{g.photos.length} 枚
                  </span>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                  {g.photos.map((p, i) => {
                    const on = selected.has(p.token);
                    return (
                      <button
                        key={`${p.token}-${i}`}
                        onClick={() => toggle(p.token)}
                        className={`group relative rounded-lg overflow-hidden border-2 transition-colors ${
                          on ? "border-fuchsia-500" : "border-transparent hover:border-gray-200"
                        }`}
                        title={`${p.reportDate} ${p.content}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgSrc(p)} alt={p.name} className="h-28 w-full object-cover bg-gray-100" />
                        <span
                          className={`absolute top-1 left-1 rounded-md p-0.5 ${
                            on ? "bg-fuchsia-600 text-white" : "bg-white/80 text-gray-400"
                          }`}
                        >
                          {on ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </span>
                        <span className="absolute bottom-0 inset-x-0 bg-black/45 px-1.5 py-0.5 text-[10px] text-white truncate text-left">
                          {p.reportDate}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
