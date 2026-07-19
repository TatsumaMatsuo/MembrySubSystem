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
import { Images, Loader2, CheckSquare, Square, RefreshCw, LayoutGrid, FileText, ChevronLeft, ChevronRight, Archive, Upload, GripVertical, Maximize2, ZoomIn, X } from "lucide-react";
import { uploadDocumentFile, prepareImageForUpload, UPLOAD_MAX_BYTES } from "@/lib/document-upload";

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
  tableId?: string; // 画像プロキシ用。未指定なら日報テーブル。アップロード写真は案件書庫テーブルを指定。
}
interface ContractorGroup {
  key: string;
  label: string;
  photos: LedgerPhoto[];
}

// アップロード写真グループのキー(施工業者グループと区別)
const UPLOAD_GROUP_KEY = "__uploads__";

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

// サーバ保存する下書き(製番ごと)。PDF出力/案件書庫保管時に保存し、次回開いた時に復元する。
interface LedgerDraft {
  version?: number;
  savedAt?: string;
  cover?: Partial<Cover>;
  layout?: LayoutId;
  groupByContractor?: boolean;
  includeCover?: boolean;
  manualOrder?: Record<string, string[]>;
  groupOrder?: string[]; // 施工業者グループの出力順
  selected?: string[]; // 対象(チェックON)のトークン。ここに無い写真は未チェック=新規追加分も自動でOFF
  captions?: Record<string, Caption>;
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
  // 手動並び替え(業者キー→トークン順)。未設定は撮影日昇順。
  const [manualOrder, setManualOrder] = useState<Record<string, string[]>>({});
  // 施工業者グループの出力順(グループキーの並び)。未設定は取得順(アップロード写真は末尾)。
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  // ドラッグ&ドロップ状態(写真の並べ替え)
  const [dragTok, setDragTok] = useState<string | null>(null);
  const [dragGroupKey, setDragGroupKey] = useState<string | null>(null);
  const [dragOverTok, setDragOverTok] = useState<string | null>(null);
  // ドラッグ&ドロップ状態(グループの並べ替え)
  const [dragOrderKey, setDragOrderKey] = useState<string | null>(null);
  const [dragOverOrderKey, setDragOverOrderKey] = useState<string | null>(null);
  // 業者ごとの写真を別画面(モーダル)で大きく表示・並べ替え・選択するためのグループキー
  const [expandKey, setExpandKey] = useState<string | null>(null);

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
  const [exporting, setExporting] = useState<null | "pdf" | "store">(null);
  // 下書き(サーバ保存)の復元。undefined=未読込 / null=下書きなし / obj=あり
  const [pendingDraft, setPendingDraft] = useState<LedgerDraft | null | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false); // 選択状態を下書き/初期値で一度だけ確定したか
  // 案件書庫「工事写真アップロード」へローカルから追加した写真(日報とは別グループで台帳へ)
  const [uploadPhotos, setUploadPhotos] = useState<{ file_token: string; name: string }[]>([]);
  const [docTableId, setDocTableId] = useState(""); // 案件書庫テーブルID(アップロード写真の画像プロキシ用)
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setHydrated(false); // 再取得時は選択状態を下書きから再確定する
    try {
      // Larkへの同時アクセスを避けるため順次取得(同時だと断続的に500になることがある)
      const nres = await fetch(`/api/nippou?seiban=${encodeURIComponent(seiban)}`).then((r) => r.json());
      if (nres.success) {
        setReports(nres.reports || []);
        setAnkenList(nres.ankenList || []);
        setTableId(nres.tableId || "");
      } else {
        setError(nres.error || "日報の取得に失敗しました。");
      }
      // 表紙用: 失敗は握りつぶし。500対策で最大2回試行。
      let bres: any = {};
      for (let i = 0; i < 2; i++) {
        try {
          const r = await fetch(`/api/baiyaku-detail?seiban=${encodeURIComponent(seiban)}`);
          bres = await r.json();
          if (bres?.success) break;
        } catch {
          /* retry */
        }
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
      // 下書き(サーバ保存)を取得。あれば表紙/レイアウト/並び順を先に反映(選択はhydrationで確定)。失敗は握りつぶし。
      let draft: LedgerDraft | null = null;
      try {
        const sres = await fetch(`/api/koji-ledger/settings?seiban=${encodeURIComponent(seiban)}`).then((r) => r.json());
        if (sres?.success) draft = sres.data || null;
      } catch {
        /* 下書き無しとして続行 */
      }
      if (draft) {
        if (draft.cover) setCover((c) => ({ ...c, ...draft!.cover }));
        if (draft.layout && LAYOUTS[draft.layout]) setLayout(draft.layout);
        if (typeof draft.groupByContractor === "boolean") setGroupByContractor(draft.groupByContractor);
        if (typeof draft.includeCover === "boolean") setIncludeCover(draft.includeCover);
        if (draft.manualOrder) setManualOrder(draft.manualOrder);
        if (draft.groupOrder) setGroupOrder(draft.groupOrder);
      }
      // 案件書庫「工事写真アップロード」の写真を取得(ローカル追加分)。失敗は握りつぶし。
      try {
        const ures = await fetch(`/api/koji-ledger/uploaded?seiban=${encodeURIComponent(seiban)}`).then((r) => r.json());
        if (ures?.success) {
          setUploadPhotos(ures.photos || []);
          setDocTableId(ures.tableId || "");
        }
      } catch {
        /* アップロード写真なしとして続行 */
      }
      setPendingDraft(draft);
    } catch {
      setError("通信に失敗しました。");
      setPendingDraft(null);
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
    const result = Array.from(map.values()).filter((g) => g.photos.length > 0);
    // アップロード写真を最下段のグループとして追加(ローカル追加分)
    if (uploadPhotos.length) {
      result.push({
        key: UPLOAD_GROUP_KEY,
        label: "アップロード写真",
        photos: uploadPhotos.map((u) => ({
          token: u.file_token,
          name: u.name || "photo",
          company: "",
          reportDate: "",
          content: "",
          reporter: "",
          notes: "",
          uketsukeCode: "",
          tableId: docTableId, // 案件書庫テーブル経由で配信
        })),
      });
    }
    // 手動並び替えを適用(撮影日昇順を基準に上書き)
    for (const g of result) {
      const ord = manualOrder[g.key];
      if (ord && ord.length) {
        const pos = new Map(ord.map((t, i) => [t, i] as const));
        g.photos.sort((a, b) => (pos.get(a.token) ?? 1e9) - (pos.get(b.token) ?? 1e9));
      }
    }
    // 施工業者グループの出力順を適用(未指定のグループは末尾へ、相対順は維持)
    if (groupOrder.length) {
      const pos = new Map(groupOrder.map((k, i) => [k, i] as const));
      result.sort((a, b) => (pos.get(a.key) ?? 1e9) - (pos.get(b.key) ?? 1e9));
    }
    return result;
  }, [reports, ankenList, manualOrder, groupOrder, uploadPhotos, docTableId]);

  const allTokens = useMemo(() => groups.flatMap((g) => g.photos.map((p) => p.token)), [groups]);

  // 情報欄の初期値: 各写真に日報値を補完(既存/下書き値は保持。新規写真もここで日報既定が入る)
  useEffect(() => {
    setCaptions((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        for (const p of g.photos) {
          if (!next[p.token]) next[p.token] = { reportDate: p.reportDate, content: p.content, reporter: p.reporter, notes: p.notes };
        }
      }
      return next;
    });
  }, [groups]);

  // 選択状態を一度だけ確定(hydration)。
  //  - 下書きあり: 保存時に対象だったトークンのみON。以降に追加された写真はここに無い=未チェック。
  //  - 下書きなし: 全選択(従来動作)。
  useEffect(() => {
    if (loading || hydrated || pendingDraft === undefined) return;
    if (pendingDraft && Array.isArray(pendingDraft.selected)) {
      const exists = new Set(allTokens);
      setSelected(new Set(pendingDraft.selected.filter((t) => exists.has(t))));
      if (pendingDraft.captions) setCaptions((prev) => ({ ...prev, ...pendingDraft.captions }));
    } else {
      setSelected(new Set(allTokens));
    }
    setHydrated(true);
  }, [loading, hydrated, pendingDraft, allTokens]);

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

  // 写真を業者グループ内で前(-1)/後(+1)へ移動(ボタン方式)
  const movePhoto = (g: ContractorGroup, token: string, dir: -1 | 1) => {
    const cur = g.photos.map((p) => p.token); // 現在の表示順
    const idx = cur.indexOf(token);
    const ni = idx + dir;
    if (idx < 0 || ni < 0 || ni >= cur.length) return;
    const next = [...cur];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    setManualOrder((prev) => ({ ...prev, [g.key]: next }));
  };

  // ドラッグ&ドロップで並べ替え(同一業者内のみ)。ボタン方式と両立。
  const onDragStartPhoto = (e: React.DragEvent, gkey: string, token: string) => {
    setDragTok(token);
    setDragGroupKey(gkey);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", token);
    } catch {
      /* noop */
    }
  };
  const onDragOverPhoto = (e: React.DragEvent, gkey: string, token: string) => {
    if (dragGroupKey !== gkey) return; // 別業者へはドロップ不可
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTok !== token) setDragOverTok(token);
  };
  const clearDrag = () => {
    setDragOverTok(null);
    setDragTok(null);
    setDragGroupKey(null);
  };
  const onDropPhoto = (e: React.DragEvent, gkey: string, targetToken: string) => {
    e.preventDefault();
    const src = dragTok;
    const sg = dragGroupKey;
    clearDrag();
    if (!src || sg !== gkey || src === targetToken) return;
    const g = groups.find((x) => x.key === gkey);
    if (!g) return;
    const cur = g.photos.map((p) => p.token);
    const from = cur.indexOf(src);
    const to = cur.indexOf(targetToken);
    if (from < 0 || to < 0) return;
    const next = [...cur];
    next.splice(from, 1);
    next.splice(to, 0, src);
    setManualOrder((prev) => ({ ...prev, [gkey]: next }));
  };

  // 施工業者グループの出力順をドラッグ&ドロップで並べ替え(見出しをドラッグ)。写真の並べ替えとは独立。
  const onGroupDragStart = (e: React.DragEvent, key: string) => {
    setDragOrderKey(key);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", `group:${key}`);
    } catch {
      /* noop */
    }
  };
  const onGroupDragOver = (e: React.DragEvent, key: string) => {
    if (!dragOrderKey || dragOrderKey === key) return; // グループDnD中のみ反応
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverOrderKey !== key) setDragOverOrderKey(key);
  };
  const clearGroupDrag = () => {
    setDragOrderKey(null);
    setDragOverOrderKey(null);
  };
  const onGroupDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const src = dragOrderKey;
    clearGroupDrag();
    if (!src || src === targetKey) return;
    const cur = groups.map((g) => g.key); // 現在の表示順を基準に並べ替え
    const from = cur.indexOf(src);
    const to = cur.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    const next = [...cur];
    next.splice(from, 1);
    next.splice(to, 0, src);
    setGroupOrder(next);
  };

  const imgSrc = (p: LedgerPhoto) =>
    `/api/file/proxy?file_token=${encodeURIComponent(p.token)}&table_id=${encodeURIComponent(p.tableId || tableId)}&name=${encodeURIComponent(p.name)}`;

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

  // プレビュー内の全画像の読込完了を待つ(html2canvas前)。壊れ画像/無応答でもハングしないよう保険付き。
  const waitImages = async () => {
    const root = document.getElementById("photo-ledger-preview");
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map((im) =>
        im.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const done = () => resolve();
              im.addEventListener("load", done, { once: true });
              im.addEventListener("error", done, { once: true });
              setTimeout(done, 8000); // 保険: 8秒で強制続行
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

  // 現在の編集状態を下書きとしてサーバ保存(製番ごと)。PDF出力/案件書庫保管時に呼ぶ。非致命(失敗しても本処理は継続)。
  const saveSettings = async () => {
    const settings: LedgerDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      cover,
      layout,
      groupByContractor,
      includeCover,
      manualOrder,
      groupOrder,
      selected: Array.from(selected),
      captions,
    };
    try {
      await fetch("/api/koji-ledger/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seiban, settings }),
      });
    } catch (e) {
      console.error("[photo-ledger] save settings failed", e);
    }
  };

  const handlePdf = async () => {
    if (exporting || selectedCount === 0) return;
    setExporting("pdf");
    try {
      const blob = await generatePdfBlob();
      triggerDownload(blob, `${fileBase()}.pdf`);
      await saveSettings(); // 出力時点の編集内容を保存
    } catch (e: any) {
      console.error("[photo-ledger] pdf error", e);
      window.alert(`PDF生成に失敗しました: ${e?.message || e}\n（写真の枚数を減らす／再読込のうえ再度お試しください）`);
    } finally {
      setExporting(null);
    }
  };

  // ④ 案件書庫保管: 生成PDFを 工務課「工事写真台帳」列へアップロード(資料DL可に)。生バイナリ送信で上限緩和。
  const handleStore = async () => {
    if (exporting || selectedCount === 0) return;
    if (!window.confirm("生成した工事写真台帳(PDF)を案件書庫に保管します。よろしいですか？")) return;
    setExporting("store");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000); // 保険: 120秒でタイムアウト
    try {
      const blob = await generatePdfBlob();
      const sizeMB = blob.size / (1024 * 1024);
      const r = await uploadDocumentFile({
        file: blob,
        fileName: `${fileBase()}.pdf`,
        mimeType: "application/pdf",
        seiban,
        department: "工務課",
        documentType: "工事写真台帳",
        replace: false,
        signal: ctrl.signal,
      });
      const data = r.data;
      if (r.ok) {
        await saveSettings(); // 保管時点の編集内容を保存(Lark同時アクセスを避け、アップロード成功後に実行)
        window.alert("案件書庫に保管しました（資料ダウンロード／関連資料から取得できます）。");
      } else {
        window.alert(`保管に失敗しました (HTTP ${r.status}${sizeMB > 5 ? ` / PDF約${sizeMB.toFixed(1)}MB（上限5MB）` : ""}): ${data.error || "サーバーエラー"}`);
      }
    } catch (e: any) {
      console.error("[photo-ledger] store error", e);
      const msg = e?.name === "AbortError" ? "タイムアウトしました（写真枚数を減らしてお試しください）" : e?.message || e;
      window.alert(`保管に失敗しました: ${msg}`);
    } finally {
      clearTimeout(timer);
      setExporting(null);
    }
  };

  // ローカルからまとめて写真を案件書庫「工事写真アップロード」へ追加(追記式)。完了後に再読込で台帳へ反映。
  // 画像は上限超過時のみ高品質圧縮で救済(共通ヘルパー)。送信は生バイナリ。
  const handleUpload = async (files: FileList) => {
    if (!files.length || uploading) return;
    setUploading(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          if (!file.type.startsWith("image/")) {
            fail++;
            continue;
          }
          const prepared = await prepareImageForUpload(file);
          if (prepared.blob.size > UPLOAD_MAX_BYTES) {
            fail++;
            continue;
          }
          const r = await uploadDocumentFile({
            file: prepared.blob,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            seiban,
            department: "工務課",
            documentType: "工事写真アップロード",
            replace: false, // 追記(既存を保持して追加)
          });
          if (r.ok) ok++;
          else fail++;
        } catch {
          fail++;
        }
      }
      await load(); // アップロード写真グループを再取得して反映
      window.alert(`写真を追加しました：成功 ${ok}件${fail ? ` / 失敗 ${fail}件` : ""}`);
    } finally {
      setUploading(false);
    }
  };

  // ローカル写真アップロード枠(左カラム最下段/写真ゼロ時に表示)
  const uploadPanel = (
    <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> アップロード写真
          </p>
          <p className="text-[11px] text-emerald-700/70 mt-0.5">日報以外の写真をローカルからまとめて追加できます（台帳に反映）。</p>
        </div>
        <label
          className={`flex-none inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
            uploading ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
          }`}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "追加中..." : "写真を追加"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const el = e.currentTarget;
              const f = el.files;
              if (f && f.length) handleUpload(f);
              el.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );

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
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
            この製番の現場作業日報に写真がありません。ローカルから写真を追加して台帳を作成できます。
          </div>
          {uploadPanel}
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4">
          {/* 写真選択 */}
          <div className="xl:w-[38%] space-y-3">
            <p className="text-xs font-semibold text-gray-500">写真を選択（クリックで選択/解除・ホバーで ◀ ▶ 並べ替え）</p>
            <p className="text-[11px] text-gray-400 -mt-1">業者見出し（<span className="inline-flex align-middle"><GripVertical className="w-3 h-3" /></span>）をドラッグすると業者の出力順を変更できます。写真が多い・見えにくいときは「拡大」で別画面を開けます。</p>
            {groups.map((g) => {
              const groupAll = g.photos.every((p) => selected.has(p.token));
              const groupSel = g.photos.filter((p) => selected.has(p.token)).length;
              return (
                <div
                  key={g.key}
                  className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                    dragOverOrderKey === g.key ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-100"
                  } ${dragOrderKey === g.key ? "opacity-50" : ""}`}
                >
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-fuchsia-500 to-pink-500 cursor-move"
                    draggable
                    onDragStart={(e) => onGroupDragStart(e, g.key)}
                    onDragOver={(e) => onGroupDragOver(e, g.key)}
                    onDrop={(e) => onGroupDrop(e, g.key)}
                    onDragEnd={clearGroupDrag}
                    title="ドラッグで業者の出力順を並べ替え"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-white/70 flex-none" />
                      <button onClick={() => toggleGroup(g)} className="flex items-center gap-2 min-w-0 text-white">
                        {groupAll ? <CheckSquare className="w-4 h-4 flex-none" /> : <Square className="w-4 h-4 flex-none" />}
                        <span className="text-sm font-bold truncate">{g.label}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-none">
                      <span className="text-xs text-fuchsia-100">{groupSel}/{g.photos.length}</span>
                      <button
                        type="button"
                        draggable={false}
                        onClick={(e) => { e.stopPropagation(); setExpandKey(g.key); }}
                        onDragStart={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/35"
                        title="別画面で大きく表示して並べ替え・選択"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> 拡大
                      </button>
                    </div>
                  </div>
                  <div className="p-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {g.photos.map((p, i) => {
                      const on = selected.has(p.token);
                      return (
                        <div
                          key={`${p.token}-${i}`}
                          draggable
                          onDragStart={(e) => onDragStartPhoto(e, g.key, p.token)}
                          onDragOver={(e) => onDragOverPhoto(e, g.key, p.token)}
                          onDrop={(e) => onDropPhoto(e, g.key, p.token)}
                          onDragEnd={clearDrag}
                          onClick={() => toggle(p.token)}
                          className={`group relative rounded-md overflow-hidden border-2 cursor-move ${
                            dragOverTok === p.token && dragGroupKey === g.key
                              ? "border-blue-500 ring-2 ring-blue-300"
                              : on
                              ? "border-fuchsia-500"
                              : "border-transparent hover:border-gray-200"
                          } ${dragTok === p.token ? "opacity-50" : ""}`}
                          title={`${p.reportDate} ${p.content}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgSrc(p)} alt={p.name} draggable={false} className="h-20 w-full object-cover bg-gray-100" />
                          <span className={`absolute top-0.5 left-0.5 rounded p-0.5 ${on ? "bg-fuchsia-600 text-white" : "bg-white/80 text-gray-400"}`}>
                            {on ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          </span>
                          <span className="absolute top-0.5 right-0.5 rounded bg-black/45 px-1 text-[9px] text-white">{i + 1}</span>
                          {/* 並べ替え(前へ/後へ) */}
                          <div className="absolute bottom-0 inset-x-0 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); movePhoto(g, p.token, -1); }}
                              disabled={i === 0}
                              className="bg-black/55 text-white p-0.5 hover:bg-black/75 disabled:opacity-25"
                              title="前へ移動"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); movePhoto(g, p.token, 1); }}
                              disabled={i === g.photos.length - 1}
                              className="bg-black/55 text-white p-0.5 hover:bg-black/75 disabled:opacity-25"
                              title="後へ移動"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* ローカル写真アップロード枠(最下段) */}
            {uploadPanel}
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
                <button
                  onClick={handleStore}
                  disabled={!!exporting || selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                >
                  {exporting === "store" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                  案件書庫保管
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
            <p className="mt-2 text-[11px] text-gray-400">情報欄はプレビュー上で直接編集できます。PDF出力・案件書庫保管を押すと、編集内容(表紙/コメント/並び順/選択)が保存されます。</p>
          </div>
        </div>
      )}

      {/* 業者ごとの写真を大きく表示して並べ替え・選択する別画面 */}
      {expandKey && (() => {
        const g = groups.find((x) => x.key === expandKey);
        if (!g) return null;
        return (
          <GroupPhotoModal
            group={g}
            selected={selected}
            captions={captions}
            imgSrc={imgSrc}
            onToggle={toggle}
            onToggleGroup={() => toggleGroup(g)}
            onMove={(token, dir) => movePhoto(g, token, dir)}
            dnd={{
              dragTok,
              dragOverTok,
              dragGroupKey,
              onDragStart: (e, token) => onDragStartPhoto(e, g.key, token),
              onDragOver: (e, token) => onDragOverPhoto(e, g.key, token),
              onDrop: (e, token) => onDropPhoto(e, g.key, token),
              onDragEnd: clearDrag,
            }}
            onClose={() => setExpandKey(null)}
          />
        );
      })()}
    </div>
  );
}

// ---- 業者ごとの写真を大きく表示する別画面(モーダル) ----
// 一覧の小さなサムネイルでは内容が判別しづらい／枚数が多い場合に使う。
// 画面内でそのまま「対象チェックの切替」と「並べ替え」ができ、状態は本体と共有する。
function GroupPhotoModal({
  group,
  selected,
  captions,
  imgSrc,
  onToggle,
  onToggleGroup,
  onMove,
  dnd,
  onClose,
}: {
  group: ContractorGroup;
  selected: Set<string>;
  captions: Record<string, Caption>;
  imgSrc: (p: LedgerPhoto) => string;
  onToggle: (token: string) => void;
  onToggleGroup: () => void;
  onMove: (token: string, dir: -1 | 1) => void;
  dnd: {
    dragTok: string | null;
    dragOverTok: string | null;
    dragGroupKey: string | null;
    onDragStart: (e: React.DragEvent, token: string) => void;
    onDragOver: (e: React.DragEvent, token: string) => void;
    onDrop: (e: React.DragEvent, token: string) => void;
    onDragEnd: () => void;
  };
  onClose: () => void;
}) {
  // サムネイルの大きさ(中/大)。既定は「大」= 1枚あたりを大きく見せる。
  const [size, setSize] = useState<"md" | "lg">("lg");
  // 1枚を画面いっぱいに表示する拡大表示(ライトボックス)のトークン
  const [zoomTok, setZoomTok] = useState<string | null>(null);

  const selCount = group.photos.filter((p) => selected.has(p.token)).length;
  const allOn = group.photos.length > 0 && selCount === group.photos.length;

  // Escで閉じる(拡大表示中はまず拡大表示だけ閉じる)。開いている間は背面のスクロールを止める。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoomTok) setZoomTok(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomTok, onClose]);

  const gridCls = size === "lg" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
  const imgH = size === "lg" ? "h-64" : "h-40";

  const zoomPhoto = zoomTok ? group.photos.find((p) => p.token === zoomTok) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex flex-none flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={onToggleGroup} className="flex min-w-0 items-center gap-2 text-white" title="この業者の写真をまとめて選択/解除">
              {allOn ? <CheckSquare className="w-5 h-5 flex-none" /> : <Square className="w-5 h-5 flex-none" />}
              <span className="truncate text-base font-bold">{group.label}</span>
            </button>
            <span className="flex-none text-xs text-fuchsia-100">選択 {selCount} / {group.photos.length} 枚</span>
          </div>
          <div className="flex flex-none items-center gap-2">
            <div className="inline-flex rounded-lg bg-white/20 p-0.5">
              {(["md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${size === s ? "bg-white text-fuchsia-700 shadow-sm" : "text-white/90 hover:text-white"}`}
                >
                  {s === "md" ? "中" : "大"}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/35">
              <X className="w-4 h-4" /> 閉じる
            </button>
          </div>
        </div>

        <p className="flex-none border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[11px] text-gray-500">
          写真をクリックで選択/解除・ドラッグまたは ◀ ▶ で並べ替え・
          <span className="inline-flex align-middle"><ZoomIn className="w-3 h-3" /></span> で1枚を大きく表示。変更はそのまま台帳プレビューに反映されます。
        </p>

        {/* 写真グリッド */}
        <div className="flex-1 overflow-auto bg-gray-100 p-3">
          <div className={`grid gap-3 ${gridCls}`}>
            {group.photos.map((p, i) => {
              const on = selected.has(p.token);
              const c = captions[p.token];
              return (
                <div
                  key={`${p.token}-${i}`}
                  draggable
                  onDragStart={(e) => dnd.onDragStart(e, p.token)}
                  onDragOver={(e) => dnd.onDragOver(e, p.token)}
                  onDrop={(e) => dnd.onDrop(e, p.token)}
                  onDragEnd={dnd.onDragEnd}
                  onClick={() => onToggle(p.token)}
                  className={`group relative cursor-move overflow-hidden rounded-lg border-2 bg-white shadow-sm ${
                    dnd.dragOverTok === p.token && dnd.dragGroupKey === group.key
                      ? "border-blue-500 ring-2 ring-blue-300"
                      : on
                      ? "border-fuchsia-500"
                      : "border-gray-200 hover:border-gray-300"
                  } ${dnd.dragTok === p.token ? "opacity-50" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc(p)} alt={p.name} draggable={false} className={`${imgH} w-full bg-gray-100 object-contain`} />
                  <span className={`absolute left-1.5 top-1.5 rounded p-1 ${on ? "bg-fuchsia-600 text-white" : "bg-white/90 text-gray-400"}`}>
                    {on ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </span>
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">{i + 1}</span>
                  <button
                    type="button"
                    draggable={false}
                    onClick={(e) => { e.stopPropagation(); setZoomTok(p.token); }}
                    className="absolute right-1.5 top-8 rounded bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
                    title="1枚を大きく表示"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  {/* 並べ替え */}
                  <div className="absolute inset-x-0 bottom-8 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      draggable={false}
                      onClick={(e) => { e.stopPropagation(); onMove(p.token, -1); }}
                      disabled={i === 0}
                      className="bg-black/55 p-1.5 text-white hover:bg-black/75 disabled:opacity-25"
                      title="前へ移動"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      draggable={false}
                      onClick={(e) => { e.stopPropagation(); onMove(p.token, 1); }}
                      disabled={i === group.photos.length - 1}
                      className="bg-black/55 p-1.5 text-white hover:bg-black/75 disabled:opacity-25"
                      title="後へ移動"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  {/* 情報(撮影日・工種内容) */}
                  <div className="border-t border-gray-100 px-2 py-1">
                    <p className="truncate text-[11px] font-medium text-gray-700">{c?.reportDate || p.reportDate || "-"}</p>
                    <p className="truncate text-[11px] text-gray-500" title={c?.content || p.content}>{c?.content || p.content || "-"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1枚を画面いっぱいに表示 */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setZoomTok(null); }}>
          <div className="flex flex-none items-center justify-between gap-2 pb-2 text-white">
            <span className="min-w-0 truncate text-sm">
              {captions[zoomPhoto.token]?.reportDate || zoomPhoto.reportDate}　{captions[zoomPhoto.token]?.content || zoomPhoto.content}
            </span>
            <button onClick={(e) => { e.stopPropagation(); setZoomTok(null); }} className="flex-none inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/35">
              <X className="w-4 h-4" /> 閉じる
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc(zoomPhoto)} alt={zoomPhoto.name} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="flex-none pt-2 text-center">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(zoomPhoto.token); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
                selected.has(zoomPhoto.token) ? "bg-fuchsia-600 text-white hover:bg-fuchsia-700" : "bg-white/20 text-white hover:bg-white/35"
              }`}
            >
              {selected.has(zoomPhoto.token) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selected.has(zoomPhoto.token) ? "台帳に含める（選択中）" : "台帳に含めない（未選択）"}
            </button>
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
