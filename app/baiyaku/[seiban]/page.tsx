"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
} from "lucide-react";
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

interface PageProps {
  params: { seiban: string };
}

export default function BaiyakuDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const seiban = decodeURIComponent(params.seiban);

  const [baiyaku, setBaiyaku] = useState<BaiyakuInfo | null>(null);
  const [baiyakuDetail, setBaiyakuDetail] = useState<BaiyakuDetail | null>(null);
  const [loadingBaiyakuDetail, setLoadingBaiyakuDetail] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuItemType>("baiyaku-detail");
  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [documents, setDocuments] = useState<Record<DepartmentName, Record<string, ProjectDocument | null>> | null>(null);
  const [ganttData, setGanttData] = useState<GanttChartData | null>(null);
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
  const [deleting, setDeleting] = useState<string | null>(null); // 削除中のファイルトークン
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ docType: string } | null>(null); // 履歴表示対象
  const [documentHistory, setDocumentHistory] = useState<DocumentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null); // 選択中の履歴
  const [historyImageUrls, setHistoryImageUrls] = useState<Record<string, string>>({}); // 履歴画像のURL
  const [historyFullscreen, setHistoryFullscreen] = useState(false); // フルスクリーンモード
  const [historyZoom, setHistoryZoom] = useState(100); // ズームレベル（%）
  const [showDiff, setShowDiff] = useState(false); // 差分表示モード
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
    fileName: string
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
          operator: session?.user?.name || session?.user?.email || "不明",
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

  // ファイルアップロードダイアログを開く
  const handleOpenUpload = (dept: DepartmentName, docType: string, replace: boolean = false, targetFileToken?: string) => {
    setUploadTarget({ dept, docType, replace, targetFileToken });
    fileInputRef.current?.click();
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

  // ファイル選択時の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("seiban", seiban);
      formData.append("department", uploadTarget.dept);
      formData.append("documentType", uploadTarget.docType);
      formData.append("replace", uploadTarget.replace ? "true" : "false");
      if (uploadTarget.targetFileToken) {
        formData.append("targetFileToken", uploadTarget.targetFileToken);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // 履歴を記録
        const operationType: OperationType = uploadTarget.replace ? "差替" : "追加";
        await recordHistory(uploadTarget.docType, operationType, file.name);
        alert(`「${file.name}」をアップロードしました`);
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
      alert("アップロード中にエラーが発生しました");
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
      const fileType = fileName.toLowerCase();
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileType);

      if (isImage) {
        // 画像はモーダルで表示
        setViewingFile({ url: fileUrl, name: fileName, type: 'image' });
      } else {
        // PDFやその他のファイルは新しいタブで開く（ダウンロードリンクなのでiframeでは表示できない）
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
        } else if (activeMenu === "documents") {
          const response = await fetch(`/api/documents?seiban=${encodeURIComponent(seiban)}`);
          const data = await response.json();
          console.log("[documents] API response:", data.success, "data keys:", data.data ? Object.keys(data.data) : "null");
          if (data.success) {
            setDocuments(data.data);
          }
        } else if (activeMenu === "gantt-chart") {
          const response = await fetch(`/api/gantt?seiban=${encodeURIComponent(seiban)}`);
          const data = await response.json();
          if (data.success) {
            setGanttData(data.data);
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

  const menuItems: { id: MenuItemType; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
    { id: "baiyaku-detail", label: "売約詳細情報", icon: <ClipboardList className="w-5 h-5" />, color: "text-indigo-500", activeColor: "text-indigo-600" },
    { id: "construction-detail", label: "工事詳細情報", icon: <HardHat className="w-5 h-5" />, color: "text-amber-500", activeColor: "text-amber-600" },
    { id: "customer-requests", label: "顧客要求事項変更履歴", icon: <FileText className="w-5 h-5" />, color: "text-blue-500", activeColor: "text-blue-600" },
    { id: "quality-issues", label: "不具合情報", icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-500", activeColor: "text-orange-600" },
    { id: "gantt-chart", label: "ガントチャート", icon: <Calendar className="w-5 h-5" />, color: "text-emerald-500", activeColor: "text-emerald-600" },
    { id: "cost-analysis", label: "原価分析", icon: <TrendingUp className="w-5 h-5" />, color: "text-cyan-500", activeColor: "text-cyan-600" },
    { id: "documents", label: "関連資料", icon: <FolderOpen className="w-5 h-5" />, color: "text-purple-500", activeColor: "text-purple-600" },
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
        setAiAnalysis("AI分析の生成に失敗しました: " + (data.error || "不明なエラー"));
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
                  <p className="text-xs text-white/70">Sub System</p>
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
        <div className="w-full px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* メニューボタン */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push("/baiyaku/kensaku")}
                className="flex items-center gap-1.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all duration-200 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium">検索に戻る</span>
              </button>
            </div>
            {baiyaku && (
              <div className="flex-1 flex items-center justify-center gap-6 mx-4">
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
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-xs">受注日:</span>
                  <span className="text-white text-sm">{formatDate(baiyaku.juchu_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-xs">金額:</span>
                  <span className="text-white text-sm">{formatCurrency(baiyaku.juchu_kingaku)}</span>
                </div>
                {baiyaku.tantousha && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs">担当:</span>
                    <span className="text-white text-sm font-medium">{baiyaku.tantousha}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="flex items-center gap-1.5 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{session.user.name || session.user.email}</span>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 font-medium"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-4 px-2 py-3 w-full overflow-hidden">
        {/* サイドメニュー（固定・左寄せ） */}
        <aside className="w-52 flex-shrink-0 overflow-y-auto">
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
        <main className="flex-1 overflow-y-auto">
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

          {activeMenu === "gantt-chart" && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">ガントチャート</h2>
              </div>
              {ganttData ? (
                <div className="p-6">
                  {/* 凡例 */}
                  <div className="flex flex-wrap gap-4 mb-6">
                    {ganttData.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: task.color }}
                        />
                        <span className="text-sm text-gray-600">{task.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* タイムライン */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* 月表示 */}
                      <div className="flex border-b pb-2 mb-4">
                        {(() => {
                          const months: string[] = [];
                          const start = new Date(ganttData.start_date);
                          const end = new Date(ganttData.end_date);
                          const current = new Date(start.getFullYear(), start.getMonth(), 1);
                          while (current <= end) {
                            months.push(`${current.getFullYear()}/${current.getMonth() + 1}`);
                            current.setMonth(current.getMonth() + 1);
                          }
                          return months.map((month, i) => (
                            <div key={i} className="flex-1 text-center text-xs text-gray-500">
                              {month}
                            </div>
                          ));
                        })()}
                      </div>

                      {/* タスクバー */}
                      <div className="space-y-3">
                        {ganttData.tasks.map((task) => {
                          const totalDuration = ganttData.end_date - ganttData.start_date;
                          const taskStart = task.start_date - ganttData.start_date;
                          const taskDuration = task.end_date - task.start_date;
                          const leftPercent = (taskStart / totalDuration) * 100;
                          const widthPercent = (taskDuration / totalDuration) * 100;

                          return (
                            <div key={task.id} className="flex items-center gap-4">
                              <div className="w-24 flex-shrink-0">
                                <div className="text-sm font-medium text-gray-700">{task.name}</div>
                                <div className="text-xs text-gray-500">{task.department}</div>
                              </div>
                              <div className="flex-1 relative h-8 bg-gray-100 rounded">
                                <div
                                  className="absolute h-full rounded-l overflow-hidden"
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    backgroundColor: task.color,
                                  }}
                                >
                                  {/* 進捗バー */}
                                  <div
                                    className="h-full bg-black/20"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                                    {task.progress}%
                                  </div>
                                </div>
                              </div>
                              <div className="w-32 flex-shrink-0 text-xs text-gray-500">
                                {formatDate(task.start_date)} - {formatDate(task.end_date)}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 今日の線 */}
                      {(() => {
                        const now = Date.now();
                        if (now >= ganttData.start_date && now <= ganttData.end_date) {
                          const totalDuration = ganttData.end_date - ganttData.start_date;
                          const todayPosition = ((now - ganttData.start_date) / totalDuration) * 100;
                          return (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                              style={{ left: `calc(${todayPosition}% + 7rem)` }}
                            >
                              <div className="absolute -top-6 -left-3 text-xs text-red-500 font-medium">
                                今日
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* サマリー */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-gray-500">プロジェクト開始</div>
                        <div className="text-sm font-medium">{formatDate(ganttData.start_date)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">プロジェクト終了</div>
                        <div className="text-sm font-medium">{formatDate(ganttData.end_date)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">総工程数</div>
                        <div className="text-sm font-medium">{ganttData.tasks.length}工程</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-gray-500">
                  データを読み込み中...
                </div>
              )}
            </div>
          )}

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
                        {constructionSpec.documents.main_contractor && (
                          <div className="border rounded-lg p-4">
                            <h5 className="font-semibold text-gray-700 mb-3">元請け情報</h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">元請け名</span>
                                <p className="font-medium">{constructionSpec.documents.main_contractor}</p>
                              </div>
                              {constructionSpec.documents.designer && (
                                <div>
                                  <span className="text-gray-500">設計者</span>
                                  <p className="font-medium">{constructionSpec.documents.designer}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
        </main>
      </div>
    </div>
  );
}
