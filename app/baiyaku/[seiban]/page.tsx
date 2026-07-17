"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  Calendar,
  FolderOpen,
  LogOut,
  User,
  Eye,
  Download,
  Image as ImageIcon,
  File,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  RefreshCw,
  Menu,
  X,
  History,
  TrendingUp,
  ClipboardList,
  MapPin,
  HardHat,
  PackageOpen,
  CheckSquare,
  Square,
  MinusSquare,
  UploadCloud,
  Camera,
  QrCode,
  Copy,
  Mail,
} from "lucide-react";
import { generateQRCodeDataUrl } from "@/lib/syaryo/services/qrcode.service";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Sidebar } from "@/components/layout";
import type {
  BaiyakuInfo,
  BaiyakuDetail,
  CustomerRequest,
  QualityIssue,
  ProjectDocument,
  MenuItemType,
  DepartmentName,
  GanttChartData,
  DocumentHistory,
  OperationType,
  CostAnalysisData,
  ConstructionSpec,
} from "@/types";
import { DOCUMENT_CATEGORIES } from "@/lib/lark-tables";
import PdfThumbnail from "@/components/PdfThumbnail";
import { ImageDiff } from "@/components/ImageDiff";
import JSZip from "jszip";

interface PageProps {
  params: { seiban: string };
}

// F2-06 現場作業日報(API /api/nippou のレスポンス形。lib/nippou はサーバ専用のため型は自前定義)
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
  bukken: string;
  location: string;
  salesPerson: string;
  contractorEmail: string;
  chatId: string;
  uketsukeCode: string;
  status: string;
  contractor: string;
}

export default function BaiyakuDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user, status, signOut } = useAuth();
  const seiban = decodeURIComponent(params.seiban);

  const [baiyaku, setBaiyaku] = useState<BaiyakuInfo | null>(null);
  const [baiyakuDetail, setBaiyakuDetail] = useState<BaiyakuDetail | null>(null);
  const [loadingBaiyakuDetail, setLoadingBaiyakuDetail] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuItemType>("baiyaku-detail");
  // F2-06 現場作業日報
  const [nippouReports, setNippouReports] = useState<NippouReportUI[]>([]);
  const [nippouAnkenList, setNippouAnkenList] = useState<NippouAnkenUI[]>([]);
  const [nippouPhotoUrls, setNippouPhotoUrls] = useState<Record<string, string>>({});
  const [nippouTableId, setNippouTableId] = useState<string>("");
  const [loadingNippou, setLoadingNippou] = useState(false);
  const [nippouQr, setNippouQr] = useState<{ dataUrl: string; url: string } | null>(null);
  const [dlOpenKey, setDlOpenKey] = useState<string | null>(null); // 開いているDLメニューの業者キー
  const [dlBusyKey, setDlBusyKey] = useState<string | null>(null); // DL処理中の業者キー
  // F2-07 案件マスタ配布設定(施工業者単位。record_id=編集中の行, 空=新規)
  const [ankenForm, setAnkenForm] = useState<{ recordId: string; contractorEmail: string; contractor: string }>({
    recordId: "",
    contractorEmail: "",
    contractor: "",
  });
  const [savingAnken, setSavingAnken] = useState(false);

  // 案件マスタの業者行一覧を再取得
  const reloadNippouAnken = async () => {
    try {
      const res = await fetch(`/api/nippou?seiban=${encodeURIComponent(seiban)}`);
      const data = await res.json();
      if (data.success) setNippouAnkenList(data.ankenList || []);
    } catch {
      /* noop: 一覧再取得の失敗は握りつぶし(保存自体は成功) */
    }
  };

  // フォームを新規入力状態へ
  const resetAnkenForm = () => setAnkenForm({ recordId: "", contractorEmail: "", contractor: "" });

  // 明細クリック: 内容を入力欄へ転記(訂正・再送信用)
  const editAnkenRow = (a: NippouAnkenUI) =>
    setAnkenForm({ recordId: a.record_id, contractorEmail: a.contractorEmail || "", contractor: a.contractor || "" });

  // 案件別URL(外注配布)を組立
  const buildGenbaUrl = (code: string) =>
    `${window.location.origin}/genba/${encodeURIComponent(seiban)}?code=${encodeURIComponent(code)}`;

  // mailto: 操作者のメールソフトを宛先・本文入りで起動(Lark Botはメール送信不可のためクライアント送信)
  const openContractorMailto = (a: { contractorEmail: string; contractor?: string; uketsukeCode: string; bukken?: string; location?: string }) => {
    if (!a.contractorEmail) {
      window.alert("業者メールアドレスが未登録です。先にメールアドレスを入力・保存してください。");
      return;
    }
    const url = buildGenbaUrl(a.uketsukeCode);
    const bukken = a.bukken || seiban;
    const subject = `【現場作業日報】${bukken} 日報投稿のご案内`;
    const bodyLines = [
      `${a.contractor || "ご担当者"} 様`,
      "",
      "いつもお世話になっております。山口産業株式会社です。",
      "作業日報についてのご報告です。",
      "下記案件の作業日報を、以下の専用ページからご投稿ください。",
      "写真なども添付できます。",
      "",
      url,
      "",
      "以上、よろしくお願いいたします",
    ];
    const href = `mailto:${a.contractorEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = href;
  };

  // 保存＆メール送信(新規=作成/受付コードはサーバ自動生成, 既存=更新。保存後に mailto 起動)
  const saveAndSendAnken = async () => {
    if (savingAnken) return;
    if (!ankenForm.contractor.trim()) {
      window.alert("施工業者を入力してください。");
      return;
    }
    setSavingAnken(true);
    try {
      const res = await fetch("/api/nippou/anken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seiban,
          recordId: ankenForm.recordId || undefined,
          contractorEmail: ankenForm.contractorEmail,
          contractor: ankenForm.contractor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await reloadNippouAnken();
        resetAnkenForm();
        // 保存後、操作者のメールソフトを起動(宛先・本文入り)
        if (data.anken?.contractorEmail) openContractorMailto(data.anken);
        else window.alert("保存しました(メールアドレス未登録のためメールは開きません)。");
      } else {
        window.alert(`保存できませんでした: ${data.error}`);
      }
    } catch {
      window.alert("保存に失敗しました。");
    } finally {
      setSavingAnken(false);
    }
  };

  // 明細行から再送信: mailto を起動(保存済みの内容で)
  const resendNippouMail = (a: NippouAnkenUI) => openContractorMailto(a);

  // F2-08: 案件別URL(外注配布用)のQRを生成して表示。URLは製番+受付コードから都度生成。
  const showNippouQr = async (code: string) => {
    if (!code) return;
    const url = `${window.location.origin}/genba/${encodeURIComponent(seiban)}?code=${encodeURIComponent(code)}`;
    try {
      const dataUrl = await generateQRCodeDataUrl(url, { width: 240 });
      setNippouQr({ dataUrl, url });
    } catch (e) {
      console.error("QR生成に失敗:", e);
    }
  };

  // 日報を施工業者(受付コード)ごとにグループ化。各グループ内は作業報告日の昇順。
  const nippouGroups = useMemo(() => {
    const codeToContractor = new Map(nippouAnkenList.map((a) => [a.uketsukeCode, a.contractor]));
    const map = new Map<string, { key: string; label: string; code: string; reports: NippouReportUI[] }>();
    for (const r of nippouReports) {
      const code = r.uketsukeCode || "";
      const key = code || r.company || "(業者不明)";
      if (!map.has(key)) {
        map.set(key, { key, label: codeToContractor.get(code) || r.company || "(業者不明)", code, reports: [] });
      }
      map.get(key)!.reports.push(r);
    }
    const groups = Array.from(map.values());
    for (const g of groups) g.reports.sort((a, b) => a.reportDateTs - b.reportDateTs || a.reportDate.localeCompare(b.reportDate));
    return groups;
  }, [nippouReports, nippouAnkenList]);

  // ⑤ 施工業者別ダウンロード: 日報CSV / 写真ZIP / 両方(ZIP)
  const buildReportsCsv = (reports: NippouReportUI[]): string => {
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const header = ["作業報告日", "報告者", "作業人数", "作業内容", "特記事項・連絡事項", "翌日の作業予定"];
    const rows = reports.map((r) =>
      [r.reportDate, r.reporter, r.workers ?? "", r.content, r.notes, r.tomorrow].map(esc).join(",")
    );
    return "﻿" + [header.map(esc).join(","), ...rows].join("\r\n"); // BOMでExcel文字化け防止
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
  const sanitizeName = (s: string) => (s || "業者").replace(/[\\/:*?"<>|]/g, "_").trim();
  const downloadContractor = async (
    g: { key: string; label: string; reports: NippouReportUI[] },
    kind: "csv" | "photos" | "both"
  ) => {
    setDlOpenKey(null);
    if (dlBusyKey) return;
    setDlBusyKey(g.key);
    try {
      const label = sanitizeName(g.label);
      if (kind === "csv") {
        triggerDownload(new Blob([buildReportsCsv(g.reports)], { type: "text/csv;charset=utf-8" }), `日報_${label}.csv`);
        return;
      }
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      if (kind === "both") zip.file(`日報_${label}.csv`, buildReportsCsv(g.reports));
      let missing = 0;
      let photoCount = 0;
      for (const r of g.reports) {
        const dateLabel = (r.reportDate || "日付なし").replace(/\//g, "-");
        let n = 0;
        for (const p of r.photos || []) {
          if (!p.file_token) continue;
          n++;
          const ext = p.name && p.name.includes(".") ? p.name.split(".").pop() : "jpg";
          try {
            const res = await fetch(
              `/api/file/proxy?file_token=${encodeURIComponent(p.file_token)}&table_id=${encodeURIComponent(nippouTableId)}&disposition=attachment&name=${encodeURIComponent(p.name || "photo")}`
            );
            if (!res.ok) {
              missing++;
              continue;
            }
            zip.file(`photos/${dateLabel}_${n}.${ext}`, await res.blob());
            photoCount++;
          } catch {
            missing++;
          }
        }
      }
      if (kind === "photos" && photoCount === 0) {
        window.alert("この業者の写真がありません。");
        return;
      }
      const out = await zip.generateAsync({ type: "blob" });
      triggerDownload(out, `日報_${label}.zip`);
      if (missing > 0) window.alert(`${missing}枚の写真を取得できませんでした（他は保存済み）。`);
    } catch (e) {
      console.error("[nippou] download error:", e);
      window.alert("ダウンロードに失敗しました。");
    } finally {
      setDlBusyKey(null);
    }
  };

  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [documents, setDocuments] = useState<Record<DepartmentName, Record<string, ProjectDocument | null>> | null>(null);
  const [ganttData, setGanttData] = useState<GanttChartData | null>(null);
  const [scheduleData, setScheduleData] = useState<{ recordId: string; dates: Record<string, { start: number | null; end: number | null }>; deptFields: Record<string, string | null> } | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [editingScheduleCell, setEditingScheduleCell] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null);
  const [collapsedDeptSections, setCollapsedDeptSections] = useState<Set<string>>(new Set());
  const [scheduleCollapsed, setScheduleCollapsed] = useState(false);
  const [costAnalysisData, setCostAnalysisData] = useState<CostAnalysisData | null>(null);
  const [loadingCostAnalysis, setLoadingCostAnalysis] = useState(false);
  const [constructionSpec, setConstructionSpec] = useState<ConstructionSpec | null>(null);
  const [loadingConstructionSpec, setLoadingConstructionSpec] = useState(false);
  const [collapsedConstructionSections, setCollapsedConstructionSections] = useState<Set<string>>(new Set());
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAiAnalysis, setLoadingAiAnalysis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [collapsedDepts, setCollapsedDepts] = useState<Set<DepartmentName>>(new Set());
  const [uploadTarget, setUploadTarget] = useState<{ dept: DepartmentName; docType: string; replace: boolean; targetFileToken?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false); // アップロードモーダルのドラッグ中フラグ
  const [deleting, setDeleting] = useState<string | null>(null); // 削除中のファイルトークン
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ docType: string } | null>(null); // 履歴表示対象
  const [documentHistory, setDocumentHistory] = useState<DocumentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null); // 選択中の履歴
  const [historyImageUrls, setHistoryImageUrls] = useState<Record<string, string>>({}); // 履歴画像のURL
  const [historyFullscreen, setHistoryFullscreen] = useState(false); // フルスクリーンモード
  const [historyZoom, setHistoryZoom] = useState(100); // ズームレベル（%）
  const [showDiff, setShowDiff] = useState(false); // 差分表示モード
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set()); // 一括DL用: "dept/docType/fileToken"
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [bulkDownloadCollapsedDepts, setBulkDownloadCollapsedDepts] = useState<Set<DepartmentName>>(new Set());
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ success: boolean; message: string } | null>(null);
  const [ocrConfirm, setOcrConfirm] = useState<{
    dates: Record<string, { start: string | null; end: string | null; startField: string | null; endField: string | null }>;
  } | null>(null);
  const [ocrSaving, setOcrSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESCキーでメニューを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 部門の折りたたみ状態を切り替え
  const toggleDeptCollapse = (dept: DepartmentName) => {
    setCollapsedDepts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dept)) {
        newSet.delete(dept);
      } else {
        newSet.add(dept);
      }
      return newSet;
    });
  };

  // 工事仕様書セクションの折りたたみ状態を切り替え
  const toggleConstructionSection = (section: string) => {
    setCollapsedConstructionSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // 更新履歴を記録
  const recordHistory = async (
    docType: string,
    operationType: OperationType,
    fileName: string,
    beforeFileToken?: string,
    afterFileToken?: string
  ) => {
    try {
      await fetch("/api/documents/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seiban,
          documentType: docType,
          operationType,
          fileName,
          operator: user?.name || user?.email || "不明",
          beforeFileToken,
          afterFileToken,
        }),
      });
    } catch (error) {
      console.error("Failed to record history:", error);
    }
  };

  // 更新履歴を取得
  const fetchHistory = async (docType: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/documents/history?seiban=${encodeURIComponent(seiban)}&documentType=${encodeURIComponent(docType)}`
      );
      const data = await response.json();
      if (data.success) {
        setDocumentHistory(data.data);
        // 画像URLを取得
        const imageTokens: string[] = [];
        for (const history of data.data as DocumentHistory[]) {
          if (history.before_image?.[0]?.file_token) {
            imageTokens.push(history.before_image[0].file_token);
          }
          if (history.after_image?.[0]?.file_token) {
            imageTokens.push(history.after_image[0].file_token);
          }
        }
        // ファイルURLを並列取得（履歴テーブル用にsource=historyを指定）
        if (imageTokens.length > 0) {
          const urlResults = await Promise.allSettled(
            imageTokens.map(async (token) => {
              const res = await fetch(`/api/file?file_token=${encodeURIComponent(token)}&source=history`);
              const urlData = await res.json();
              return urlData.success ? { token, url: urlData.data.url } : null;
            })
          );
          const newUrls: Record<string, string> = {};
          for (const result of urlResults) {
            if (result.status === "fulfilled" && result.value) {
              newUrls[result.value.token] = result.value.url;
            }
          }
          setHistoryImageUrls((prev) => ({ ...prev, ...newUrls }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 更新履歴モーダルを開く
  const handleOpenHistory = (docType: string) => {
    setHistoryTarget({ docType });
    setSelectedHistoryId(null);
    setHistoryFullscreen(false);
    setHistoryZoom(100);
    setShowDiff(false);
    fetchHistory(docType);
  };

  // ファイルアップロードモーダル（ドラッグ&ドロップ対応）を開く
  const handleOpenUpload = (dept: DepartmentName, docType: string, replace: boolean = false, targetFileToken?: string) => {
    setUploadTarget({ dept, docType, replace, targetFileToken });
    setDragOver(false);
  };

  // モーダルを閉じる（アップロード中は閉じない）
  const handleCloseUpload = () => {
    if (uploading) return;
    setUploadTarget(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ドロップされたファイルをアップロード
  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadSelectedFile(file);
  };

  // ファイル削除処理
  const handleDeleteFile = async (docType: string, fileToken: string, fileName: string) => {
    if (!confirm(`「${fileName}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    setDeleting(fileToken);

    try {
      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seiban,
          documentType: docType,
          fileToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 履歴を記録
        await recordHistory(docType, "削除", fileName);

        // 営業部/工程表の場合は工程管理テーブルの日付をクリア
        if (docType === "工程表") {
          try {
            const clearRes = await fetch("/api/ocr/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "clear", seiban }),
            });
            const clearData = await clearRes.json();
            if (!clearData.success) {
              console.error("Clear failed:", clearData.error);
            }
          } catch (e) {
            console.error("Failed to clear schedule dates:", e);
          }
        }

        alert(`「${fileName}」を削除しました`);
        // ドキュメント一覧を再取得
        const docsResponse = await fetch(`/api/documents?seiban=${encodeURIComponent(seiban)}`);
        const docsData = await docsResponse.json();
        if (docsData.success) {
          setDocuments(docsData.data);
          // サムネイルURLをリセットして再取得
          fetchedTokensRef.current.clear();
          setThumbnailUrls({});
        }
      } else {
        alert(`削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("削除中にエラーが発生しました");
    } finally {
      setDeleting(null);
    }
  };

  // ファイルサイズ上限: 4MB（Base64エンコード後に約5.3MBになるため、AWS Amplify 6MB制限内に収める）
  const MAX_FILE_SIZE = 4 * 1024 * 1024;

  // ファイルをBase64に変換するヘルパー関数
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/png;base64,xxxxx 形式から base64 部分のみ取り出す
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ファイル選択（<input>）時の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadSelectedFile(file);
  };

  // 選択/ドロップされたファイルをアップロード（共通処理）
  const uploadSelectedFile = async (file: File) => {
    if (!uploadTarget) return;

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      alert(`ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています。\n小さいファイルを選択してください。`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setUploading(true);

    try {
      // ファイルをBase64に変換（FileReader使用でより信頼性の高い変換）
      const base64 = await fileToBase64(file);

      console.log("[upload] Sending upload request:", {
        fileName: file.name,
        fileSize: file.size,
        base64Length: base64.length,
        documentType: uploadTarget.docType,
      });

      // JSON形式でアップロード（AWS Amplifyの制限を回避）
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
          seiban: seiban,
          department: uploadTarget.dept,
          documentType: uploadTarget.docType,
          replace: uploadTarget.replace,
          targetFileToken: uploadTarget.targetFileToken,
        }),
      });

      console.log("[upload] Response status:", response.status);

      // レスポンスがJSONかどうかを確認
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 500));
        alert(`アップロードに失敗しました: サーバーエラー (${response.status})`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        // 履歴を記録（差替えの場合は変更前のトークン、新規アップロードしたトークンを渡す）
        const operationType: OperationType = uploadTarget.replace ? "差替" : "追加";
        const beforeToken = uploadTarget.replace ? uploadTarget.targetFileToken : undefined;
        const afterToken = data.data?.fileToken;
        await recordHistory(uploadTarget.docType, operationType, file.name, beforeToken, afterToken);

        // 営業部/工程表の場合はOCR処理を実行（クライアント側でPDF→画像変換）
        if (uploadTarget.dept === "営業部" && uploadTarget.docType === "工程表" && file.type === "application/pdf") {
          alert(`「${file.name}」をアップロードしました。\n工程表のOCR読み取りを開始します...`);
          setOcrProcessing(true);
          setOcrResult(null);
          setOcrConfirm(null);
          try {
            // ブラウザのCanvas APIでPDF→高解像度画像→クロップ
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
            const arrayBuf = await file.arrayBuffer();
            const pdfDoc = await pdfjs.getDocument({ data: arrayBuf }).promise;
            const pdfPage = await pdfDoc.getPage(1);
            const scale = 5;
            const vp = pdfPage.getViewport({ scale });
            const fullCanvas = document.createElement("canvas");
            fullCanvas.width = vp.width;
            fullCanvas.height = vp.height;
            await pdfPage.render({ canvasContext: fullCanvas.getContext("2d")!, viewport: vp }).promise;

            // 日付列のみクロップ
            const cropW = Math.round(vp.width * 0.32);
            const cropY = Math.round(vp.height * 0.28);
            const cropH = vp.height - cropY - Math.round(vp.height * 0.12);
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            cropCanvas.getContext("2d")!.drawImage(fullCanvas, 0, cropY, cropW, cropH, 0, 0, cropW, cropH);

            const imageBase64 = cropCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");

            const ocrResponse = await fetch("/api/ocr/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ seiban, imageBase64 }),
            });
            if (!ocrResponse.ok) {
              const errText = await ocrResponse.text().catch(() => "");
              throw new Error(`サーバーエラー (${ocrResponse.status}): ${errText.substring(0, 200)}`);
            }
            const ocrData = await ocrResponse.json();
            if (ocrData.success) {
              setOcrConfirm({ dates: ocrData.data.extractedDates });
            } else {
              setOcrResult({ success: false, message: `OCR読み取りに失敗しました: ${ocrData.error}` });
            }
          } catch (ocrError) {
            console.error("OCR error:", ocrError);
            setOcrResult({ success: false, message: ocrError instanceof Error ? ocrError.message : "OCR処理中にエラーが発生しました" });
          } finally {
            setOcrProcessing(false);
          }
        } else {
          alert(`「${file.name}」をアップロードしました`);
        }

        // ドキュメント一覧を再取得
        const docsResponse = await fetch(`/api/documents?seiban=${encodeURIComponent(seiban)}`);
        const docsData = await docsResponse.json();
        if (docsData.success) {
          setDocuments(docsData.data);
          // サムネイルURLをリセットして再取得
          fetchedTokensRef.current.clear();
          setThumbnailUrls({});
        }
      } else {
        alert(`アップロードに失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error instanceof Error ? error.message : "不明なエラー";
      alert(`アップロード中にエラーが発生しました: ${errorMsg}`);
    } finally {
      setUploading(false);
      setUploadTarget(null);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ファイルを表示する関数（APIを経由して認証付きURLを取得）
  const handleViewFile = async (fileToken: string | undefined, fileName: string) => {
    if (!fileToken) {
      alert("ファイルトークンが見つかりません");
      return;
    }

    const isPdf = /\.pdf$/i.test(fileName);

    if (isPdf) {
      // PDFはビューアページで別タブ表示（ダウンロードボタン付き）
      const params = new URLSearchParams({
        file_token: fileToken,
        name: fileName,
      });
      window.open(`/pdf-viewer?${params.toString()}`, '_blank');
      return;
    }

    setLoadingFile(fileToken);

    try {
      // APIを呼び出して認証付き一時URLを取得
      const response = await fetch(`/api/file?file_token=${encodeURIComponent(fileToken)}`);
      const data = await response.json();

      if (!data.success || !data.data?.url) {
        alert("ファイルURLの取得に失敗しました: " + (data.error || "不明なエラー"));
        return;
      }

      const fileUrl = data.data.url;
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);

      if (isImage) {
        // 画像はモーダルで表示
        setViewingFile({ url: fileUrl, name: fileName, type: 'image' });
      } else {
        // その他のファイルは新しいタブで開く
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error("Error fetching file URL:", error);
      alert("ファイルの取得中にエラーが発生しました");
    } finally {
      setLoadingFile(null);
    }
  };

  useEffect(() => {
    const fetchBaiyaku = async () => {
      try {
        const response = await fetch(`/api/baiyaku?seiban=${encodeURIComponent(seiban)}`);
        const data = await response.json();
        if (data.success && data.data.length > 0) {
          setBaiyaku(data.data[0]);
        }
      } catch (error) {
        console.error("Error fetching baiyaku:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBaiyaku();
  }, [seiban]);

  useEffect(() => {
    const fetchData = async () => {
      if (!seiban) return;

      try {
        if (activeMenu === "customer-requests") {
          const response = await fetch(`/api/customer-requests?seiban=${encodeURIComponent(seiban)}`);
          const data = await response.json();
          if (data.success) {
            setCustomerRequests(data.data);
          }
        } else if (activeMenu === "quality-issues") {
          const response = await fetch(`/api/quality-issues?seiban=${encodeURIComponent(seiban)}`);
          const data = await response.json();
          if (data.success) {
            setQualityIssues(data.data);
          }
        } else if (activeMenu === "documents" || activeMenu === "bulk-download") {
          if (!documents) {
            const response = await fetch(`/api/documents?seiban=${encodeURIComponent(seiban)}`);
            const data = await response.json();
            console.log("[documents] API response:", data.success, "data keys:", data.data ? Object.keys(data.data) : "null");
            if (data.success) {
              setDocuments(data.data);
            }
          }
        } else if (activeMenu === "gantt-chart") {
          const response = await fetch(`/api/gantt?seiban=${encodeURIComponent(seiban)}`);
          const data = await response.json();
          if (data.success) {
            setGanttData(data.data);
          }
          if (!scheduleData) {
            setLoadingSchedule(true);
            try {
              const schedRes = await fetch(`/api/schedule?seiban=${encodeURIComponent(seiban)}`);
              const schedJson = await schedRes.json();
              if (schedJson.success && schedJson.data) {
                setScheduleData(schedJson.data);
              }
            } catch (e) {
              console.error("Failed to load schedule:", e);
            } finally {
              setLoadingSchedule(false);
            }
          }
        } else if (activeMenu === "nippou") {
          setLoadingNippou(true);
          try {
            const response = await fetch(`/api/nippou?seiban=${encodeURIComponent(seiban)}`);
            const data = await response.json();
            if (data.success) {
              const reports: NippouReportUI[] = data.reports || [];
              setNippouReports(reports);
              setNippouAnkenList(data.ankenList || []);
              setNippouTableId(data.tableId || "");
              setAnkenForm({ recordId: "", contractorEmail: "", contractor: "" });
              // 現場写真の一時URLを取得(添付元テーブルIDを付与)
              const tokens: string[] = [];
              for (const r of reports) {
                for (const p of r.photos || []) if (p.file_token) tokens.push(p.file_token);
              }
              if (tokens.length > 0 && data.tableId) {
                const results = await Promise.allSettled(
                  tokens.map(async (t) => {
                    const res = await fetch(
                      `/api/file?file_token=${encodeURIComponent(t)}&table_id=${encodeURIComponent(data.tableId)}`
                    );
                    const u = await res.json();
                    return u.success ? { t, url: u.data.url as string } : null;
                  })
                );
                const urls: Record<string, string> = {};
                for (const r of results) if (r.status === "fulfilled" && r.value) urls[r.value.t] = r.value.url;
                setNippouPhotoUrls((prev) => ({ ...prev, ...urls }));
              }
            }
          } finally {
            setLoadingNippou(false);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [seiban, activeMenu]);

  // 取得済みのfile_tokenを追跡（refを使用して無限ループを防ぐ）
  const fetchedTokensRef = useRef<Set<string>>(new Set());

  // 書類のサムネイルURLを事前取得
  useEffect(() => {
    const fetchThumbnailUrls = async () => {
      if (!documents) {
        console.log("[thumbnails] No documents yet");
        return;
      }

      console.log("[thumbnails] Processing documents, departments:", Object.keys(documents));

      // 全ての添付ファイルのfile_tokenを収集（まだ取得していないもののみ）
      const fileTokens: string[] = [];
      for (const dept of Object.keys(documents) as DepartmentName[]) {
        const deptDocs = documents[dept];
        if (!deptDocs) {
          console.log("[thumbnails] No deptDocs for:", dept);
          continue;
        }
        console.log("[thumbnails] Dept:", dept, "docTypes:", Object.keys(deptDocs));
        for (const docType of Object.keys(deptDocs)) {
          const doc = deptDocs[docType];
          if (doc?.file_attachment && doc.file_attachment.length > 0) {
            console.log("[thumbnails] Found attachment in:", dept, docType, "files:", doc.file_attachment.length);
            for (const file of doc.file_attachment) {
              console.log("[thumbnails] File:", file.name, "token:", file.file_token);
              if (file.file_token && !fetchedTokensRef.current.has(file.file_token)) {
                fileTokens.push(file.file_token);
              }
            }
          }
        }
      }

      console.log("[thumbnails] File tokens to fetch:", fileTokens.length, fileTokens);

      if (fileTokens.length === 0) return;

      setLoadingThumbnails(true);

      // 並列でURLを取得（最大5件ずつ）
      const batchSize = 5;
      const newUrls: Record<string, string> = {};

      for (let i = 0; i < fileTokens.length; i += batchSize) {
        const batch = fileTokens.slice(i, i + batchSize);
        console.log("[thumbnails] Fetching batch:", batch);

        const results = await Promise.allSettled(
          batch.map(async (fileToken) => {
            try {
              const response = await fetch(`/api/file?file_token=${encodeURIComponent(fileToken)}`);
              const data = await response.json();
              console.log("[thumbnails] Response for", fileToken, ":", data.success);
              if (data.success && data.data?.url) {
                return { fileToken, url: data.data.url };
              }
              return null;
            } catch (err) {
              console.error("[thumbnails] Error fetching", fileToken, err);
              return null;
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            newUrls[result.value.fileToken] = result.value.url;
            fetchedTokensRef.current.add(result.value.fileToken);
          }
        }
      }

      console.log("[thumbnails] Got URLs:", Object.keys(newUrls).length);
      setThumbnailUrls((prev) => ({ ...prev, ...newUrls }));
      setLoadingThumbnails(false);
    };

    if (activeMenu === "documents" && documents) {
      console.log("[thumbnails] Triggering fetch, activeMenu:", activeMenu);
      fetchThumbnailUrls();
    }
  }, [documents, activeMenu]);

  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return "-";
    if (typeof timestamp === "string") {
      // 日付文字列の場合はそのまま返すか、Dateに変換
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? timestamp : date.toLocaleDateString("ja-JP");
    }
    return new Date(timestamp).toLocaleDateString("ja-JP");
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  // === 一括ダウンロード用ヘルパー ===

  // 選択可能なファイル情報を取得
  const getSelectableFiles = () => {
    if (!documents) return [];
    const files: { key: string; dept: DepartmentName; docType: string; fileToken: string; fileName: string; fileSize: number }[] = [];
    for (const dept of Object.keys(DOCUMENT_CATEGORIES) as DepartmentName[]) {
      const deptDocs = documents[dept];
      if (!deptDocs) continue;
      for (const docType of DOCUMENT_CATEGORIES[dept]) {
        const doc = deptDocs[docType];
        if (doc?.file_attachment && doc.file_attachment.length > 0) {
          for (const file of doc.file_attachment) {
            const key = `${dept}/${docType}/${file.file_token}`;
            files.push({ key, dept, docType, fileToken: file.file_token, fileName: file.name, fileSize: file.size });
          }
        }
      }
    }
    return files;
  };

  const selectableFiles = documents ? getSelectableFiles() : [];

  const toggleFileSelection = (key: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleDeptSelection = (dept: DepartmentName) => {
    const deptFiles = selectableFiles.filter(f => f.dept === dept);
    const allSelected = deptFiles.every(f => selectedFiles.has(f.key));
    setSelectedFiles(prev => {
      const next = new Set(prev);
      for (const f of deptFiles) {
        if (allSelected) {
          next.delete(f.key);
        } else {
          next.add(f.key);
        }
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    const allSelected = selectableFiles.every(f => selectedFiles.has(f.key));
    if (allSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectableFiles.map(f => f.key)));
    }
  };

  const toggleBulkDownloadDeptCollapse = (dept: DepartmentName) => {
    setBulkDownloadCollapsedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0 || downloadingZip) return;

    setDownloadingZip(true);
    setDownloadProgress({ current: 0, total: selectedFiles.size });

    try {
      const zip = new JSZip();
      let current = 0;

      const filesToDownload = selectableFiles.filter(f => selectedFiles.has(f.key));

      for (const file of filesToDownload) {
        current++;
        setDownloadProgress({ current, total: filesToDownload.length });

        try {
          const res = await fetch(`/api/file/proxy?file_token=${encodeURIComponent(file.fileToken)}`);
          if (!res.ok) {
            console.error(`Failed to download ${file.fileName}: ${res.status}`);
            continue;
          }
          const arrayBuffer = await res.arrayBuffer();
          const folderPath = `${file.dept}/${file.docType}_${file.fileName}`;
          zip.file(folderPath, arrayBuffer);
        } catch (err) {
          console.error(`Error downloading ${file.fileName}:`, err);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const fileName = `${seiban}_完成図書_${dateStr}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating ZIP:", error);
      alert("ZIPファイルの作成中にエラーが発生しました。");
    } finally {
      setDownloadingZip(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const menuItems: { id: MenuItemType; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
    { id: "baiyaku-detail", label: "売約詳細情報", icon: <ClipboardList className="w-5 h-5" />, color: "text-indigo-500", activeColor: "text-indigo-600" },
    { id: "construction-detail", label: "工事詳細情報", icon: <HardHat className="w-5 h-5" />, color: "text-amber-500", activeColor: "text-amber-600" },
    { id: "customer-requests", label: "顧客要求事項変更履歴", icon: <FileText className="w-5 h-5" />, color: "text-blue-500", activeColor: "text-blue-600" },
    { id: "quality-issues", label: "不具合情報", icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-500", activeColor: "text-orange-600" },
    { id: "nippou", label: "作業日報", icon: <Camera className="w-5 h-5" />, color: "text-rose-500", activeColor: "text-rose-600" },
    { id: "gantt-chart", label: "ガントチャート", icon: <Calendar className="w-5 h-5" />, color: "text-emerald-500", activeColor: "text-emerald-600" },
    { id: "cost-analysis", label: "原価分析", icon: <TrendingUp className="w-5 h-5" />, color: "text-cyan-500", activeColor: "text-cyan-600" },
    { id: "documents", label: "関連資料", icon: <FolderOpen className="w-5 h-5" />, color: "text-purple-500", activeColor: "text-purple-600" },
    { id: "bulk-download", label: "資料ダウンロード", icon: <PackageOpen className="w-5 h-5" />, color: "text-teal-500", activeColor: "text-teal-600" },
  ];

  // 売約詳細データ取得
  const fetchBaiyakuDetail = async () => {
    if (baiyakuDetail) return;
    setLoadingBaiyakuDetail(true);
    try {
      const response = await fetch(`/api/baiyaku-detail?seiban=${encodeURIComponent(seiban)}`);
      const data = await response.json();
      if (data.success) {
        setBaiyakuDetail(data.data);
      }
    } catch (error) {
      console.error("Error fetching baiyaku detail:", error);
    } finally {
      setLoadingBaiyakuDetail(false);
    }
  };

  // 原価分析データ取得
  const fetchCostAnalysis = async () => {
    if (costAnalysisData) return;
    setLoadingCostAnalysis(true);
    try {
      const response = await fetch(`/api/cost-analysis?seiban=${encodeURIComponent(seiban)}`);
      const data = await response.json();
      if (data.success) {
        setCostAnalysisData(data.data);
      }
    } catch (error) {
      console.error("Error fetching cost analysis:", error);
    } finally {
      setLoadingCostAnalysis(false);
    }
  };

  // 工事仕様書データ取得
  const fetchConstructionSpec = async () => {
    if (constructionSpec) return;
    setLoadingConstructionSpec(true);
    try {
      const response = await fetch(`/api/construction-spec?seiban=${encodeURIComponent(seiban)}`);
      const data = await response.json();
      if (data.success) {
        setConstructionSpec(data.data);
      }
    } catch (error) {
      console.error("Error fetching construction spec:", error);
    } finally {
      setLoadingConstructionSpec(false);
    }
  };

  // メニュー切替時にデータを取得
  useEffect(() => {
    if (activeMenu === "baiyaku-detail" && !baiyakuDetail && !loadingBaiyakuDetail) {
      fetchBaiyakuDetail();
    }
    if (activeMenu === "cost-analysis" && !costAnalysisData && !loadingCostAnalysis) {
      fetchCostAnalysis();
    }
    if (activeMenu === "construction-detail" && !constructionSpec && !loadingConstructionSpec) {
      fetchConstructionSpec();
    }
  }, [activeMenu]);

  // AI分析を生成
  const fetchAiAnalysis = async () => {
    if (loadingAiAnalysis) return;
    setLoadingAiAnalysis(true);
    setAiAnalysis(null);
    try {
      const response = await fetch(`/api/ai-cost-analysis?seiban=${encodeURIComponent(seiban)}`);
      const data = await response.json();
      if (data.success) {
        setAiAnalysis(data.data.analysis);
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        setAiAnalysis("AI分析の生成に失敗しました: " + (errorMsg || "不明なエラー"));
      }
    } catch (error) {
      console.error("Error fetching AI analysis:", error);
      setAiAnalysis("AI分析の生成中にエラーが発生しました");
    } finally {
      setLoadingAiAnalysis(false);
    }
  };

  // 円グラフの色
  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  // 認証チェック
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // 認証ローディング中
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">認証確認中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合
  if (status === "unauthenticated") {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* POPサイドバー */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex">
          <div className="w-72 bg-white shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Membry</h2>
                  <p className="text-xs text-white/70">Main System</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              collapsed={false}
              onNavigate={() => setSidebarOpen(false)}
              isPopover
            />
          </div>
        </div>
      </div>

      {/* ヘッダー（固定・コンパクト） */}
      <header className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 shadow-lg z-30">
        <div className="w-full px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* メニューボタン */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push("/baiyaku/kensaku")}
                className="flex items-center gap-1 sm:gap-1.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-2 sm:px-3 py-1.5 rounded-full transition-all duration-200 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">検索に戻る</span>
              </button>
            </div>
            {baiyaku && (
              <>
                {/* モバイル: 製番のみ表示 */}
                <div className="flex items-center gap-1 sm:hidden min-w-0 flex-1 mx-2">
                  <span className="text-white font-bold text-sm truncate">{baiyaku.seiban}</span>
                </div>
                {/* PC: 全情報表示 */}
                <div className="hidden sm:flex flex-1 items-center justify-center gap-6 mx-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs">製番:</span>
                    <span className="text-white font-bold">{baiyaku.seiban}</span>
                  </div>
                  <div className="flex items-center gap-2 max-w-md">
                    <span className="text-white/70 text-xs">案件:</span>
                    <span className="text-white font-medium truncate">
                      {baiyaku.hinmei}
                      {baiyaku.hinmei2 && <span className="text-white/70"> / {baiyaku.hinmei2}</span>}
                    </span>
                  </div>
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-white/70 text-xs">受注日:</span>
                    <span className="text-white text-sm">{formatDate(baiyaku.juchu_date)}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-white/70 text-xs">金額:</span>
                    <span className="text-white text-sm">{formatCurrency(baiyaku.juchu_kingaku)}</span>
                  </div>
                  {baiyaku.tantousha && (
                    <div className="hidden lg:flex items-center gap-2">
                      <span className="text-white/70 text-xs">担当:</span>
                      <span className="text-white text-sm font-medium">{baiyaku.tantousha}</span>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {user && (
                <div className="hidden sm:flex items-center gap-1.5 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user.name || user.email}</span>
                </div>
              )}
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-white bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-0 md:gap-4 px-0 md:px-2 py-0 md:py-3 w-full overflow-hidden">
        {/* モバイル: メニュー選択バー */}
        <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2">
          <button
            onClick={() => setDetailMenuOpen(!detailMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200"
          >
            <div className="flex items-center gap-2">
              <span className={menuItems.find(m => m.id === activeMenu)?.activeColor}>
                {menuItems.find(m => m.id === activeMenu)?.icon}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {menuItems.find(m => m.id === activeMenu)?.label}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${detailMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {detailMenuOpen && (
            <nav className="mt-2 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveMenu(item.id);
                    setDetailMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm rounded-md transition-all duration-200 ${
                    activeMenu === item.id
                      ? "bg-gradient-to-r from-indigo-50 to-purple-50 font-semibold border-l-3 border-indigo-500"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className={activeMenu === item.id ? item.activeColor : item.color}>
                    {item.icon}
                  </span>
                  <span className={activeMenu === item.id ? "text-gray-800" : "text-gray-600"}>
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* PC: サイドメニュー（固定・左寄せ） */}
        <aside className="hidden md:block w-52 flex-shrink-0 overflow-y-auto">
          <nav className="bg-white rounded-lg shadow-lg p-2 space-y-1 sticky top-0">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm rounded-md transition-all duration-200 ${
                  activeMenu === item.id
                    ? "bg-gradient-to-r from-indigo-50 to-purple-50 font-semibold border-l-3 border-indigo-500 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={activeMenu === item.id ? item.activeColor : item.color}>
                  {item.icon}
                </span>
                <span className={activeMenu === item.id ? "text-gray-800" : "text-gray-600"}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* メインコンテンツ（スクロール可能） */}
        <main className="flex-1 overflow-y-auto px-2 md:px-0 py-2 md:py-0">
          {activeMenu === "baiyaku-detail" && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">売約詳細情報</h2>
              </div>
              {loadingBaiyakuDetail ? (
                <div className="px-6 py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="ml-3 text-gray-500">読み込み中...</span>
                </div>
              ) : baiyakuDetail ? (
                <div className="p-6 space-y-6">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">基本情報</h3>
                      <dl className="grid grid-cols-2 gap-y-2 text-sm">
                        <dt className="text-gray-500">受注伝票番号</dt>
                        <dd className="font-medium">{baiyakuDetail.juchu_denpyo_no || "-"}</dd>
                        <dt className="text-gray-500">製番</dt>
                        <dd className="font-medium">{baiyakuDetail.seiban || "-"}</dd>
                        <dt className="text-gray-500">受注件名</dt>
                        <dd className="font-medium col-span-2 mt-1">{baiyakuDetail.juchu_kenmei || "-"}</dd>
                        <dt className="text-gray-500">担当者</dt>
                        <dd className="font-medium">{baiyakuDetail.tantousha || "-"}</dd>
                        <dt className="text-gray-500">部門</dt>
                        <dd className="font-medium">{baiyakuDetail.bumon || "-"}</dd>
                        <dt className="text-gray-500">受注日</dt>
                        <dd className="font-medium">{baiyakuDetail.juchu_date || "-"}</dd>
                        <dt className="text-gray-500">納期</dt>
                        <dd className="font-medium">{baiyakuDetail.nouki || "-"}</dd>
                      </dl>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">受注金額</h3>
                      <dl className="grid grid-cols-2 gap-y-2 text-sm">
                        <dt className="text-gray-500">品名</dt>
                        <dd className="font-medium">{baiyakuDetail.hinmei || "-"}</dd>
                        {baiyakuDetail.hinmei2 && (
                          <>
                            <dt className="text-gray-500">品名2</dt>
                            <dd className="font-medium">{baiyakuDetail.hinmei2}</dd>
                          </>
                        )}
                        <dt className="text-gray-500">数量</dt>
                        <dd className="font-medium">{baiyakuDetail.juchu_suryo ?? "-"} {baiyakuDetail.juchu_tani}</dd>
                        <dt className="text-gray-500">単価</dt>
                        <dd className="font-medium">{baiyakuDetail.juchu_tanka ? formatCurrency(baiyakuDetail.juchu_tanka) : "-"}</dd>
                        <dt className="text-gray-500">受注金額</dt>
                        <dd className="font-bold text-lg text-indigo-600">{baiyakuDetail.juchu_kingaku ? formatCurrency(baiyakuDetail.juchu_kingaku) : "-"}</dd>
                        <dt className="text-gray-500">予定粗利率</dt>
                        <dd className="font-medium">{baiyakuDetail.yotei_arariritsu != null ? `${baiyakuDetail.yotei_arariritsu}%` : "-"}</dd>
                        <dt className="text-gray-500">売上見込日</dt>
                        <dd className="font-medium">{baiyakuDetail.uriage_mikomi_date || "-"}</dd>
                      </dl>
                    </div>
                  </div>

                  {/* 得意先・納入先情報 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-700 mb-3 border-b border-blue-200 pb-2">得意先情報</h3>
                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-gray-500">得意先名</dt>
                          <dd className="font-medium">{baiyakuDetail.tokuisaki.name1} {baiyakuDetail.tokuisaki.name2}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">住所</dt>
                          <dd className="font-medium flex items-center gap-2">
                            <span>〒{baiyakuDetail.tokuisaki.postal_code} {baiyakuDetail.tokuisaki.address}</span>
                            {baiyakuDetail.tokuisaki.address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(baiyakuDetail.tokuisaki.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                <MapPin className="w-3 h-3" />
                                MAP
                              </a>
                            )}
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <dt className="text-gray-500">TEL</dt>
                            <dd className="font-medium">{baiyakuDetail.tokuisaki.tel || "-"}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">FAX</dt>
                            <dd className="font-medium">{baiyakuDetail.tokuisaki.fax || "-"}</dd>
                          </div>
                        </div>
                      </dl>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-green-700 mb-3 border-b border-green-200 pb-2">納入先情報</h3>
                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-gray-500">納入先名</dt>
                          <dd className="font-medium">{baiyakuDetail.nounyusaki.name1} {baiyakuDetail.nounyusaki.name2}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">住所</dt>
                          <dd className="font-medium flex items-center gap-2">
                            <span>〒{baiyakuDetail.nounyusaki.postal_code} {baiyakuDetail.nounyusaki.address}</span>
                            {baiyakuDetail.nounyusaki.address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(baiyakuDetail.nounyusaki.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                <MapPin className="w-3 h-3" />
                                MAP
                              </a>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">TEL</dt>
                          <dd className="font-medium">{baiyakuDetail.nounyusaki.tel || "-"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* 仕様情報 */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-orange-700 mb-3 border-b border-orange-200 pb-2">仕様情報</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className="text-gray-500">間口サイズ</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.maguchi_size ?? "-"}<span className="text-sm font-normal ml-1">M</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">桁サイズ</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.keta_size ?? "-"}<span className="text-sm font-normal ml-1">M</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">高さ</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.takasa ?? "-"}<span className="text-sm font-normal ml-1">M</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">建屋面積</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.tateya_area ?? "-"}<span className="text-sm font-normal ml-1">㎡</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">鉄骨重量</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.tekkotsu_juryo?.toLocaleString() ?? "-"}<span className="text-sm font-normal ml-1">kg</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">膜面積</dt>
                        <dd className="font-bold text-lg">{baiyakuDetail.maku_area ?? "-"}<span className="text-sm font-normal ml-1">㎡</span></dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">膜材仕様</dt>
                        <dd className="font-medium">{baiyakuDetail.maku_shiyou || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">塗装仕様</dt>
                        <dd className="font-medium">{baiyakuDetail.tosou_shiyou || "-"}</dd>
                      </div>
                    </div>
                  </div>

                  {/* 予定工数 */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-purple-700 mb-3 border-b border-purple-200 pb-2">予定工数</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <dt className="text-gray-500 mb-1">鉄工製作</dt>
                        <dd className="font-bold text-xl text-purple-600">{baiyakuDetail.yotei_tekko_jikan ?? "-"}<span className="text-sm font-normal ml-1">時間</span></dd>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <dt className="text-gray-500 mb-1">縫製製作</dt>
                        <dd className="font-bold text-xl text-purple-600">{baiyakuDetail.yotei_housei_jikan ?? "-"}<span className="text-sm font-normal ml-1">時間</span></dd>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <dt className="text-gray-500 mb-1">製作図</dt>
                        <dd className="font-bold text-xl text-purple-600">{baiyakuDetail.yotei_seizu_jikan ?? "-"}<span className="text-sm font-normal ml-1">時間</span></dd>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm col-span-2 md:col-span-2">
                        <dt className="text-gray-500 mb-1">施工</dt>
                        <dd className="font-bold text-xl text-purple-600">
                          {baiyakuDetail.yotei_sekou_ninzu ?? "-"}<span className="text-sm font-normal mx-1">人</span>
                          ×
                          {baiyakuDetail.yotei_sekou_nissu ?? "-"}<span className="text-sm font-normal ml-1">日</span>
                        </dd>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-gray-500">
                  売約詳細情報が見つかりません
                </div>
              )}
            </div>
          )}

          {activeMenu === "customer-requests" && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">顧客要求事項変更履歴</h2>
              </div>
              {customerRequests.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  データがありません
                </div>
              ) : (
                <div className="grid grid-cols-3 divide-x">
                  {/* 仕様変更列 */}
                  <div className="flex flex-col">
                    <div className="px-4 py-3 bg-blue-50 border-b">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                        仕様変更
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({customerRequests.filter(r => r.youkyuu_kubun === "仕様変更").length}件)
                      </span>
                    </div>
                    <div className="flex-1 divide-y overflow-y-auto max-h-[600px]">
                      {customerRequests
                        .filter(item => item.youkyuu_kubun === "仕様変更")
                        .map((item) => (
                          <div key={item.record_id} className="px-4 py-3">
                            <div className="text-xs text-gray-500 mb-1">
                              {formatDate(item.shinsei_date)}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {item.honbun}
                            </p>
                          </div>
                        ))}
                      {customerRequests.filter(r => r.youkyuu_kubun === "仕様変更").length === 0 && (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                          データなし
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 金額変更列 */}
                  <div className="flex flex-col">
                    <div className="px-4 py-3 bg-amber-50 border-b">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded">
                        金額変更
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({customerRequests.filter(r => r.youkyuu_kubun === "金額変更").length}件)
                      </span>
                    </div>
                    <div className="flex-1 divide-y overflow-y-auto max-h-[600px]">
                      {customerRequests
                        .filter(item => item.youkyuu_kubun === "金額変更")
                        .map((item) => (
                          <div key={item.record_id} className="px-4 py-3">
                            <div className="text-xs text-gray-500 mb-1">
                              {formatDate(item.shinsei_date)}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {item.honbun}
                            </p>
                          </div>
                        ))}
                      {customerRequests.filter(r => r.youkyuu_kubun === "金額変更").length === 0 && (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                          データなし
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 納期変更列 */}
                  <div className="flex flex-col">
                    <div className="px-4 py-3 bg-purple-50 border-b">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded">
                        納期変更
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({customerRequests.filter(r => r.youkyuu_kubun === "納期変更").length}件)
                      </span>
                    </div>
                    <div className="flex-1 divide-y overflow-y-auto max-h-[600px]">
                      {customerRequests
                        .filter(item => item.youkyuu_kubun === "納期変更")
                        .map((item) => (
                          <div key={item.record_id} className="px-4 py-3">
                            <div className="text-xs text-gray-500 mb-1">
                              {formatDate(item.shinsei_date)}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {item.honbun}
                            </p>
                          </div>
                        ))}
                      {customerRequests.filter(r => r.youkyuu_kubun === "納期変更").length === 0 && (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                          データなし
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMenu === "quality-issues" && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">不具合情報</h2>
              </div>
              <div className="divide-y">
                {qualityIssues.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    データがありません
                  </div>
                ) : (
                  qualityIssues.map((item) => (
                    <div key={item.record_id} className="px-6 py-4">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm text-gray-500">
                          {formatDate(item.hassei_date)}
                        </span>
                        <span className="text-xs text-gray-600">
                          発見: {item.hakken_busho} / 起因: {item.kiin_busho}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        {item.fuguai_title}
                      </h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {item.fuguai_honbun}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeMenu === "nippou" && (
            <div className="space-y-4">
              {/* 配布設定(F2-07): 施工業者は複数登録可。明細クリックで編集・再送信 */}
              <div className="bg-white rounded-lg shadow px-4 sm:px-6 py-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="w-5 h-5 text-rose-500" /> 作業日報
                  </h2>
                </div>

                {/* 登録済み施工業者の明細(製番キー・約3行・縦スクロール) */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">登録済み施工業者</p>
                  {nippouAnkenList.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                      まだ登録がありません。下の入力欄から業者を追加してください。
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 divide-y max-h-40 overflow-y-auto">
                      {nippouAnkenList.map((a) => (
                        <div
                          key={a.record_id}
                          onClick={() => editAnkenRow(a)}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-rose-50 ${
                            ankenForm.recordId === a.record_id ? "bg-rose-50" : ""
                          }`}
                          title="クリックで内容を下の入力欄へ転記(訂正・再送信)"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{a.contractor || "(業者名未設定)"}</p>
                            <p className="text-xs text-gray-500 truncate">{a.contractorEmail || "メール未登録"}</p>
                          </div>
                          {a.status === "完了" && (
                            <span className="flex-none rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">完了</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); showNippouQr(a.uketsukeCode); }}
                            disabled={!a.uketsukeCode}
                            className="flex-none inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-40"
                            title="この業者の案件別URLのQRを表示"
                          >
                            <QrCode className="w-3.5 h-3.5" /> QR
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); resendNippouMail(a); }}
                            disabled={!a.contractorEmail}
                            className="flex-none inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-40"
                            title="この業者宛のメールをメールソフトで作成"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">メール作成</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 入力欄(新規追加 or 明細編集)。受付コードは裏で自動生成 */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">
                      {ankenForm.recordId ? "施工業者を編集" : "施工業者を追加"}
                    </p>
                    {ankenForm.recordId && (
                      <button
                        type="button"
                        onClick={resetAnkenForm}
                        className="text-xs text-gray-500 underline hover:text-gray-700"
                      >
                        新規追加に切替
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-gray-500">施工業者</span>
                      <input
                        type="text"
                        value={ankenForm.contractor}
                        onChange={(e) => setAnkenForm((f) => ({ ...f, contractor: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">業者メールアドレス</span>
                      <input
                        type="email"
                        value={ankenForm.contractorEmail}
                        onChange={(e) => setAnkenForm((f) => ({ ...f, contractorEmail: e.target.value }))}
                        placeholder="gyosha@example.com"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={saveAndSendAnken}
                      disabled={savingAnken}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
                    >
                      {savingAnken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} 保存＆メール送信
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    「保存＆メール送信」で保存後、お使いのメールソフトが宛先・本文入りで開きます(そのまま送信してください)。
                    受付コードは保存時に自動生成。物件名 / 施工場所 / 営業担当者は売約情報から自動反映されます。
                  </p>
                </div>
              </div>

              {/* 日報一覧(閲覧のみ) */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">
                    日報一覧
                    {nippouReports.length > 0 && (
                      <span className="ml-2 text-sm text-gray-500">{nippouReports.length}件</span>
                    )}
                  </h3>
                  <span className="text-xs text-gray-400">閲覧のみ(投稿はフォーム)</span>
                </div>
                {loadingNippou ? (
                  <div className="px-6 py-10 flex items-center justify-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    <span className="ml-3">読み込み中...</span>
                  </div>
                ) : nippouReports.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500">日報がまだありません</div>
                ) : (
                  <div className="p-3 sm:p-4">
                    {/* 施工業者ごとに画面幅へ自動フィット(横スクロールなし・折り返し)。各列は作業報告日の昇順 */}
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}
                    >
                      {nippouGroups.map((g) => (
                        <div key={g.key} className="rounded-xl border border-rose-100 bg-white shadow-sm overflow-hidden">
                          <div className="px-3 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{g.label}</p>
                              <p className="text-xs text-rose-100">{g.reports.length}件の日報</p>
                            </div>
                            <div className="relative flex-none">
                              <button
                                type="button"
                                onClick={() => setDlOpenKey(dlOpenKey === g.key ? null : g.key)}
                                disabled={dlBusyKey === g.key}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
                                title="この業者の日報/写真をダウンロード"
                              >
                                {dlBusyKey === g.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">ダウンロード</span>
                              </button>
                              {dlOpenKey === g.key && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setDlOpenKey(null)} />
                                  <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                                    <button type="button" onClick={() => downloadContractor(g, "csv")} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">日報CSV</button>
                                    <button type="button" onClick={() => downloadContractor(g, "photos")} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">写真ZIP</button>
                                    <button type="button" onClick={() => downloadContractor(g, "both")} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">両方（ZIP）</button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="divide-y md:max-h-[640px] md:overflow-y-auto">
                            {g.reports.map((r) => (
                              <div key={r.record_id} className="px-3 py-3 bg-white">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                                    {r.reportDate || "-"}
                                  </span>
                                  {r.reporter && <span className="text-xs text-gray-600">{r.reporter}</span>}
                                  {r.workers != null && (
                                    <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                      {r.workers}名
                                    </span>
                                  )}
                                </div>
                                {/* PC=コメント欄(左)/写真(右)の2列, モバイル=縦積み */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-1 md:border-r md:border-gray-100 md:pr-3">
                                    {r.content && (
                                      <div>
                                        <span className="text-xs text-gray-400">作業内容</span>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                                      </div>
                                    )}
                                    {r.notes && (
                                      <div>
                                        <span className="text-xs text-gray-400">特記事項・連絡事項</span>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.notes}</p>
                                      </div>
                                    )}
                                    {r.tomorrow && (
                                      <div>
                                        <span className="text-xs text-gray-400">翌日の作業予定</span>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.tomorrow}</p>
                                      </div>
                                    )}
                                    {!r.content && !r.notes && !r.tomorrow && (
                                      <p className="text-xs text-gray-300">コメントなし</p>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-400">写真</span>
                                    {r.photos && r.photos.length > 0 ? (
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        {r.photos.map((p, i) => {
                                          const url = p.file_token ? nippouPhotoUrls[p.file_token] : undefined;
                                          return url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                              <img
                                                src={url}
                                                alt={p.name || "現場写真"}
                                                className="h-20 w-20 rounded-md object-cover border border-gray-200 hover:opacity-90"
                                              />
                                            </a>
                                          ) : (
                                            <div
                                              key={i}
                                              className="h-20 w-20 rounded-md border border-gray-200 flex items-center justify-center text-gray-300"
                                            >
                                              <ImageIcon className="w-6 h-6" />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-xs text-gray-300">写真なし</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* F2-08 案件別URL QRモーダル */}
          {nippouQr && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setNippouQr(null)}
            >
              <div
                className="w-full max-w-sm rounded-2xl bg-white p-6 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-1 text-lg font-semibold text-gray-800">案件別URL(外注配布用)</h3>
                <p className="mb-4 text-xs text-gray-500">
                  業者にこのQR / URLを配布してください。受付コード入りの専用URLです。
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nippouQr.dataUrl} alt="案件別URL QRコード" className="mx-auto mb-4 h-56 w-56" />
                <div className="mb-4 break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {nippouQr.url}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(nippouQr.url)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="w-4 h-4" /> URLをコピー
                  </button>
                  <button
                    onClick={() => setNippouQr(null)}
                    className="flex-1 rounded-lg bg-rose-500 py-2 text-sm font-medium text-white hover:bg-rose-600"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMenu === "gantt-chart" && loadingSchedule && (
            <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="ml-3 text-gray-500">工程データを読み込み中...</span>
            </div>
          )}

          {activeMenu === "gantt-chart" && !loadingSchedule && (() => {
            const SCHED_PROCESSES = [
              { key: "受注", label: "受注", color: "#6366f1" },
              { key: "計画図作成", label: "計画図作成", color: "#3b82f6" },
              { key: "申請必要情報確定", label: "申請必要情報確定", color: "#0ea5e9" },
              { key: "承認図作成", label: "承認図作成", color: "#14b8a6" },
              { key: "図面承認", label: "図面承認", color: "#22c55e" },
              { key: "申請図書作成", label: "申請図書作成", color: "#84cc16" },
              { key: "申請期間構造", label: "申請期間（構造）", color: "#eab308" },
              { key: "申請期間確認済", label: "申請期間（確認済）", color: "#f59e0b" },
              { key: "製作図", label: "製作図", color: "#f97316" },
              { key: "材料手配", label: "材料手配", color: "#ef4444" },
              { key: "製作期間", label: "製作期間", color: "#dc2626" },
              { key: "基礎工事", label: "基礎工事", color: "#be185d" },
              { key: "施工期間", label: "施工期間", color: "#9333ea" },
              { key: "完了検査", label: "完了検査", color: "#7c3aed" },
            ];
            const fieldNameFor = (proc: string, type: "start" | "end") => `社内工程表_${proc}${type === "start" ? "開始日" : "終了日"}`;
            const dates = scheduleData?.dates ?? {};
            const deptFieldsAll = scheduleData?.deptFields ?? {};
            const DAY_MS = 86400000;
            const parseTextDateForRange = (val: string | null | undefined): number | null => {
              if (!val) return null;
              const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
              if (m) return Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
              const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})/);
              if (m2) return Date.UTC(new Date().getFullYear(), parseInt(m2[1]) - 1, parseInt(m2[2]));
              return null;
            };
            const schedDateValues = Object.values(dates).flatMap(d => [d?.start, d?.end]).filter(Boolean) as number[];
            const deptDateValues = Object.values(deptFieldsAll).map(parseTextDateForRange).filter(Boolean) as number[];
            const allDates = [...schedDateValues, ...deptDateValues];
            let minDate: number;
            let maxDate: number;
            if (allDates.length === 0) {
              const baseDate = baiyaku?.juchu_date ? new Date(baiyaku.juchu_date).getTime() : Date.now();
              const validBase = isNaN(baseDate) ? Date.now() : baseDate;
              minDate = validBase;
              maxDate = validBase + 180 * DAY_MS;
            } else {
              minDate = Math.min(...allDates);
              maxDate = Math.max(...allDates);
            }
            const startMonth = new Date(minDate);
            startMonth.setUTCDate(1);
            const gridStart = startMonth.getTime();
            const endMonth = new Date(maxDate);
            endMonth.setUTCMonth(endMonth.getUTCMonth() + 1, 1);
            const gridEnd = endMonth.getTime();
            const cellW = 32;
            const labelW = 160;

            // 各月の日付マーカーを生成
            const DAY_MARKERS = [1, 5, 10, 15, 20, 25, 30];
            const gridCells: { day: number; ts: number; isMonthEnd: boolean; monthLabel?: string }[] = [];
            const months: { label: string; cellCount: number }[] = [];
            const curMonth = new Date(gridStart);
            while (curMonth.getTime() < gridEnd) {
              const y = curMonth.getUTCFullYear();
              const m = curMonth.getUTCMonth();
              const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
              const markers = DAY_MARKERS.filter(d => d <= daysInMonth);
              if (!markers.includes(daysInMonth) && daysInMonth === 28) markers.push(28);
              let cellCount = 0;
              for (let mi = 0; mi < markers.length; mi++) {
                const day = markers[mi];
                const ts = Date.UTC(y, m, day);
                if (ts >= gridEnd) break;
                const nextTs = mi + 1 < markers.length ? Date.UTC(y, m, markers[mi + 1]) : Date.UTC(y, m + 1, 1);
                gridCells.push({ day, ts, isMonthEnd: nextTs >= Date.UTC(y, m + 1, 1), monthLabel: cellCount === 0 ? `${m + 1}月` : undefined });
                cellCount++;
              }
              months.push({ label: `${m + 1}月`, cellCount });
              curMonth.setUTCMonth(curMonth.getUTCMonth() + 1);
              curMonth.setUTCDate(1);
            }
            const totalCells = gridCells.length;
            const totalGridW = totalCells * cellW;

            const tsToDate = (ts: number) => {
              const d = new Date(ts);
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            };
            const tsToDisplay = (ts: number | null) => {
              if (!ts) return "";
              const d = new Date(ts);
              return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            };

            const handleDateChange = async (proc: string, type: "start" | "end", value: string) => {
              const field = fieldNameFor(proc, type);
              const cellKey = `${proc}-${type}`;
              setSavingSchedule(cellKey);
              try {
                const res = await fetch("/api/schedule", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ seiban, process: proc, field, value }),
                });
                const json = await res.json();
                if (json.success) {
                  const ts = value ? Date.UTC(parseInt(value.substring(0, 4)), parseInt(value.substring(5, 7)) - 1, parseInt(value.substring(8, 10))) : null;
                  setScheduleData(prev => {
                    const base = prev ?? { recordId: "", dates: {}, deptFields: {} };
                    const existingProc = base.dates[proc] ?? { start: null, end: null };
                    return {
                      ...base,
                      dates: { ...base.dates, [proc]: { ...existingProc, [type]: ts } },
                    };
                  });
                }
              } catch (e) {
                console.error("Schedule update failed:", e);
              } finally {
                setSavingSchedule(null);
                setEditingScheduleCell(null);
              }
            };

            const findCellPos = (ts: number) => {
              for (let ci = 0; ci < gridCells.length; ci++) {
                const nextTs = ci + 1 < gridCells.length ? gridCells[ci + 1].ts : gridEnd;
                if (ts >= gridCells[ci].ts && ts < nextTs) {
                  const cellSpan = (nextTs - gridCells[ci].ts) / DAY_MS;
                  const offset = (ts - gridCells[ci].ts) / DAY_MS;
                  return ci + (cellSpan > 0 ? offset / cellSpan : 0);
                }
              }
              return ts >= gridEnd ? gridCells.length : 0;
            };

            const schedMin = schedDateValues.length > 0 ? Math.min(...schedDateValues) : null;
            const schedMax = schedDateValues.length > 0 ? Math.max(...schedDateValues) : null;
            const schedMinStr = schedMin ? `${new Date(schedMin).getUTCMonth() + 1}/${new Date(schedMin).getUTCDate()}` : "";
            const schedMaxStr = schedMax ? `${new Date(schedMax).getUTCMonth() + 1}/${new Date(schedMax).getUTCDate()}` : "";

            return (
              <div className="bg-white rounded-lg shadow mb-4">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <button
                    onClick={() => setScheduleCollapsed(prev => !prev)}
                    className="flex items-center gap-2"
                  >
                    {scheduleCollapsed ? <ChevronRight className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    <h2 className="text-lg font-semibold">社内工程表</h2>
                    {scheduleCollapsed && schedMinStr && (
                      <span className="text-sm text-gray-400 ml-2">{schedMinStr} ～ {schedMaxStr}</span>
                    )}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setScheduleCollapsed(false); setCollapsedDeptSections(new Set()); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      すべて展開
                    </button>
                    <button
                      onClick={() => { setScheduleCollapsed(true); setCollapsedDeptSections(new Set(["設計", "鉄工", "縫製", "工務"])); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                      すべて閉じる
                    </button>
                  </div>
                </div>
                {scheduleCollapsed && schedMin && schedMax && (
                  <div className="px-4 py-2 flex">
                    <div className="flex-shrink-0" style={{ width: labelW + 112 }} />
                    <div className="flex-1 overflow-x-auto">
                      <div className="relative" style={{ width: totalCells * cellW, height: 28 }}>
                        <div className="absolute inset-0 flex">
                          {gridCells.map((cell, i) => (
                            <div key={i} className={cell.isMonthEnd ? "border-r-2 border-gray-200" : "border-r border-gray-50"} style={{ width: cellW, minWidth: cellW }} />
                          ))}
                        </div>
                        <div className="absolute rounded" style={{
                          left: findCellPos(schedMin) * cellW,
                          width: Math.max(0.5, findCellPos(schedMax) - findCellPos(schedMin)) * cellW,
                          top: 4, height: 20,
                          backgroundColor: "#6366f1", opacity: 0.5,
                        }} />
                      </div>
                    </div>
                  </div>
                )}
                {!scheduleCollapsed && <div className="p-4 flex">
                  {/* 左固定列: 工程名 + 日付 */}
                  <div className="flex-shrink-0" style={{ width: labelW + 112 }}>
                    {/* ヘッダー分の空白 */}
                    <div className="border-b-2 border-gray-300 bg-gray-50" style={{ height: 20 }}>&nbsp;</div>
                    <div style={{ height: 18 }}>&nbsp;</div>
                    {/* 工程行 */}
                    {SCHED_PROCESSES.map((proc) => {
                      const d = dates[proc.key];
                      return (
                        <div key={proc.key} className="flex items-center border-b border-gray-100" style={{ height: 36 }}>
                          <div className="text-xs font-semibold text-gray-700 truncate pr-2" style={{ width: labelW }}>
                            {proc.label}
                          </div>
                          {(["start", "end"] as const).map((type) => {
                            const cellKey = `${proc.key}-${type}`;
                            const ts = d?.[type] || null;
                            if (editingScheduleCell === cellKey) {
                              return (
                                <input
                                  key={type}
                                  type="date"
                                  defaultValue={ts ? tsToDate(ts) : ""}
                                  autoFocus
                                  onBlur={(e) => handleDateChange(proc.key, type, e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingScheduleCell(null); }}
                                  className="border border-blue-400 rounded px-1.5 py-1 text-xs w-[80px] flex-shrink-0 focus:ring-1 focus:ring-blue-300"
                                />
                              );
                            }
                            return (
                              <button
                                key={type}
                                onClick={() => setEditingScheduleCell(cellKey)}
                                className={`text-xs px-1.5 py-1 rounded hover:bg-blue-50 w-[56px] flex-shrink-0 text-center ${
                                  savingSchedule === cellKey ? "opacity-50" : ""
                                } ${ts ? "text-gray-700" : "text-gray-300"}`}
                                disabled={savingSchedule === cellKey}
                              >
                                {savingSchedule === cellKey ? "..." : ts ? tsToDisplay(ts) : "--/--"}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  {/* 右スクロール列: ガントチャート */}
                  <div className="flex-1 overflow-x-auto">
                    <div style={{ width: totalGridW }}>
                      {/* 月ヘッダー */}
                      <div className="flex">
                        {months.map((m, i) => (
                          <div key={i} className="text-center text-xs font-bold border-b-2 border-gray-300 border-r-2 border-r-gray-400 bg-gray-50" style={{ width: m.cellCount * cellW, height: 20 }}>
                            {m.label}
                          </div>
                        ))}
                      </div>
                      {/* 日付目盛り */}
                      <div className="flex" style={{ height: 18 }}>
                        {gridCells.map((cell, i) => (
                          <div key={i} className={`text-center text-[10px] text-gray-400 ${cell.isMonthEnd ? "border-r-2 border-gray-400" : "border-r border-gray-200"}`} style={{ width: cellW, minWidth: cellW }}>
                            {cell.day}
                          </div>
                        ))}
                      </div>
                      {/* 工程行バー */}
                      {SCHED_PROCESSES.map((proc) => {
                        const d = dates[proc.key];
                        const hasBar = d?.start && d?.end;
                        const barStartPos = hasBar ? findCellPos(d.start!) : 0;
                        const barEndPos = hasBar ? findCellPos(d.end!) : 0;
                        const barWidthCells = hasBar ? Math.max(0.3, barEndPos - barStartPos) : 0;

                        return (
                          <div key={proc.key} className="relative border-b border-gray-100" style={{ height: 36 }}>
                            {/* グリッド線（月境界は太線） */}
                            <div className="absolute inset-0 flex">
                              {gridCells.map((cell, i) => (
                                <div key={i} className={cell.isMonthEnd ? "border-r-2 border-gray-300" : "border-r border-gray-100"} style={{ width: cellW, minWidth: cellW }} />
                              ))}
                            </div>
                            {/* バー */}
                            {hasBar && (
                              <div
                                className="absolute rounded-sm"
                                style={{
                                  left: barStartPos * cellW,
                                  width: barWidthCells * cellW,
                                  top: 8,
                                  height: 20,
                                  backgroundColor: proc.color,
                                  opacity: 0.85,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>}
              </div>
            );
          })()}

          {activeMenu === "gantt-chart" && !loadingSchedule && (() => {
            const df = scheduleData?.deptFields ?? {};
            const DEPT_SECTIONS = [
              { key: "設計", label: "設計", color: "#3b82f6", items: [
                { label: "承認図", from: "承認図YMD_FROM", to: "承認図YMD_TO" },
                { label: "製作図", from: "製作図YMD_FROM", to: "製作図YMD_TO" },
              ]},
              { key: "鉄工", label: "鉄工", color: "#10b981", items: [
                { label: "材料", from: "材料YMD_FROM", to: "材料YMD_TO" },
                { label: "原寸仮組", from: "原寸仮組YMD_FROM", to: "原寸仮組YMD_TO" },
                { label: "本溶接", from: "本溶接YMD_FROM", to: "本溶接YMD_TO" },
                { label: "塗装", from: "塗装YMD_FROM", to: "塗装YMD_TO" },
                { label: "メッキ出日1", from: "メッキ出日1", to: null },
                { label: "メッキ出日2", from: "メッキ出日2", to: null },
                { label: "メッキ出日3", from: "メッキ出日3", to: null },
                { label: "積込日1", from: "積込日1", to: null },
                { label: "積込日2", from: "積込日2", to: null },
                { label: "積込日3", from: "積込日3", to: null },
              ]},
              { key: "縫製", label: "縫製", color: "#8b5cf6", items: [
                { label: "膜製作", from: "膜製作YMD_FROM", to: "膜製作YMD_TO" },
              ]},
              { key: "工務", label: "工務", color: "#f59e0b", items: [
                { label: "施工", from: "施工YMD_FROM", to: "施工YMD_TO" },
              ]},
            ];

            const parseTextDate = (val: string | null): number | null => {
              if (!val) return null;
              const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
              if (m) return Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
              const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})/);
              if (m2) return Date.UTC(new Date().getFullYear(), parseInt(m2[1]) - 1, parseInt(m2[2]));
              return null;
            };

            // 社内工程表と同じグリッドを共有するため、同じ日付範囲を使用
            const allSchedDates = Object.values(scheduleData?.dates ?? {}).flatMap(d => [d?.start, d?.end]).filter(Boolean) as number[];
            const allDeptDates = DEPT_SECTIONS.flatMap(s => s.items.flatMap(it => [parseTextDate(df[it.from]), it.to ? parseTextDate(df[it.to]) : null])).filter(Boolean) as number[];
            const allD = [...allSchedDates, ...allDeptDates];

            const DAY_MS2 = 86400000;
            const DAY_MARKERS2 = [1, 5, 10, 15, 20, 25, 30];
            let mn: number;
            let mx: number;
            if (allD.length === 0) {
              const baseDate = baiyaku?.juchu_date ? new Date(baiyaku.juchu_date).getTime() : Date.now();
              const validBase = isNaN(baseDate) ? Date.now() : baseDate;
              mn = validBase;
              mx = validBase + 180 * DAY_MS2;
            } else {
              mn = Math.min(...allD);
              mx = Math.max(...allD);
            }
            const gs = new Date(mn); gs.setUTCDate(1);
            const gridStart2 = gs.getTime();
            const ge = new Date(mx); ge.setUTCMonth(ge.getUTCMonth() + 1, 1);
            const gridEnd2 = ge.getTime();
            const cellW2 = 32;
            const labelW2 = 140;

            const gridCells2: { day: number; ts: number; isMonthEnd: boolean }[] = [];
            const months2: { label: string; cellCount: number }[] = [];
            const cm2 = new Date(gridStart2);
            while (cm2.getTime() < gridEnd2) {
              const y = cm2.getUTCFullYear(), m = cm2.getUTCMonth();
              const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
              const markers = DAY_MARKERS2.filter(d => d <= dim);
              if (!markers.includes(dim) && dim === 28) markers.push(28);
              let cc = 0;
              for (let mi = 0; mi < markers.length; mi++) {
                const day = markers[mi];
                const ts = Date.UTC(y, m, day);
                if (ts >= gridEnd2) break;
                const nextTs = mi + 1 < markers.length ? Date.UTC(y, m, markers[mi + 1]) : Date.UTC(y, m + 1, 1);
                gridCells2.push({ day, ts, isMonthEnd: nextTs >= Date.UTC(y, m + 1, 1) });
                cc++;
              }
              months2.push({ label: `${m + 1}月`, cellCount: cc });
              cm2.setUTCMonth(cm2.getUTCMonth() + 1); cm2.setUTCDate(1);
            }
            const totalCells2 = gridCells2.length;

            const findPos2 = (ts: number) => {
              for (let ci = 0; ci < gridCells2.length; ci++) {
                const nextTs = ci + 1 < gridCells2.length ? gridCells2[ci + 1].ts : gridEnd2;
                if (ts >= gridCells2[ci].ts && ts < nextTs) {
                  const span = (nextTs - gridCells2[ci].ts) / DAY_MS2;
                  return ci + (span > 0 ? (ts - gridCells2[ci].ts) / DAY_MS2 / span : 0);
                }
              }
              return ts >= gridEnd2 ? gridCells2.length : 0;
            };

            const textDateToInput = (val: string | null): string => {
              const ts = parseTextDate(val);
              if (!ts) return "";
              const d = new Date(ts);
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            };
            const textDateToDisplay = (val: string | null): string => {
              const ts = parseTextDate(val);
              if (!ts) return "";
              const d = new Date(ts);
              return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            };

            const handleDeptDateChange = async (field: string, value: string) => {
              const cellKey = `dept-${field}`;
              setSavingSchedule(cellKey);
              try {
                const res = await fetch("/api/schedule", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ seiban, field, value, fieldType: "text" }),
                });
                const json = await res.json();
                if (json.success) {
                  setScheduleData(prev => {
                    const base = prev ?? { recordId: "", dates: {}, deptFields: {} };
                    return { ...base, deptFields: { ...base.deptFields, [field]: value || null } };
                  });
                }
              } catch (e) {
                console.error("Dept schedule update failed:", e);
              } finally {
                setSavingSchedule(null);
                setEditingScheduleCell(null);
              }
            };

            return (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-semibold">部署別工程表</h2>
                </div>
                <div className="p-4">
                  {DEPT_SECTIONS.map((dept) => {
                    const isCollapsed = collapsedDeptSections.has(dept.key);
                    return (
                      <div key={dept.key} className="mb-2">
                        <button
                          onClick={() => setCollapsedDeptSections(prev => {
                            const next = new Set(prev);
                            next.has(dept.key) ? next.delete(dept.key) : next.add(dept.key);
                            return next;
                          })}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-t-lg hover:bg-gray-50 transition-colors"
                          style={{ borderLeft: `4px solid ${dept.color}` }}
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          <span className="text-sm font-bold text-gray-800">{dept.label}</span>
                          <span className="text-xs text-gray-400">({dept.items.length}項目)</span>
                        </button>
                        {isCollapsed && (() => {
                          const deptDates = dept.items.flatMap(it => [parseTextDate(df[it.from]), it.to ? parseTextDate(df[it.to]) : null]).filter(Boolean) as number[];
                          if (deptDates.length === 0) return null;
                          const dMin = Math.min(...deptDates);
                          const dMax = Math.max(...deptDates);
                          const bS = findPos2(dMin);
                          const bE = findPos2(dMax);
                          const bW = Math.max(0.5, bE - bS);
                          const dMinD = new Date(dMin);
                          const dMaxD = new Date(dMax);
                          const dMinStr = `${dMinD.getUTCMonth() + 1}/${dMinD.getUTCDate()}`;
                          const dMaxStr = `${dMaxD.getUTCMonth() + 1}/${dMaxD.getUTCDate()}`;
                          return (
                            <div className="flex border-b border-gray-200 pb-1 mb-1">
                              <div className="flex-shrink-0 flex items-center" style={{ width: labelW2 + 112 }}>
                                <span className="text-xs text-gray-400 pl-6">{dMinStr} ～ {dMaxStr}</span>
                              </div>
                              <div className="flex-1 overflow-x-auto">
                                <div className="relative" style={{ width: totalCells2 * cellW2, height: 24 }}>
                                  <div className="absolute inset-0 flex">
                                    {gridCells2.map((cell, i) => (
                                      <div key={i} className={cell.isMonthEnd ? "border-r-2 border-gray-200" : "border-r border-gray-50"} style={{ width: cellW2, minWidth: cellW2 }} />
                                    ))}
                                  </div>
                                  <div className="absolute rounded" style={{
                                    left: bS * cellW2, width: bW * cellW2, top: 4, height: 16,
                                    backgroundColor: dept.color, opacity: 0.6,
                                  }} />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {!isCollapsed && (
                          <div className="flex border-b border-gray-200 pb-2 mb-2">
                            {/* 左固定列 */}
                            <div className="flex-shrink-0" style={{ width: labelW2 + 112 }}>
                              {/* ヘッダー空白 */}
                              <div style={{ height: 20 }}>&nbsp;</div>
                              <div style={{ height: 18 }}>&nbsp;</div>
                              {dept.items.map((item) => {
                                const fromVal = df[item.from];
                                const toVal = item.to ? df[item.to] : null;
                                return (
                                  <div key={item.label} className="flex items-center border-b border-gray-100" style={{ height: 32 }}>
                                    <div className="text-xs text-gray-600 truncate pr-1" style={{ width: labelW2 }}>{item.label}</div>
                                    {[{ field: item.from, val: fromVal }, { field: item.to, val: toVal }].map(({ field: f, val }, fi) => {
                                      if (f === null) return <div key={fi} className="w-[56px] flex-shrink-0" />;
                                      const cellKey = `dept-${f}`;
                                      if (editingScheduleCell === cellKey) {
                                        return (
                                          <input key={fi} type="date" defaultValue={textDateToInput(val)} autoFocus
                                            onBlur={(e) => handleDeptDateChange(f!, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingScheduleCell(null); }}
                                            className="border border-blue-400 rounded px-1 py-0.5 text-xs w-[80px] flex-shrink-0 focus:ring-1 focus:ring-blue-300"
                                          />
                                        );
                                      }
                                      return (
                                        <button key={fi} onClick={() => setEditingScheduleCell(cellKey)}
                                          className={`text-xs px-1 py-0.5 rounded hover:bg-blue-50 w-[56px] flex-shrink-0 text-center ${savingSchedule === cellKey ? "opacity-50" : ""} ${val ? "text-gray-700" : "text-gray-300"}`}
                                          disabled={savingSchedule === cellKey}
                                        >
                                          {savingSchedule === cellKey ? "..." : textDateToDisplay(val) || "--/--"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                            {/* 右スクロール列 */}
                            <div className="flex-1 overflow-x-auto">
                              <div style={{ width: totalCells2 * cellW2 }}>
                                <div className="flex">
                                  {months2.map((m, i) => (
                                    <div key={i} className="text-center text-xs font-bold border-b-2 border-gray-300 border-r-2 border-r-gray-400 bg-gray-50" style={{ width: m.cellCount * cellW2, height: 20 }}>{m.label}</div>
                                  ))}
                                </div>
                                <div className="flex" style={{ height: 18 }}>
                                  {gridCells2.map((cell, i) => (
                                    <div key={i} className={`text-center text-[10px] text-gray-400 ${cell.isMonthEnd ? "border-r-2 border-gray-400" : "border-r border-gray-200"}`} style={{ width: cellW2, minWidth: cellW2 }}>{cell.day}</div>
                                  ))}
                                </div>
                                {dept.items.map((item) => {
                                  const fromTs = parseTextDate(df[item.from]);
                                  const toTs = item.to ? parseTextDate(df[item.to]) : null;
                                  const isSingle = !item.to;
                                  const hasBar = isSingle ? !!fromTs : (!!fromTs && !!toTs);
                                  const bStart = hasBar ? findPos2(fromTs!) : 0;
                                  const bEnd = hasBar ? (isSingle ? bStart + 0.3 : findPos2(toTs!)) : 0;
                                  const bWidth = Math.max(0.2, bEnd - bStart);
                                  return (
                                    <div key={item.label} className="relative border-b border-gray-100" style={{ height: 32 }}>
                                      <div className="absolute inset-0 flex">
                                        {gridCells2.map((cell, i) => (
                                          <div key={i} className={cell.isMonthEnd ? "border-r-2 border-gray-300" : "border-r border-gray-100"} style={{ width: cellW2, minWidth: cellW2 }} />
                                        ))}
                                      </div>
                                      {hasBar && (
                                        <div className="absolute rounded-sm" style={{
                                          left: bStart * cellW2, width: bWidth * cellW2, top: 7, height: 18,
                                          backgroundColor: dept.color, opacity: isSingle ? 1 : 0.75,
                                        }}>
                                          {isSingle && <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {activeMenu === "cost-analysis" && (
            <div className="space-y-6">
              {loadingCostAnalysis ? (
                <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <span className="ml-3 text-gray-500">原価データを読み込み中...</span>
                </div>
              ) : costAnalysisData ? (
                <>
                  {/* サマリーカード */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* 売上金額 */}
                    <div className="bg-white rounded-lg shadow p-5">
                      <div className="text-sm font-medium text-gray-500 mb-3">売上金額</div>
                      <div className="text-3xl font-bold text-gray-900">
                        {formatCurrency(costAnalysisData.summary.sales_amount)}
                      </div>
                    </div>

                    {/* 原価合計 */}
                    {(() => {
                      // 差額 = 予定 - 実績（マイナス=実績が多い=超過=赤、プラス=実績が少ない=削減=緑）
                      const costDiff = costAnalysisData.summary.total_planned_cost - costAnalysisData.summary.total_actual_cost;
                      const diffColor = costDiff >= 0 ? 'text-green-600' : 'text-red-600';
                      const diffBg = costDiff >= 0 ? 'bg-green-50' : 'bg-red-50';
                      return (
                        <div className="bg-white rounded-lg shadow p-5">
                          <div className="text-sm font-medium text-gray-500 mb-3">原価合計</div>
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-400">予定</div>
                                <div className="text-xl font-bold text-gray-600">
                                  {formatCurrency(costAnalysisData.summary.total_planned_cost)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">実績</div>
                                <div className="text-2xl font-bold text-gray-900">
                                  {formatCurrency(costAnalysisData.summary.total_actual_cost)}
                                </div>
                              </div>
                            </div>
                            <div className={`${diffBg} rounded-lg px-3 py-2 text-right`}>
                              <div className="text-xs text-gray-500">差額</div>
                              <div className={`text-lg font-bold ${diffColor}`}>
                                {costDiff >= 0 ? '+' : ''}{formatCurrency(costDiff)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 利益 */}
                    {(() => {
                      // 差額 = 実績 - 予定（プラス=利益増=緑、マイナス=利益減=赤）
                      const profitDiff = costAnalysisData.summary.actual_profit - costAnalysisData.summary.planned_profit;
                      const diffColor = profitDiff >= 0 ? 'text-green-600' : 'text-red-600';
                      const diffBg = profitDiff >= 0 ? 'bg-green-50' : 'bg-red-50';
                      return (
                        <div className="bg-white rounded-lg shadow p-5">
                          <div className="text-sm font-medium text-gray-500 mb-3">利益</div>
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-400">予定</div>
                                <div className="text-xl font-bold text-gray-600">
                                  {formatCurrency(costAnalysisData.summary.planned_profit)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">実績</div>
                                <div className="text-2xl font-bold text-gray-900">
                                  {formatCurrency(costAnalysisData.summary.actual_profit)}
                                </div>
                              </div>
                            </div>
                            <div className={`${diffBg} rounded-lg px-3 py-2 text-right`}>
                              <div className="text-xs text-gray-500">差額</div>
                              <div className={`text-lg font-bold ${diffColor}`}>
                                {profitDiff >= 0 ? '+' : ''}{formatCurrency(profitDiff)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 利益率（粗利） */}
                    {(() => {
                      const actualRate = costAnalysisData.summary.actual_profit_rate;
                      const plannedRate = costAnalysisData.summary.planned_profit_rate;
                      // 差額 = 実績 - 予定（プラス=利益率増=緑、マイナス=利益率減=赤）
                      const rateDiff = actualRate - plannedRate;
                      // 粗利の色分け: 35%以上=緑、25%～35%未満=青、25%未満=赤
                      const getRateColor = (rate: number) => {
                        if (rate >= 35) return 'text-green-600';
                        if (rate >= 25) return 'text-blue-600';
                        return 'text-red-600';
                      };
                      const getRateBg = (rate: number) => {
                        if (rate >= 35) return 'bg-green-100';
                        if (rate >= 25) return 'bg-blue-100';
                        return 'bg-red-100';
                      };
                      const diffColor = rateDiff >= 0 ? 'text-green-600' : 'text-red-600';
                      const diffBg = rateDiff >= 0 ? 'bg-green-50' : 'bg-red-50';
                      return (
                        <div className="bg-white rounded-lg shadow p-5">
                          <div className="text-sm font-medium text-gray-500 mb-3">利益率</div>
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-400">予定</div>
                                <div className="text-xl font-bold text-gray-600">
                                  {plannedRate}%
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">実績</div>
                                <div className={`text-3xl font-bold ${getRateColor(actualRate)}`}>
                                  <span className={`${getRateBg(actualRate)} px-2 py-1 rounded`}>
                                    {actualRate}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={`${diffBg} rounded-lg px-3 py-2 text-right`}>
                              <div className="text-xs text-gray-500">差</div>
                              <div className={`text-lg font-bold ${diffColor}`}>
                                {rateDiff >= 0 ? '+' : ''}{rateDiff.toFixed(1)}pt
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* AI分析コメント */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">AI総評</h3>
                      </div>
                      <button
                        onClick={fetchAiAnalysis}
                        disabled={loadingAiAnalysis}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          loadingAiAnalysis
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {loadingAiAnalysis ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            分析中...
                          </span>
                        ) : aiAnalysis ? '再分析' : 'AI分析を生成'}
                      </button>
                    </div>
                    {aiAnalysis ? (
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        「AI分析を生成」ボタンをクリックすると、原価データ・顧客要求変更・不具合情報・工程進捗を総合的に分析した総評が表示されます。
                      </p>
                    )}
                  </div>

                  {/* チャートエリア */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 科目別原価比率（円グラフ） */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold mb-4">科目別原価比率</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={costAnalysisData.categories}
                              dataKey="actual_cost"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ payload }) => `${payload.category} ${payload.cost_ratio}%`}
                            >
                              {costAnalysisData.categories.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => formatCurrency(value as number)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 予定vs実績（棒グラフ） */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold mb-4">科目別 予定vs実績</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={costAnalysisData.categories} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`} />
                            <YAxis type="category" dataKey="category" width={80} />
                            <Tooltip formatter={(value) => formatCurrency(value as number)} />
                            <Legend />
                            <Bar dataKey="planned_cost" name="予定" fill="#94a3b8" />
                            <Bar dataKey="actual_cost" name="実績" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 詳細テーブル */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b">
                      <h3 className="text-lg font-semibold">科目別原価明細</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">予定原価</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">実績原価</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">差異</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">原価比率</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {costAnalysisData.categories.map((cat, index) => (
                            <tr key={cat.category} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                  />
                                  {cat.category}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                {formatCurrency(cat.planned_cost)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                {formatCurrency(cat.actual_cost)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${cat.difference > 0 ? 'text-red-600' : cat.difference < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                {cat.difference > 0 ? '+' : ''}{formatCurrency(cat.difference)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                {cat.cost_ratio}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">合計</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                              {formatCurrency(costAnalysisData.summary.total_planned_cost)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                              {formatCurrency(costAnalysisData.summary.total_actual_cost)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${(costAnalysisData.summary.total_actual_cost - costAnalysisData.summary.total_planned_cost) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {(costAnalysisData.summary.total_actual_cost - costAnalysisData.summary.total_planned_cost) > 0 ? '+' : ''}
                              {formatCurrency(costAnalysisData.summary.total_actual_cost - costAnalysisData.summary.total_planned_cost)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  原価データがありません
                </div>
              )}
            </div>
          )}

          {/* 工事詳細情報 */}
          {activeMenu === "construction-detail" && (
            <div className="space-y-4">
              {loadingConstructionSpec ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="ml-3 text-gray-600">工事仕様書を読み込み中...</span>
                </div>
              ) : constructionSpec ? (
                <>
                  {/* 基本情報（常に表示） */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <HardHat className="w-5 h-5" />
                        工事仕様書
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm text-gray-500">受注製番</span>
                          <p className="font-semibold">{constructionSpec.seiban}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">製番名</span>
                          <p className="font-semibold">{constructionSpec.seiban_name || "-"}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">営業担当者</span>
                          <p className="font-semibold">{constructionSpec.sales_person || "-"}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">作成日</span>
                          <p className="font-semibold">{constructionSpec.created_date || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 提出書類セクション（折りたたみ可能） */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => toggleConstructionSection("documents")}
                      className="w-full px-6 py-3 bg-red-50 border-b flex items-center justify-between hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collapsedConstructionSections.has("documents") ? (
                          <ChevronRight className="w-5 h-5 text-red-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-red-600" />
                        )}
                        <h4 className="font-bold text-red-800">提出書類セクション</h4>
                      </div>
                      <span className="text-sm text-red-600">
                        {constructionSpec.documents.safety_documents ? "安全書類あり" : ""}
                      </span>
                    </button>
                    {!collapsedConstructionSections.has("documents") && (
                      <div className="p-6 space-y-4">
                        {constructionSpec.documents.koji_komoku && constructionSpec.documents.koji_komoku.length > 0 && (
                          <div className="border rounded-lg p-4 bg-amber-50/50">
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="text-amber-600">◆</span>
                              工事名称
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {constructionSpec.documents.koji_komoku.map((item, idx) => (
                                <span
                                  key={`${item}-${idx}`}
                                  className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium border border-amber-200"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {constructionSpec.documents.project_name && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <span className="text-sm text-gray-500">工事名称</span>
                            <p className="font-semibold text-amber-800">{constructionSpec.documents.project_name}</p>
                          </div>
                        )}
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3">申請書関連</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">確認申請</span>
                              <p className={`font-medium ${constructionSpec.documents.confirmation_required ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.confirmation_required ? "有" : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">申請図面作成</span>
                              <p className={`font-medium ${constructionSpec.documents.drawing_creation ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.drawing_creation ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">計算書作成</span>
                              <p className={`font-medium ${constructionSpec.documents.calculation_creation ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.calculation_creation ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">消防手続き</span>
                              <p className="font-medium">{constructionSpec.documents.fire_procedure_jurisdiction}</p>
                            </div>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3">ミルシートおよび出荷証明書</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">鋼材</span>
                              <p className={`font-medium ${constructionSpec.documents.steel_required ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.steel_required ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">原反</span>
                              <p className={`font-medium ${constructionSpec.documents.raw_material_required ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.raw_material_required ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">資材</span>
                              <p className={`font-medium ${constructionSpec.documents.material_required ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.material_required ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">メッキ試験報告書</span>
                              <p className={`font-medium ${constructionSpec.documents.plating_test_report_required ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.plating_test_report_required ? "必要" : "不要"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3">製作・施工要領書</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">鉄骨製作要領書</span>
                              <p className={`font-medium ${constructionSpec.documents.steel_frame_manual ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.steel_frame_manual ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">膜製作要領書</span>
                              <p className={`font-medium ${constructionSpec.documents.membrane_manual ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.membrane_manual ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">施工要領書</span>
                              <p className={`font-medium ${constructionSpec.documents.construction_manual ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.construction_manual ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">施工計画書</span>
                              <p className={`font-medium ${constructionSpec.documents.construction_plan ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.construction_plan ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">元請け名</span>
                              <p className="font-medium">{constructionSpec.documents.main_contractor || "-"}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">設計者</span>
                              <p className="font-medium">{constructionSpec.documents.designer || "-"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3">工程写真</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">鉄骨製作工程</span>
                              <p className={`font-medium ${constructionSpec.documents.steel_production_photo ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.steel_production_photo ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">膜製作工程</span>
                              <p className={`font-medium ${constructionSpec.documents.membrane_production_photo ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.membrane_production_photo ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">現場施工工程</span>
                              <p className={`font-medium ${constructionSpec.documents.site_construction_photo ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.documents.site_construction_photo ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">施工者</span>
                              <p className="font-medium">{constructionSpec.documents.constructor || "-"}</p>
                            </div>
                          </div>
                        </div>
                        {constructionSpec.documents.safety_documents && (
                          <div className="border rounded-lg p-4 bg-red-50">
                            <h5 className="font-semibold text-red-700 mb-3">安全書類</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">工事請負</span>
                                <p className="font-medium">{constructionSpec.documents.contract_type}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">請負何次</span>
                                <p className="font-medium">{constructionSpec.documents.subcontract_level}次</p>
                              </div>
                              <div>
                                <span className="text-gray-500">工事種別</span>
                                <p className="font-medium">{constructionSpec.documents.work_category}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">書式</span>
                                <p className="font-medium">{constructionSpec.documents.safety_document_format}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">提出方法</span>
                                <p className="font-medium">{constructionSpec.documents.submission_method}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">提出部数</span>
                                <p className="font-medium">{constructionSpec.documents.submission_count}部</p>
                              </div>
                              <div className="md:col-span-2">
                                <span className="text-gray-500">提出期限</span>
                                <p className="font-semibold text-red-600">{constructionSpec.documents.submission_deadline || "-"}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 工事項目セクション（折りたたみ可能） */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => toggleConstructionSection("construction")}
                      className="w-full px-6 py-3 bg-amber-50 border-b flex items-center justify-between hover:bg-amber-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collapsedConstructionSections.has("construction") ? (
                          <ChevronRight className="w-5 h-5 text-amber-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-amber-600" />
                        )}
                        <h4 className="font-bold text-amber-800">工事項目セクション</h4>
                      </div>
                    </button>
                    {!collapsedConstructionSections.has("construction") && (
                      <div className="p-6 space-y-4">
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            基礎工事
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">所掌</span>
                              <p className={`font-medium ${constructionSpec.foundation.jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                {constructionSpec.foundation.jurisdiction}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">発注状況</span>
                              <p className="font-medium">{constructionSpec.foundation.order_status}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">発注先</span>
                              <p className="font-medium">{constructionSpec.foundation.order_destination || "-"}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">基礎工事種別</span>
                              <p className="font-medium">{constructionSpec.foundation.foundation_type}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">土間工事</span>
                              <p className={`font-medium ${constructionSpec.foundation.floor_work ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.foundation.floor_work ? "有" : "無"}
                              </p>
                            </div>
                          </div>
                          {constructionSpec.foundation.comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">基礎工事コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.foundation.comment}</p>
                            </div>
                          )}
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            アンカー関連
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">アンカーボルト所掌</span>
                              <p className={`font-medium ${constructionSpec.anchor.bolt_jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                {constructionSpec.anchor.bolt_jurisdiction}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">ボルト種別</span>
                              <p className="font-medium">{constructionSpec.anchor.bolt_type}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">テンプレート製作</span>
                              <p className={`font-medium ${constructionSpec.anchor.template_production ? "text-green-600" : "text-gray-400"}`}>
                                {constructionSpec.anchor.template_production ? "有" : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">製作枚数</span>
                              <p className="font-medium">{constructionSpec.anchor.template_count || 0} 枚</p>
                            </div>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            運搬・梱包
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">所掌</span>
                              <p className={`font-medium ${constructionSpec.transportation.jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                {constructionSpec.transportation.jurisdiction}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">10t搬入</span>
                              <p className={`font-medium ${constructionSpec.transportation.ten_ton_available ? "text-green-600" : "text-red-500"}`}>
                                {constructionSpec.transportation.ten_ton_available ? "可" : "不可"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">運搬方法</span>
                              <p className="font-medium">{constructionSpec.transportation.transport_method}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">台数</span>
                              <p className="font-medium">10t: {constructionSpec.transportation.ten_ton_count}台 / 4t: {constructionSpec.transportation.four_ton_count}台</p>
                            </div>
                          </div>
                          {constructionSpec.transportation.comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">運搬コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.transportation.comment}</p>
                            </div>
                          )}
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            現場施工
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">所掌</span>
                              <p className={`font-medium ${constructionSpec.site_construction.jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                {constructionSpec.site_construction.jurisdiction}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">既設建物との取合工事</span>
                              <p className={`font-medium ${constructionSpec.site_construction.existing_building_work ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.site_construction.existing_building_work ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">建て方重機</span>
                              <p className="font-medium">{constructionSpec.site_construction.crane_tonnage}t × {constructionSpec.site_construction.crane_count_per_day}台/日 × {constructionSpec.site_construction.crane_days}日</p>
                            </div>
                            <div>
                              <span className="text-gray-500">作業車種別</span>
                              <p className="font-medium">{constructionSpec.site_construction.work_vehicle_type}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">作業車</span>
                              <p className="font-medium">{constructionSpec.site_construction.work_vehicle_count_per_day}台/日 × {constructionSpec.site_construction.work_vehicle_days}日</p>
                            </div>
                          </div>
                          {constructionSpec.site_construction.crane_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">重機コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_construction.crane_comment}</p>
                            </div>
                          )}
                          {constructionSpec.site_construction.work_vehicle_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">作業車コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_construction.work_vehicle_comment}</p>
                            </div>
                          )}
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            現場環境
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">車両スペース</span>
                              <p className={`font-medium ${constructionSpec.site_environment.vehicle_space ? "text-green-600" : "text-red-500"}`}>
                                {constructionSpec.site_environment.vehicle_space ? "有" : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">重機設置スペース</span>
                              <p className={`font-medium ${constructionSpec.site_environment.heavy_equipment_space ? "text-green-600" : "text-red-500"}`}>
                                {constructionSpec.site_environment.heavy_equipment_space ? "有" : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">障害物</span>
                              <p className={`font-medium ${constructionSpec.site_environment.obstacle ? "text-red-500" : "text-green-600"}`}>
                                {constructionSpec.site_environment.obstacle ? "有" : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">電源貸与</span>
                              <p className={`font-medium ${constructionSpec.site_environment.power_available ? "text-green-600" : "text-red-500"}`}>
                                {constructionSpec.site_environment.power_available ? "可" : "不可"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">地面状況</span>
                              <p className="font-medium">{constructionSpec.site_environment.ground_condition}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">入場教育</span>
                              <p className={`font-medium ${constructionSpec.site_environment.entry_education ? "text-orange-600" : "text-gray-400"}`}>
                                {constructionSpec.site_environment.entry_education ? "必要" : "不要"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">朝礼</span>
                              <p className="font-medium">
                                {constructionSpec.site_environment.morning_meeting ? `有 ${constructionSpec.site_environment.morning_meeting_time || ""}` : "無"}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">土間養生</span>
                              <p className="font-medium">
                                {constructionSpec.site_environment.floor_protection ? `必要 (${constructionSpec.site_environment.floor_protection_area}㎡)` : "不要"}
                              </p>
                            </div>
                          </div>
                          {constructionSpec.site_environment.vehicle_space_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">車両スペースコメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_environment.vehicle_space_comment}</p>
                            </div>
                          )}
                          {constructionSpec.site_environment.obstacle_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">車両スペース障害物コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_environment.obstacle_comment}</p>
                            </div>
                          )}
                          {constructionSpec.site_environment.power_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">電源コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_environment.power_comment}</p>
                            </div>
                          )}
                          {constructionSpec.site_environment.ground_comment && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500 block mb-1">地面状況コメント</span>
                              <p className="font-medium whitespace-pre-wrap">{constructionSpec.site_environment.ground_comment}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4">
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                              電気工事
                            </h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">所掌</span>
                                <p className={`font-medium ${constructionSpec.electrical.jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                  {constructionSpec.electrical.jurisdiction}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">1次工事</span>
                                <p className="font-medium">{constructionSpec.electrical.primary_work}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">2次工事</span>
                                <p className="font-medium">{constructionSpec.electrical.secondary_work}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">照明工事</span>
                                <p className="font-medium">{constructionSpec.electrical.lighting_work}</p>
                              </div>
                            </div>
                            {constructionSpec.electrical.comment && (
                              <div className="mt-3 text-sm">
                                <span className="text-gray-500 block mb-1">電気工事コメント</span>
                                <p className="font-medium whitespace-pre-wrap">{constructionSpec.electrical.comment}</p>
                              </div>
                            )}
                          </div>
                          <div className="border rounded-lg p-4">
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                              消防設備
                            </h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">所掌</span>
                                <p className={`font-medium ${constructionSpec.fire_protection.jurisdiction === "所掌" ? "text-green-600" : "text-gray-600"}`}>
                                  {constructionSpec.fire_protection.jurisdiction}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">発注状況</span>
                                <p className="font-medium">{constructionSpec.fire_protection.order_status}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">発注先</span>
                                <p className="font-medium">{constructionSpec.fire_protection.order_destination || "-"}</p>
                              </div>
                            </div>
                            {constructionSpec.fire_protection.comment && (
                              <div className="mt-3 text-sm">
                                <span className="text-gray-500 block mb-1">消防設備コメント</span>
                                <p className="font-medium whitespace-pre-wrap">{constructionSpec.fire_protection.comment}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            張替
                          </h5>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">張替前膜材</span>
                              <p className="font-medium">{constructionSpec.replacement.previous_membrane || "-"}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">前回張替日</span>
                              <p className="font-medium">{constructionSpec.replacement.previous_replacement_date || "-"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 特記事項・仕様セクション（折りたたみ可能） */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => toggleConstructionSection("special")}
                      className="w-full px-6 py-3 bg-blue-50 border-b flex items-center justify-between hover:bg-blue-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collapsedConstructionSections.has("special") ? (
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        )}
                        <h4 className="font-bold text-blue-800">特記事項・仕様セクション</h4>
                      </div>
                    </button>
                    {!collapsedConstructionSections.has("special") && (
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4">
                            <h5 className="font-semibold text-gray-700 mb-2">製作について</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">メッキ塗装</span>
                                <span className={constructionSpec.special_notes.plating_required ? "text-green-600 font-medium" : "text-gray-400"}>
                                  {constructionSpec.special_notes.plating_required ? "有" : "無"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">膜種類</span>
                                <span className="font-medium">{constructionSpec.special_notes.membrane_type || "-"}</span>
                              </div>
                            </div>
                            {constructionSpec.special_notes.production_notes && (
                              <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                                {constructionSpec.special_notes.production_notes}
                              </div>
                            )}
                          </div>
                          <div className="border rounded-lg p-4">
                            <h5 className="font-semibold text-gray-700 mb-2">その他特記事項</h5>
                            <div className="text-sm text-gray-600">
                              {constructionSpec.special_notes.other_notes || constructionSpec.preparation.items || "特記事項なし"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  工事仕様書データがありません
                </div>
              )}
            </div>
          )}

          {activeMenu === "documents" && (
            <div className="space-y-4">
              {/* OCR処理状態バナー */}
              {ocrProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <div>
                    <p className="text-blue-800 font-medium">工程表OCR処理中...</p>
                    <p className="text-blue-600 text-sm">PDFから日付情報を読み取っています。しばらくお待ちください。</p>
                  </div>
                </div>
              )}
              {ocrResult && (
                <div className={`border rounded-lg p-4 flex items-start gap-3 ${
                  ocrResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <span className="text-lg">{ocrResult.success ? "✅" : "❌"}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${ocrResult.success ? "text-green-800" : "text-red-800"}`}>
                      {ocrResult.success ? "工程管理テーブル更新完了" : "OCR読み取りエラー"}
                    </p>
                    <p className={`text-sm ${ocrResult.success ? "text-green-600" : "text-red-600"}`}>
                      {ocrResult.message}
                    </p>
                  </div>
                  <button onClick={() => setOcrResult(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {ocrConfirm && (
                <>
                  <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOcrConfirm(null)} />
                  <div className="fixed inset-4 md:inset-x-auto md:inset-y-12 md:max-w-2xl md:mx-auto z-50 flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between flex-shrink-0">
                      <h3 className="font-bold text-blue-800">工程表 OCR 読み取り結果</h3>
                      <span className="text-xs text-blue-600">日付を確認・修正してから保存</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-semibold text-gray-700">工程</th>
                            <th className="text-left py-2 px-2 font-semibold text-gray-700">開始日</th>
                            <th className="text-left py-2 px-2 font-semibold text-gray-700">終了日</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(ocrConfirm.dates).map(([process, d]) => (
                            <tr key={process} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium text-gray-800">{process}</td>
                              <td className="py-2 px-2">
                                <input
                                  type="date"
                                  value={d.start || ""}
                                  onChange={(e) => {
                                    setOcrConfirm((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        dates: {
                                          ...prev.dates,
                                          [process]: { ...prev.dates[process], start: e.target.value || null },
                                        },
                                      };
                                    });
                                  }}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="date"
                                  value={d.end || ""}
                                  onChange={(e) => {
                                    setOcrConfirm((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        dates: {
                                          ...prev.dates,
                                          [process]: { ...prev.dates[process], end: e.target.value || null },
                                        },
                                      };
                                    });
                                  }}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2 flex-shrink-0">
                      <button
                        onClick={() => setOcrConfirm(null)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        disabled={ocrSaving}
                        onClick={async () => {
                          setOcrSaving(true);
                          try {
                            const savePayload: Record<string, { start: string | null; end: string | null }> = {};
                            for (const [proc, d] of Object.entries(ocrConfirm.dates)) {
                              savePayload[proc] = { start: d.start, end: d.end };
                            }
                            const res = await fetch("/api/ocr/schedule", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "save", seiban, dates: savePayload }),
                            });
                            const result = await res.json();
                            if (result.success) {
                              setOcrResult({
                                success: true,
                                message: `${result.data.updatedFields} 件の日付を工程管理テーブルに保存しました。`,
                              });
                              // 保存した日付をガンチャートに即時反映するため scheduleData を再取得
                              try {
                                const schedRes = await fetch(`/api/schedule?seiban=${encodeURIComponent(seiban)}`);
                                const schedJson = await schedRes.json();
                                if (schedJson.success && schedJson.data) {
                                  setScheduleData(schedJson.data);
                                }
                              } catch (e) {
                                console.error("Failed to reload schedule after OCR save:", e);
                              }
                            } else {
                              setOcrResult({ success: false, message: result.error });
                            }
                          } catch (err) {
                            setOcrResult({ success: false, message: "保存中にエラーが発生しました" });
                          } finally {
                            setOcrSaving(false);
                            setOcrConfirm(null);
                          }
                        }}
                        className="px-5 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
                      >
                        {ocrSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        工程管理テーブルに保存
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCollapsedDepts(new Set())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  すべて展開
                </button>
                <button
                  onClick={() => setCollapsedDepts(new Set(Object.keys(DOCUMENT_CATEGORIES) as DepartmentName[]))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  すべて閉じる
                </button>
              </div>
              {(Object.keys(DOCUMENT_CATEGORIES) as DepartmentName[]).map((dept) => {
                const isCollapsed = collapsedDepts.has(dept);
                const deptDocs = documents?.[dept];
                const attachmentCount = deptDocs
                  ? Object.values(deptDocs).filter(doc => doc?.file_attachment && doc.file_attachment.length > 0).length
                  : 0;

                return (
                <div key={dept} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={() => toggleDeptCollapse(dept)}
                    className="w-full px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between hover:from-indigo-100 hover:to-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-indigo-600" />
                      )}
                      <h2 className="text-base font-bold text-gray-800">{dept}</h2>
                      {attachmentCount > 0 && (
                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                          {attachmentCount}件
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {isCollapsed ? "クリックで展開" : "クリックで折りたたみ"}
                    </span>
                  </button>
                  {!isCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DOCUMENT_CATEGORIES[dept].map((docType) => {
                      const doc = documents?.[dept]?.[docType];
                      const hasAttachment = doc?.file_attachment && doc.file_attachment.length > 0;
                      return (
                        <div
                          key={docType}
                          className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                            hasAttachment
                              ? "border-green-400 bg-green-50 shadow-sm"
                              : doc
                                ? "border-yellow-300 bg-yellow-50"
                                : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {hasAttachment ? (
                              <ImageIcon className="w-4 h-4 text-green-600" />
                            ) : (
                              <File className="w-4 h-4 text-gray-400" />
                            )}
                            <div className="text-sm font-semibold text-gray-800">{docType}</div>
                          </div>
                          {doc ? (
                            <div className="text-xs text-gray-500 mb-2">
                              更新: {formatDate(doc.updated_at)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 mb-2">未登録</div>
                          )}

                          {/* 添付ファイル一覧（サムネイル表示） */}
                          {hasAttachment && (
                            <div className="space-y-3 mb-3">
                              {doc.file_attachment!.map((file, idx) => {
                                const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name);
                                const isPdf = /\.pdf$/i.test(file.name);
                                const thumbnailUrl = thumbnailUrls[file.file_token];
                                const isLoadingThumb = loadingThumbnails && !thumbnailUrl;

                                return (
                                  <div key={idx} className="w-full bg-white border border-green-300 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => handleViewFile(file.file_token, file.name)}
                                      disabled={loadingFile === file.file_token}
                                      className="w-full hover:bg-green-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                                    >
                                      {/* サムネイル表示エリア */}
                                      <div className="relative w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                                        {isLoadingThumb ? (
                                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                        ) : isImage && thumbnailUrl ? (
                                          <img
                                            src={thumbnailUrl}
                                            alt={file.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            onError={(e) => {
                                              // 画像読み込みエラー時はアイコン表示
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                          />
                                        ) : isPdf && thumbnailUrl ? (
                                          <PdfThumbnail url={thumbnailUrl} className="w-full h-full" />
                                        ) : isPdf ? (
                                          <div className="flex flex-col items-center gap-1 text-red-500">
                                            <FileText className="w-10 h-10" />
                                            <span className="text-xs font-medium">PDF</span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center gap-1 text-gray-400">
                                            <File className="w-10 h-10" />
                                            <span className="text-xs">ファイル</span>
                                          </div>
                                        )}
                                        {/* 画像エラー時のフォールバック */}
                                        {isImage && (
                                          <div className="hidden flex-col items-center gap-1 text-gray-400">
                                            <ImageIcon className="w-10 h-10" />
                                            <span className="text-xs">画像</span>
                                          </div>
                                        )}
                                        {/* ホバー時のオーバーレイ */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                        </div>
                                        {/* ローディング中のオーバーレイ */}
                                        {loadingFile === file.file_token && (
                                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                    {/* ファイル名と操作ボタン */}
                                    <div className="px-2 py-1.5 border-t border-green-200">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-xs text-gray-700 truncate flex-1" title={file.name}>
                                          {file.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenUpload(dept, docType, true, file.file_token);
                                          }}
                                          disabled={uploading && uploadTarget?.targetFileToken === file.file_token}
                                          className="flex-1 text-xs px-2 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        >
                                          {uploading && uploadTarget?.targetFileToken === file.file_token ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <>
                                              <RefreshCw className="w-3 h-3" />
                                              差替
                                            </>
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFile(docType, file.file_token, file.name);
                                          }}
                                          disabled={deleting === file.file_token}
                                          className="flex-1 text-xs px-2 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        >
                                          {deleting === file.file_token ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Trash2 className="w-3 h-3" />
                                              削除
                                            </>
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenHistory(docType);
                                          }}
                                          className="flex-1 text-xs px-2 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors font-medium flex items-center justify-center gap-1"
                                        >
                                          <History className="w-3 h-3" />
                                          履歴
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenUpload(dept, docType, false);
                              }}
                              disabled={uploading && uploadTarget?.dept === dept && uploadTarget?.docType === docType && !uploadTarget?.replace}
                              className="flex-1 text-xs px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            >
                              {uploading && uploadTarget?.dept === dept && uploadTarget?.docType === docType && !uploadTarget?.replace ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  追加中...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  追加
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
              })}

              {/* 隠しファイル入力 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              />

              {/* アップロードモーダル（ドラッグ&ドロップ / クリックでファイル選択） */}
              {uploadTarget && (
                <div
                  className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                  onClick={handleCloseUpload}
                >
                  <div
                    className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                      <h3 className="font-bold text-gray-800 truncate">
                        {uploadTarget.replace ? "ファイルを差し替え" : "ファイルを追加"} - {uploadTarget.docType}
                      </h3>
                      <button
                        onClick={handleCloseUpload}
                        disabled={uploading}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        閉じる
                      </button>
                    </div>
                    <div className="p-6">
                      <div
                        onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                        onDrop={handleDropFile}
                        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl px-6 py-12 text-center transition-colors ${
                          uploading
                            ? "pointer-events-none opacity-70 border-gray-300 bg-gray-50"
                            : dragOver
                              ? "border-green-500 bg-green-50 cursor-pointer"
                              : "border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50/60 cursor-pointer"
                        }`}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                            <p className="text-sm font-medium text-gray-700">アップロード中...</p>
                          </>
                        ) : (
                          <>
                            <UploadCloud className={`w-12 h-12 ${dragOver ? "text-green-600" : "text-gray-400"}`} />
                            <p className="text-sm font-semibold text-gray-700">ここにファイルをドラッグ＆ドロップ</p>
                            <p className="text-xs text-gray-500">またはクリックしてファイルを選択</p>
                          </>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-gray-400 text-center">
                        対応形式: PDF / 画像 / Word / Excel / PowerPoint（上限 {MAX_FILE_SIZE / 1024 / 1024}MB）
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ファイルビューアーモーダル */}
              {viewingFile && (
                <div
                  className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                  onClick={() => setViewingFile(null)}
                >
                  <div
                    className="bg-white rounded-2xl max-w-4xl max-h-[90vh] w-full overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                      <h3 className="font-bold text-gray-800 truncate">{viewingFile.name}</h3>
                      <div className="flex items-center gap-2">
                        <a
                          href={viewingFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          ダウンロード
                        </a>
                        <button
                          onClick={() => setViewingFile(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                    <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100">
                      {viewingFile.type === 'image' ? (
                        <img
                          src={viewingFile.url}
                          alt={viewingFile.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <iframe
                          src={viewingFile.url}
                          className="w-full h-[70vh]"
                          title={viewingFile.name}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 更新履歴モーダル */}
              {historyTarget && (
                <div
                  className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
                  onClick={() => setHistoryTarget(null)}
                >
                  <div
                    className={`bg-white rounded-2xl ${
                      historyFullscreen
                        ? "w-full h-full max-w-none max-h-none rounded-none"
                        : selectedHistoryId
                          ? "max-w-6xl max-h-[95vh]"
                          : "max-w-2xl max-h-[90vh]"
                    } w-full overflow-hidden shadow-2xl transition-all duration-300`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-6 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
                      <div className="flex items-center gap-3">
                        <History className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-gray-800">
                          更新履歴 - {historyTarget.docType}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedHistoryId && (
                          <>
                            {/* ズームコントロール */}
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                              <button
                                onClick={() => setHistoryZoom(Math.max(50, historyZoom - 25))}
                                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded"
                                title="縮小"
                              >
                                −
                              </button>
                              <span className="text-xs text-gray-600 w-10 text-center">{historyZoom}%</span>
                              <button
                                onClick={() => setHistoryZoom(Math.min(200, historyZoom + 25))}
                                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded"
                                title="拡大"
                              >
                                +
                              </button>
                              <button
                                onClick={() => setHistoryZoom(100)}
                                className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                                title="リセット"
                              >
                                リセット
                              </button>
                            </div>
                            {/* フルスクリーンボタン */}
                            <button
                              onClick={() => setHistoryFullscreen(!historyFullscreen)}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                historyFullscreen
                                  ? "bg-purple-600 text-white"
                                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                              }`}
                              title={historyFullscreen ? "通常表示" : "全画面表示"}
                            >
                              {historyFullscreen ? "縮小" : "拡大"}
                            </button>
                            {/* 差分表示ボタン */}
                            <button
                              onClick={() => setShowDiff(!showDiff)}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                showDiff
                                  ? "bg-red-600 text-white"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                              title="変更箇所を赤くハイライト"
                            >
                              {showDiff ? "差分非表示" : "差分表示"}
                            </button>
                            <button
                              onClick={() => { setSelectedHistoryId(null); setHistoryZoom(100); setShowDiff(false); }}
                              className="px-3 py-1.5 text-sm rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                            >
                              一覧に戻る
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setHistoryTarget(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                    <div className={`p-4 overflow-auto ${historyFullscreen ? "h-[calc(100vh-60px)]" : "max-h-[calc(95vh-60px)]"}`}>
                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                        </div>
                      ) : documentHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          更新履歴がありません
                        </div>
                      ) : selectedHistoryId ? (
                        /* 選択した履歴の詳細表示 */
                        (() => {
                          const history = documentHistory.find((h) => h.record_id === selectedHistoryId);
                          if (!history) return null;
                          const beforeFile = history.before_image?.[0];
                          const afterFile = history.after_image?.[0];
                          const beforeUrl = beforeFile?.file_token ? historyImageUrls[beforeFile.file_token] : null;
                          const afterUrl = afterFile?.file_token ? historyImageUrls[afterFile.file_token] : null;
                          const isBeforePdf = beforeFile?.name?.toLowerCase().endsWith('.pdf');
                          const isAfterPdf = afterFile?.name?.toLowerCase().endsWith('.pdf');

                          // 高さ計算（ズームに応じて）
                          const baseHeight = historyFullscreen ? 600 : 400;
                          const zoomedHeight = Math.round(baseHeight * historyZoom / 100);

                          // ファイル表示コンポーネント
                          const FilePreview = ({ url, fileName, isPdf, label }: { url: string | null; fileName?: string; isPdf: boolean; label: string }) => {
                            if (!url) {
                              return (
                                <div
                                  className="w-full bg-gray-100 rounded flex items-center justify-center text-gray-400"
                                  style={{ height: `${zoomedHeight}px` }}
                                >
                                  <div className="text-center">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                                    <span className="text-sm">ファイルなし</span>
                                  </div>
                                </div>
                              );
                            }
                            if (isPdf) {
                              return (
                                <div
                                  className="w-full bg-gray-100 rounded overflow-hidden relative"
                                  style={{ height: `${zoomedHeight}px` }}
                                >
                                  <PdfThumbnail url={url} className="w-full h-full" />
                                  <button
                                    onClick={() => window.open(url, '_blank')}
                                    className="absolute bottom-2 right-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 shadow-lg"
                                  >
                                    PDFを開く
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div
                                className="w-full bg-gray-100 rounded overflow-auto"
                                style={{ height: `${zoomedHeight}px` }}
                              >
                                <img
                                  src={url}
                                  alt={label}
                                  className="cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{
                                    width: `${historyZoom}%`,
                                    maxWidth: 'none',
                                    objectFit: 'contain'
                                  }}
                                  onClick={() => setViewingFile({ url, name: label, type: "image" })}
                                />
                              </div>
                            );
                          };

                          return (
                            <div className="space-y-4">
                              {/* 履歴情報 */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <span
                                    className={`px-2 py-1 text-xs font-bold rounded ${
                                      history.operation_type === "追加"
                                        ? "bg-green-100 text-green-700"
                                        : history.operation_type === "差替"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {history.operation_type}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {new Date(history.operated_at).toLocaleString("ja-JP")}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    操作者: {history.operator}
                                  </span>
                                </div>
                                <div className="text-base font-medium text-gray-800">
                                  {history.file_name}
                                </div>
                                {history.notes && (
                                  <div className="text-sm text-gray-500 mt-1">{history.notes}</div>
                                )}
                              </div>

                              {/* 変更前/変更後の比較 */}
                              <div className={`grid ${showDiff ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
                                {/* 変更前 */}
                                <div className="border rounded-lg overflow-hidden">
                                  <div className="px-3 py-2 bg-red-50 text-red-700 text-sm font-medium flex items-center justify-between">
                                    <span>変更前</span>
                                    {beforeFile?.name && <span className="text-xs text-red-500 truncate ml-2">{beforeFile.name}</span>}
                                  </div>
                                  <div className="p-3 relative">
                                    <FilePreview url={beforeUrl} fileName={beforeFile?.name} isPdf={isBeforePdf || false} label="変更前" />
                                  </div>
                                </div>

                                {/* 差分表示 */}
                                {showDiff && (
                                  <div className="border rounded-lg overflow-hidden border-red-300">
                                    <div className="px-3 py-2 bg-red-100 text-red-800 text-sm font-medium">
                                      差分（変更箇所）
                                    </div>
                                    <div className="p-3">
                                      <ImageDiff
                                        beforeUrl={beforeUrl}
                                        afterUrl={afterUrl}
                                        beforeIsPdf={isBeforePdf || false}
                                        afterIsPdf={isAfterPdf || false}
                                        height={Math.round((historyFullscreen ? 600 : 400) * historyZoom / 100)}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* 変更後 */}
                                <div className="border rounded-lg overflow-hidden">
                                  <div className="px-3 py-2 bg-green-50 text-green-700 text-sm font-medium flex items-center justify-between">
                                    <span>変更後</span>
                                    {afterFile?.name && <span className="text-xs text-green-500 truncate ml-2">{afterFile.name}</span>}
                                  </div>
                                  <div className="p-3 relative">
                                    <FilePreview url={afterUrl} fileName={afterFile?.name} isPdf={isAfterPdf || false} label="変更後" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        /* 履歴一覧 */
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500 mb-3">履歴を選択すると変更前/変更後を確認できます</p>
                          {documentHistory.map((history) => (
                            <button
                              key={history.record_id}
                              onClick={() => setSelectedHistoryId(history.record_id)}
                              className="w-full border rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`px-2 py-1 text-xs font-bold rounded ${
                                    history.operation_type === "追加"
                                      ? "bg-green-100 text-green-700"
                                      : history.operation_type === "差替"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {history.operation_type}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(history.operated_at).toLocaleString("ja-JP")}
                                </span>
                              </div>
                              <div className="text-sm text-gray-800 font-medium truncate">
                                {history.file_name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                操作者: {history.operator}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMenu === "bulk-download" && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* ヘッダー */}
              <div className="px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PackageOpen className="w-6 h-6 text-teal-600" />
                    <h2 className="text-lg font-bold text-gray-800">資料ダウンロード</h2>
                  </div>
                </div>
              </div>

              {!documents ? (
                <div className="px-6 py-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  <span className="ml-3 text-gray-500">資料情報を読み込み中...</span>
                </div>
              ) : (
                <div>
                  {/* 操作バー */}
                  <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleAllSelection}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-teal-600 transition-colors"
                      >
                        {selectableFiles.length > 0 && selectableFiles.every(f => selectedFiles.has(f.key)) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : selectedFiles.size > 0 ? (
                          <MinusSquare className="w-5 h-5 text-teal-500" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                        全選択
                      </button>
                      <span className="text-sm text-gray-500">
                        {selectedFiles.size}件選択中
                      </span>
                    </div>
                    <button
                      onClick={handleBulkDownload}
                      disabled={selectedFiles.size === 0 || downloadingZip}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingZip ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {downloadProgress.current}/{downloadProgress.total}件処理中...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          ZIPダウンロード
                        </>
                      )}
                    </button>
                  </div>

                  {/* プログレスバー */}
                  {downloadingZip && (
                    <div className="px-4 py-2 bg-teal-50">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 部署別リスト */}
                  <div className="divide-y">
                    {(Object.keys(DOCUMENT_CATEGORIES) as DepartmentName[]).map((dept) => {
                      const deptFiles = selectableFiles.filter(f => f.dept === dept);
                      const deptSelectedCount = deptFiles.filter(f => selectedFiles.has(f.key)).length;
                      const isCollapsed = bulkDownloadCollapsedDepts.has(dept);
                      const allDeptSelected = deptFiles.length > 0 && deptFiles.every(f => selectedFiles.has(f.key));

                      return (
                        <div key={dept}>
                          {/* 部署ヘッダー */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                            {deptFiles.length > 0 ? (
                              <button
                                onClick={() => toggleDeptSelection(dept)}
                                className="flex-shrink-0"
                              >
                                {allDeptSelected ? (
                                  <CheckSquare className="w-5 h-5 text-teal-600" />
                                ) : deptSelectedCount > 0 ? (
                                  <MinusSquare className="w-5 h-5 text-teal-500" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            ) : (
                              <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                            )}
                            <button
                              onClick={() => toggleBulkDownloadDeptCollapse(dept)}
                              className="flex-1 flex items-center gap-2 text-left"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="font-bold text-gray-800">{dept}</span>
                              <span className="text-xs text-gray-500">
                                ({deptSelectedCount}/{deptFiles.length})
                              </span>
                            </button>
                          </div>

                          {/* 書類リスト */}
                          {!isCollapsed && (
                            <div className="divide-y divide-gray-100">
                              {DOCUMENT_CATEGORIES[dept].map((docType) => {
                                const doc = documents?.[dept]?.[docType];
                                const hasAttachment = doc?.file_attachment && doc.file_attachment.length > 0;

                                if (!hasAttachment) {
                                  return (
                                    <div key={docType} className="flex items-center gap-3 px-4 py-2 pl-12 text-gray-400">
                                      <Square className="w-4 h-4 text-gray-300" />
                                      <span className="text-sm">{docType}</span>
                                      <span className="text-xs ml-auto">(未登録)</span>
                                    </div>
                                  );
                                }

                                return doc.file_attachment!.map((file) => {
                                  const key = `${dept}/${docType}/${file.file_token}`;
                                  const isSelected = selectedFiles.has(key);

                                  return (
                                    <button
                                      key={key}
                                      onClick={() => toggleFileSelection(key)}
                                      className={`w-full flex items-center gap-3 px-4 py-2 pl-12 text-left hover:bg-teal-50 transition-colors ${
                                        isSelected ? "bg-teal-50" : ""
                                      }`}
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" />
                                      ) : (
                                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      )}
                                      <span className="text-sm font-medium text-gray-700 min-w-[120px]">{docType}</span>
                                      <span className="text-sm text-gray-500 truncate flex-1">{file.name}</span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                                    </button>
                                  );
                                });
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
