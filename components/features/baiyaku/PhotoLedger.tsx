"use client";

// 工事写真台帳作成機能(Web版) — 売約詳細「工事写真台帳」タブ (#94)
// 段階実装:
//   ① タブ+写真取込(業者別表示・選択)
//   ② 情報欄編集+レイアウト+A4プレビュー+表紙  ← 本コミット
//   ③ PDF出力(jspdf+html2canvas) / ④ 案件書庫保管 / ⑤ EXCEL出力
//
// 写真は当該製番の現場作業日報(現場写真)を施工業者(受付コード→会社名)ごとに取り込む。
// 画像は /api/file/proxy(同一オリジンでinline配信, 後段のhtml2canvasでもCORS汚染なし)を直接 <img src> に指定。

import { useEffect, useMemo, useState } from "react";
import { Images, Loader2, CheckSquare, Square, RefreshCw, LayoutGrid, FileText } from "lucide-react";

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

export interface LedgerPhoto {
  token: string;
  name: string;
  company: string;
  reportDate: string;
  content: string;
  reporter: string;
  notes: string;
  uketsukeCode: string;
}
interface ContractorGroup {
  key: string;
  label: string;
  photos: LedgerPhoto[];
}

// 台帳レイアウト(要件定義書 F-07)
type LayoutId = "L1" | "L2" | "L3" | "L6";
const LAYOUTS: Record<LayoutId, { label: string; cols: number; rows: number; perPage: number }> = {
  L1: { label: "1枚/頁", cols: 1, rows: 1, perPage: 1 },
  L2: { label: "2枚/頁", cols: 1, rows: 2, perPage: 2 },
  L3: { label: "3枚/頁(標準)", cols: 1, rows: 3, perPage: 3 },
  L6: { label: "6枚/頁", cols: 2, rows: 3, perPage: 6 },
};

// 写真1枚の情報欄(編集可能な上書き値)
interface Caption {
  reportDate: string;
  content: string;
  reporter: string;
  notes: string;
}
interface Cover {
  koujiName: string; // 工事名
  koujiNo: string; // 工事番号(製番)
  place: string; // 施工場所
  client: string; // 発注者
  builder: string; // 施工者
  period: string; // 工期
  createdAt: string; // 作成日
}

// A4(96dpi)ピクセル。プレビューとPDF化(③)で共通利用。
const A4_W = 794;
const A4_H = 1123;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function PhotoLedger({ seiban }: { seiban: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<NippouReportUI[]>([]);
  const [ankenList, setAnkenList] = useState<NippouAnkenUI[]>([]);
  const [tableId, setTableId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ② 追加state
  const [captions, setCaptions] = useState<Record<string, Caption>>({});
  const [cover, setCover] = useState<Cover>({
    koujiName: "",
    koujiNo: seiban,
    place: "",
    client: "",
    builder: "山口産業株式会社",
    period: "",
    createdAt: todayStr(),
  });
  const [layout, setLayout] = useState<LayoutId>("L3");
  const [groupByContractor, setGroupByContractor] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [coverOpen, setCoverOpen] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf">(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nres, bres] = await Promise.all([
        fetch(`/api/nippou?seiban=${encodeURIComponent(seiban)}`).then((r) => r.json()),
        fetch(`/api/baiyaku-detail?seiban=${encodeURIComponent(seiban)}`).then((r) => r.json()).catch(() => ({})),
      ]);
      if (nres.success) {
        setReports(nres.reports || []);
        setAnkenList(nres.ankenList || []);
        setTableId(nres.tableId || "");
      } else {
        setError(nres.error || "日報の取得に失敗しました。");
      }
      // 表紙初期値(売約情報)。工事名=◆工事項目 / 発注者=元請け名(空なら得意先宛名1) / 施工者=施工者(空なら自社)
      if (bres?.success && bres.data) {
        const d = bres.data;
        setCover((c) => ({
          ...c,
          koujiName: d.koji_koumoku || d.juchu_kenmei || c.koujiName,
          koujiNo: d.seiban || seiban,
          place: d.nounyusaki?.address || c.place,
          client: d.motouke_name || d.tokuisaki?.name1 || c.client,
          builder: d.sekousha || "山口産業株式会社",
        }));
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

  const groups = useMemo<ContractorGroup[]>(() => {
    const codeToContractor = new Map(ankenList.map((a) => [a.uketsukeCode, a.contractor]));
    const map = new Map<string, ContractorGroup>();
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
    return Array.from(map.values()).filter((g) => g.photos.length > 0);
  }, [reports, ankenList]);

  const allTokens = useMemo(() => groups.flatMap((g) => g.photos.map((p) => p.token)), [groups]);

  // 初期: 全選択 + 情報欄を日報値で初期化
  useEffect(() => {
    setSelected(new Set(allTokens));
    setCaptions((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        for (const p of g.photos) {
          if (!next[p.token]) next[p.token] = { reportDate: p.reportDate, content: p.content, reporter: p.reporter, notes: p.notes };
        }
      }
      return next;
    });
  }, [allTokens, groups]);

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
  const toggleAll = () => setSelected((prev) => (prev.size === totalPhotos ? new Set() : new Set(allTokens)));

  const setCap = (token: string, patch: Partial<Caption>) =>
    setCaptions((prev) => ({ ...prev, [token]: { ...prev[token], ...patch } }));

  const imgSrc = (p: LedgerPhoto) =>
    `/api/file/proxy?file_token=${encodeURIComponent(p.token)}&table_id=${encodeURIComponent(tableId)}&name=${encodeURIComponent(p.name)}`;

  // ---- プレビュー用ページ構築 ----
  type Page =
    | { kind: "cover" }
    | { kind: "photos"; contractor: string; items: LedgerPhoto[] };

  const pages = useMemo<Page[]>(() => {
    const perPage = LAYOUTS[layout].perPage;
    const result: Page[] = [];
    if (includeCover) result.push({ kind: "cover" });
    const chunk = (arr: LedgerPhoto[], label: string) => {
      for (let i = 0; i < arr.length; i += perPage) {
        result.push({ kind: "photos", contractor: label, items: arr.slice(i, i + perPage) });
      }
    };
    if (groupByContractor) {
      for (const g of groups) {
        const sel = g.photos.filter((p) => selected.has(p.token));
        if (sel.length) chunk(sel, g.label);
      }
    } else {
      const sel = groups.flatMap((g) => g.photos).filter((p) => selected.has(p.token));
      if (sel.length) chunk(sel, "");
    }
    return result;
  }, [groups, selected, layout, includeCover, groupByContractor]);

  const photoPageCount = pages.filter((p) => p.kind === "photos").length;

  const fileBase = () => `${cover.koujiNo || seiban}_工事写真台帳_${(cover.createdAt || todayStr()).replace(/[/\\]/g, "")}`;

  // プレビュー内の全画像の読込完了を待つ(html2canvas前)
  const waitImages = async () => {
    const root = document.getElementById("photo-ledger-preview");
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map((im) =>
        im.complete && im.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              im.addEventListener("load", () => resolve(), { once: true });
              im.addEventListener("error", () => resolve(), { once: true });
            })
      )
    );
  };

  // A4プレビューの各ページをhtml2canvasで画像化しjsPDFへ。Blobを返す。
  const generatePdfBlob = async (): Promise<Blob> => {
    // CJS/ESM interop差を吸収して読み込む
    const h2cMod: any = await import("html2canvas");
    const html2canvas = h2cMod.default || h2cMod;
    const jspdfMod: any = await import("jspdf");
    const JsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
    if (typeof JsPDF !== "function") throw new Error("jsPDFの読み込みに失敗しました");
    await waitImages();
    const pageEls = Array.from(document.querySelectorAll("#photo-ledger-preview [data-page]")) as HTMLElement[];
    if (pageEls.length === 0) throw new Error("出力するページがありません（写真を選択してください）");
    const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, pw, ph);
    }
    return pdf.output("blob");
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePdf = async () => {
    if (exporting || selectedCount === 0) return;
    setExporting("pdf");
    try {
      const blob = await generatePdfBlob();
      triggerDownload(blob, `${fileBase()}.pdf`);
    } catch (e: any) {
      console.error("[photo-ledger] pdf error", e);
      window.alert(`PDF生成に失敗しました: ${e?.message || e}\n（写真の枚数を減らす／再読込のうえ再度お試しください）`);
    } finally {
      setExporting(null);
    }
  };

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

      {/* 設定バー */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button onClick={toggleAll} disabled={totalPhotos === 0} className="inline-flex items-center gap-1.5 text-sm font-medium text-fuchsia-700 disabled:opacity-40">
            {selectedCount === totalPhotos && totalPhotos > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} 全選択
          </button>
          <span className="text-sm text-gray-600">選択 <b className="text-gray-800">{selectedCount}</b> / {totalPhotos} 枚</span>
          {/* レイアウト */}
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-gray-400" />
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => setLayout(id)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${layout === id ? "bg-fuchsia-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                >
                  {LAYOUTS[id].label}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={groupByContractor} onChange={(e) => setGroupByContractor(e.target.checked)} /> 業者ごとに改ページ
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} /> 表紙をつける
          </label>
          <button onClick={() => setCoverOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800">
            <FileText className="w-4 h-4" /> 表紙情報の編集
          </button>
        </div>

        {/* 表紙情報フォーム */}
        {coverOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-gray-100 pt-3">
            {([
              ["koujiName", "工事名"],
              ["koujiNo", "工事番号"],
              ["place", "施工場所"],
              ["client", "発注者"],
              ["builder", "施工者"],
              ["period", "工期"],
              ["createdAt", "作成日"],
            ] as [keyof Cover, string][]).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-xs text-gray-500">{label}</span>
                <input
                  value={cover[k]}
                  onChange={(e) => setCover((c) => ({ ...c, [k]: e.target.value }))}
                  className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-100"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 本体: 左=写真選択 / 右=A4プレビュー */}
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
        <div className="flex flex-col xl:flex-row gap-4">
          {/* 写真選択 */}
          <div className="xl:w-[38%] space-y-3">
            <p className="text-xs font-semibold text-gray-500">写真を選択（クリックで選択/解除）</p>
            {groups.map((g) => {
              const groupAll = g.photos.every((p) => selected.has(p.token));
              const groupSel = g.photos.filter((p) => selected.has(p.token)).length;
              return (
                <div key={g.key} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-fuchsia-500 to-pink-500">
                    <button onClick={() => toggleGroup(g)} className="flex items-center gap-2 min-w-0 text-white">
                      {groupAll ? <CheckSquare className="w-4 h-4 flex-none" /> : <Square className="w-4 h-4 flex-none" />}
                      <span className="text-sm font-bold truncate">{g.label}</span>
                    </button>
                    <span className="text-xs text-fuchsia-100 flex-none">{groupSel}/{g.photos.length}</span>
                  </div>
                  <div className="p-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {g.photos.map((p, i) => {
                      const on = selected.has(p.token);
                      return (
                        <button
                          key={`${p.token}-${i}`}
                          onClick={() => toggle(p.token)}
                          className={`group relative rounded-md overflow-hidden border-2 ${on ? "border-fuchsia-500" : "border-transparent hover:border-gray-200"}`}
                          title={`${p.reportDate} ${p.content}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgSrc(p)} alt={p.name} className="h-20 w-full object-cover bg-gray-100" />
                          <span className={`absolute top-0.5 left-0.5 rounded p-0.5 ${on ? "bg-fuchsia-600 text-white" : "bg-white/80 text-gray-400"}`}>
                            {on ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* A4プレビュー */}
          <div className="xl:flex-1 min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500">
                プレビュー（A4縦・{LAYOUTS[layout].label}／写真ページ {photoPageCount}）
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePdf}
                  disabled={!!exporting || selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-fuchsia-700 disabled:opacity-50"
                >
                  {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  PDF出力
                </button>
              </div>
            </div>
            <div id="photo-ledger-preview" className="overflow-auto rounded-xl border border-gray-200 bg-gray-200 p-3 max-h-[80vh]">
              <div className="mx-auto flex flex-col items-center gap-3" style={{ width: A4_W }}>
                {pages.map((pg, pi) => (
                  <div
                    key={pi}
                    data-page
                    className="bg-white shadow relative flex-none"
                    style={{ width: A4_W, height: A4_H, padding: 28 }}
                  >
                    {pg.kind === "cover" ? (
                      <CoverPage cover={cover} />
                    ) : (
                      <PhotoPage
                        contractor={groupByContractor ? pg.contractor : ""}
                        cover={cover}
                        items={pg.items}
                        layout={layout}
                        pageNo={pi + 1}
                        totalPages={pages.length}
                        captions={captions}
                        setCap={setCap}
                        imgSrc={imgSrc}
                      />
                    )}
                  </div>
                ))}
                {pages.filter((p) => p.kind === "photos").length === 0 && (
                  <div className="bg-white shadow flex items-center justify-center text-sm text-gray-400" style={{ width: A4_W, height: 200 }}>
                    写真を選択するとプレビューが表示されます。
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">情報欄はプレビュー上で直接編集できます。PDF/Excel出力・案件書庫保管は次段階で追加します。</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 表紙 ----
function CoverPage({ cover }: { cover: Cover }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-widest text-gray-500 mb-6">工 事 写 真 帳</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{cover.koujiName || "（工事名）"}</h1>
        <p className="text-base text-gray-600 mb-10">工事番号: {cover.koujiNo || "-"}</p>
        <table className="text-sm text-gray-800">
          <tbody>
            {[
              ["施工場所", cover.place],
              ["発注者", cover.client],
              ["工期", cover.period],
              ["施工者", cover.builder],
              ["作成日", cover.createdAt],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="px-3 py-1.5 text-right font-medium text-gray-500 whitespace-nowrap">{k}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 min-w-[240px] text-left">{v || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- 写真ページ ----
function PhotoPage({
  contractor,
  cover,
  items,
  layout,
  pageNo,
  totalPages,
  captions,
  setCap,
  imgSrc,
}: {
  contractor: string;
  cover: Cover;
  items: LedgerPhoto[];
  layout: LayoutId;
  pageNo: number;
  totalPages: number;
  captions: Record<string, Caption>;
  setCap: (token: string, patch: Partial<Caption>) => void;
  imgSrc: (p: LedgerPhoto) => string;
}) {
  const L = LAYOUTS[layout];
  const compact = layout === "L6";
  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-end justify-between border-b-2 border-gray-800 pb-1 mb-2">
        <span className="text-sm font-bold text-gray-900 truncate">{cover.koujiName || "工事写真台帳"}</span>
        <span className="text-xs text-gray-600 flex-none">工事番号: {cover.koujiNo}{contractor ? `　施工業者: ${contractor}` : ""}</span>
      </div>
      {/* 本文グリッド */}
      <div
        className="flex-1 grid gap-2 min-h-0"
        style={{ gridTemplateColumns: `repeat(${L.cols}, 1fr)`, gridTemplateRows: `repeat(${L.rows}, 1fr)` }}
      >
        {items.map((p) => {
          const c = captions[p.token] || { reportDate: p.reportDate, content: p.content, reporter: p.reporter, notes: p.notes };
          return (
            <div key={p.token} className={`border border-gray-300 rounded overflow-hidden flex ${compact ? "flex-col" : "flex-row"}`}>
              <div className={`${compact ? "h-2/3 w-full" : "w-3/5 h-full"} bg-gray-100 flex items-center justify-center`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(p)} alt={p.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className={`${compact ? "h-1/3 w-full" : "w-2/5 h-full"} p-1.5 text-[11px] text-gray-800 flex flex-col gap-0.5 overflow-hidden`}>
                <InfoRow label="撮影日" value={c.reportDate} onChange={(v) => setCap(p.token, { reportDate: v })} />
                <InfoRow label="工種・内容" value={c.content} onChange={(v) => setCap(p.token, { content: v })} area />
                {!compact && <InfoRow label="撮影者" value={c.reporter} onChange={(v) => setCap(p.token, { reporter: v })} />}
                <InfoRow label="備考" value={c.notes} onChange={(v) => setCap(p.token, { notes: v })} area />
              </div>
            </div>
          );
        })}
      </div>
      {/* フッター */}
      <div className="text-center text-[10px] text-gray-500 pt-1">{pageNo} / {totalPages}</div>
    </div>
  );
}

function InfoRow({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <div className="flex gap-1 min-h-0">
      <span className="flex-none text-gray-500 w-12">{label}</span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="flex-1 resize-none rounded border border-transparent hover:border-gray-200 focus:border-fuchsia-300 focus:outline-none px-0.5 leading-tight"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-transparent hover:border-gray-200 focus:border-fuchsia-300 focus:outline-none px-0.5"
        />
      )}
    </div>
  );
}
