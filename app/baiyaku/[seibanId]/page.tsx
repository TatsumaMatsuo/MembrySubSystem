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
} from "lucide-react";
import { Sidebar } from "@/components/layout";
import type {
  BaiyakuInfo,
  CustomerRequest,
  QualityIssue,
  ProjectDocument,
  MenuItemType,
  DepartmentName,
  GanttChartData,
  DocumentHistory,
  OperationType,
} from "@/types";
import { DOCUMENT_CATEGORIES } from "@/lib/lark-tables";
import PdfThumbnail from "@/components/PdfThumbnail";
import { ImageDiff } from "@/components/ImageDiff";

interface PageProps {
  params: { seibanId: string };
}

export default function BaiyakuDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const seiban = decodeURIComponent(params.seibanId);

  const [baiyaku, setBaiyaku] = useState<BaiyakuInfo | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuItemType>("customer-requests");
  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [documents, setDocuments] = useState<Record<DepartmentName, Record<string, ProjectDocument | null>> | null>(null);
  const [ganttData, setGanttData] = useState<GanttChartData | null>(null);
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

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
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
    { id: "customer-requests", label: "顧客要求事項変更履歴", icon: <FileText className="w-5 h-5" />, color: "text-blue-500", activeColor: "text-blue-600" },
    { id: "quality-issues", label: "不具合情報", icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-500", activeColor: "text-orange-600" },
    { id: "gantt-chart", label: "ガントチャート", icon: <Calendar className="w-5 h-5" />, color: "text-emerald-500", activeColor: "text-emerald-600" },
    { id: "documents", label: "関連資料", icon: <FolderOpen className="w-5 h-5" />, color: "text-purple-500", activeColor: "text-purple-600" },
  ];

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
                onClick={() => router.push("/")}
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
          {activeMenu === "customer-requests" && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">顧客要求事項変更履歴</h2>
              </div>
              <div className="divide-y">
                {customerRequests.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    データがありません
                  </div>
                ) : (
                  customerRequests.map((item) => (
                    <div key={item.record_id} className="px-6 py-4">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm text-gray-500">
                          {formatDate(item.shinsei_date)}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {item.youkyuu_kubun}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {item.honbun}
                      </p>
                    </div>
                  ))
                )}
              </div>
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
