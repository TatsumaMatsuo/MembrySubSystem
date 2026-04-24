"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter, useParams } from "next/navigation";
import { ApplicationOverview, VehicleRegistration, InsurancePolicy, DriversLicense } from "@/types/syaryo";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Car,
  Shield,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
} from "lucide-react";
import { useToast, ToastContainer } from "@/components/features/syaryo/ui/toast";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { PDFViewer } from "@/components/features/syaryo/ui/pdf-viewer";

type DocumentCategory = "license" | "vehicle" | "insurance";

// 選択中のドキュメント
interface SelectedDocument {
  category: DocumentCategory;
  index: number; // vehicles/insurances の場合のインデックス
}

// ファイル拡張子からPDFかどうかを判定（後方互換性のため残す）
function isPdfFileByExtension(filename: string | undefined): boolean {
  if (!filename) return false;
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'pdf';
}

// image_attachmentからファイルURLを取得
function getAttachmentUrl(attachment: any): string | null {
  if (!attachment) return null;
  // 配列の場合は最初の要素を使用
  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  // API経由でダウンロード（Lark URLは認証が必要なため直接使用不可）
  if (att?.file_token) {
    // Lark Base から取得したダウンロードURLをクエリパラメータとして渡す
    const baseUrl = `/api/syaryo/attachments/${att.file_token}`;
    if (att.url) {
      return `${baseUrl}?url=${encodeURIComponent(att.url)}`;
    }
    return baseUrl;
  }
  return null;
}

// image_attachmentからファイル名を取得（PDF判定用）
function getAttachmentFilename(attachment: any): string | null {
  if (!attachment) return null;
  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  return att?.name || null;
}

// image_attachmentからファイルタイプを取得
function getAttachmentType(attachment: any): string | null {
  if (!attachment) return null;
  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  return att?.type || null;
}

// 添付ファイルがPDFかどうかを判定
function isAttachmentPdf(attachment: any): boolean {
  const type = getAttachmentType(attachment);
  if (type && type.includes('pdf')) return true;
  const filename = getAttachmentFilename(attachment);
  return isPdfFileByExtension(filename || undefined);
}

export default function ApplicationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const employeeId = params.employeeId as string;

  const [application, setApplication] = useState<ApplicationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SelectedDocument>({ category: "license", index: 0 });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ category: DocumentCategory; index: number } | "all">("all");
  const [processing, setProcessing] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);
  const [fileContentType, setFileContentType] = useState<string | null>(null);

  // 画像回転
  const rotateImage = (degrees: number) => {
    setImageRotation((prev) => (prev + degrees + 360) % 360);
  };

  // ドキュメント切り替え時に回転をリセットし、ファイルタイプを検出
  useEffect(() => {
    setImageRotation(0);
    setFileContentType(null);

    // 現在のドキュメントのimage_attachmentからURLを取得
    const getImageUrl = () => {
      if (!application) return null;
      switch (selectedDoc.category) {
        case "license":
          return getAttachmentUrl(application.license?.image_attachment);
        case "vehicle":
          return getAttachmentUrl(application.vehicles[selectedDoc.index]?.image_attachment);
        case "insurance":
          return getAttachmentUrl(application.insurances[selectedDoc.index]?.image_attachment);
      }
    };

    const imageUrl = getImageUrl();
    if (imageUrl) {
      // HEADリクエストでContent-Typeを取得
      fetch(imageUrl, { method: 'HEAD' })
        .then(response => {
          const contentType = response.headers.get('Content-Type');
          setFileContentType(contentType);
        })
        .catch(err => {
          console.error('Failed to detect file type:', err);
          setFileContentType(null);
        });
    }
  }, [selectedDoc, application]);

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // 申請データの取得
  useEffect(() => {
    if (!employeeId) return;

    const fetchApplication = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/syaryo/applications/overview?employeeId=${employeeId}`
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          setApplication(data.data[0]);
          // 初期選択: 免許証があれば免許証、なければ最初の車検証、それもなければ最初の保険証
          const app = data.data[0] as ApplicationOverview;
          if (app.license) {
            setSelectedDoc({ category: "license", index: 0 });
          } else if (app.vehicles.length > 0) {
            setSelectedDoc({ category: "vehicle", index: 0 });
          } else if (app.insurances.length > 0) {
            setSelectedDoc({ category: "insurance", index: 0 });
          }
        } else {
          setError("申請が見つかりませんでした");
        }
      } catch (error) {
        console.error("Failed to fetch application:", error);
        setError("申請の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [employeeId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            承認済み
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            審査中
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            却下
          </span>
        );
      default:
        return null;
    }
  };

  // 現在選択中のドキュメントを取得
  const getCurrentDocument = (): DriversLicense | VehicleRegistration | InsurancePolicy | null => {
    if (!application) return null;
    switch (selectedDoc.category) {
      case "license":
        return application.license;
      case "vehicle":
        return application.vehicles[selectedDoc.index] || null;
      case "insurance":
        return application.insurances[selectedDoc.index] || null;
    }
  };

  // 現在のドキュメントのIDを取得
  const getCurrentDocumentId = (): string | null => {
    const doc = getCurrentDocument();
    return doc?.id || null;
  };

  // 現在のドキュメントの承認状態
  const getCurrentApprovalStatus = (): string | null => {
    const doc = getCurrentDocument();
    return doc?.approval_status || null;
  };

  // 個別承認
  const handleApproveDocument = async () => {
    if (!application) return;
    const docId = getCurrentDocumentId();
    if (!docId) return;

    const docName = getDocumentTitle();
    if (!confirm(`${docName}を承認しますか？`)) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/syaryo/approvals/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedDoc.category }),
      });

      if (response.ok) {
        toast.success(`${docName}を承認しました`);
        // データを再取得して画面を更新
        const refreshResponse = await fetch(
          `/api/syaryo/applications/overview?employeeId=${employeeId}`
        );
        const refreshData = await refreshResponse.json();
        if (refreshData.success && refreshData.data?.[0]) {
          setApplication(refreshData.data[0]);
        }
      } else {
        throw new Error("Approval failed");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("承認に失敗しました。もう一度お試しください。");
    } finally {
      setProcessing(false);
    }
  };

  // pending状態のドキュメントを全て取得
  const getPendingDocuments = () => {
    if (!application) return [];
    const pending: { category: DocumentCategory; index: number; id: string }[] = [];

    if (application.license?.approval_status === "pending") {
      pending.push({ category: "license", index: 0, id: application.license.id });
    }
    application.vehicles.forEach((v, i) => {
      if (v.approval_status === "pending") {
        pending.push({ category: "vehicle", index: i, id: v.id });
      }
    });
    application.insurances.forEach((ins, i) => {
      if (ins.approval_status === "pending") {
        pending.push({ category: "insurance", index: i, id: ins.id });
      }
    });
    return pending;
  };

  // 一括承認
  const handleApproveAll = async () => {
    if (!application) return;
    const pendingDocs = getPendingDocuments();
    if (pendingDocs.length === 0) return;

    if (!confirm(`すべての審査中書類（${pendingDocs.length}件）を承認しますか？`)) return;

    setProcessing(true);
    try {
      const results = await Promise.all(
        pendingDocs.map(doc =>
          fetch(`/api/syaryo/approvals/${doc.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: doc.category }),
          })
        )
      );

      const allSuccess = results.every((r) => r.ok);
      if (allSuccess) {
        toast.success(`${application.employee.employee_name}さんのすべての審査中書類を承認しました`);
        router.push("/soumu/syaryo/admin/applications");
      } else {
        throw new Error("Some approvals failed");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("承認に失敗しました。もう一度お試しください。");
    } finally {
      setProcessing(false);
    }
  };

  // 個別却下
  const handleRejectDocument = () => {
    setRejectTarget({ category: selectedDoc.category, index: selectedDoc.index });
    setShowRejectModal(true);
  };

  // 一括却下
  const handleRejectAll = () => {
    setRejectTarget("all");
    setShowRejectModal(true);
  };

  // 承認状態のサマリーを取得
  const getApprovalSummary = () => {
    if (!application) return { approved: 0, rejected: 0, pending: 0, total: 0 };

    const docs: string[] = [];
    if (application.license) docs.push(application.license.approval_status);
    application.vehicles.forEach(v => docs.push(v.approval_status));
    application.insurances.forEach(i => docs.push(i.approval_status));

    return {
      approved: docs.filter(s => s === "approved").length,
      rejected: docs.filter(s => s === "rejected").length,
      pending: docs.filter(s => s === "pending").length,
      total: docs.length
    };
  };

  const getDocumentTitle = () => {
    if (!application) return "";
    switch (selectedDoc.category) {
      case "license":
        return "運転免許証";
      case "vehicle":
        const vIndex = selectedDoc.index;
        const vehicle = application.vehicles[vIndex];
        return vehicle ? `車検証 (${vehicle.vehicle_number})` : `車検証 #${vIndex + 1}`;
      case "insurance":
        const iIndex = selectedDoc.index;
        const insurance = application.insurances[iIndex];
        return insurance ? `任意保険証 (${insurance.policy_number})` : `任意保険証 #${iIndex + 1}`;
    }
  };

  const getDocumentIcon = () => {
    switch (selectedDoc.category) {
      case "license":
        return <FileText className="h-5 w-5 text-blue-600" />;
      case "vehicle":
        return <Car className="h-5 w-5 text-green-600" />;
      case "insurance":
        return <Shield className="h-5 w-5 text-purple-600" />;
    }
  };

  // PDFかどうかを判定（Content-Typeベース）
  const isPdfFile = () => {
    if (fileContentType) {
      return fileContentType.includes('application/pdf');
    }
    // Content-Typeが取得できない場合は拡張子で判定（後方互換性）
    const currentDoc = getCurrentDocument();
    const filename = getAttachmentFilename(currentDoc?.image_attachment);
    return isPdfFileByExtension(filename || undefined);
  };

  // 現在のドキュメントのファイルURLを取得
  const getCurrentFileUrl = () => {
    const currentDoc = getCurrentDocument();
    return getAttachmentUrl(currentDoc?.image_attachment);
  };

  // 免許証裏面のファイルURLを取得
  const getLicenseBackFileUrl = () => {
    if (!application?.license) return null;
    return getAttachmentUrl(application.license.image_attachment_ura);
  };

  // ローディング中
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // セッションがない場合は何も表示しない（リダイレクト中）
  if (!session || !session.user) {
    return null;
  }

  // エラー表示
  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error || "申請が見つかりませんでした"}</p>
          <button
            onClick={() => router.push("/soumu/syaryo/admin/applications")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            申請一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const currentDoc = getCurrentDocument();
  const summary = getApprovalSummary();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/soumu/syaryo/admin/applications")}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {application.employee.employee_name}さんの申請
                </h1>
                <p className="text-sm text-gray-600">
                  社員ID: {application.employee.employee_id} | {application.employee.department}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* 承認サマリー */}
              <div className="text-sm text-gray-600">
                {(() => {
                  if (summary.total === 0) {
                    return (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800">
                        書類なし
                      </span>
                    );
                  }
                  if (summary.approved === summary.total) {
                    return (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        全て承認済み ({summary.total}件)
                      </span>
                    );
                  } else if (summary.rejected > 0) {
                    return (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800">
                        <XCircle className="w-4 h-4 mr-1" />
                        {summary.rejected}件却下
                      </span>
                    );
                  } else if (summary.approved > 0) {
                    return (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="w-4 h-4 mr-1" />
                        部分承認 ({summary.approved}/{summary.total}件)
                      </span>
                    );
                  } else {
                    return (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800">
                        <Clock className="w-4 h-4 mr-1" />
                        審査中 ({summary.pending}件)
                      </span>
                    );
                  }
                })()}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleApproveAll}
                  disabled={processing || summary.pending === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  すべて承認
                </button>
                <button
                  onClick={handleRejectAll}
                  disabled={processing || summary.pending === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  すべて却下
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ: 2分割レイアウト */}
      <div className="flex h-[calc(100vh-88px)]">
        {/* 左パネル: 申請内容 */}
        <div className="w-1/2 bg-white border-r overflow-y-auto">
          <div className="p-6">
            {/* ドキュメントリスト */}
            <div className="space-y-4 mb-6">
              {/* 免許証セクション */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1 text-blue-600" />
                  運転免許証（1件まで）
                </h3>
                {application.license ? (
                  <button
                    onClick={() => setSelectedDoc({ category: "license", index: 0 })}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedDoc.category === "license"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{application.license.license_number}</span>
                      {getStatusBadge(application.license.approval_status)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      有効期限: {new Date(application.license.expiration_date).toLocaleDateString()}
                    </p>
                  </button>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
                    未登録
                  </div>
                )}
              </div>

              {/* 車検証セクション */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Car className="w-4 h-4 mr-1 text-green-600" />
                  車検証（{application.vehicles.length}件）
                </h3>
                {application.vehicles.length > 0 ? (
                  <div className="space-y-2">
                    {application.vehicles.map((vehicle, index) => (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedDoc({ category: "vehicle", index })}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          selectedDoc.category === "vehicle" && selectedDoc.index === index
                            ? "border-green-600 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{vehicle.vehicle_number}</span>
                          {getStatusBadge(vehicle.approval_status)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {vehicle.manufacturer} {vehicle.model_name} |
                          車検期限: {new Date(vehicle.inspection_expiration_date).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
                    未登録
                  </div>
                )}
              </div>

              {/* 任意保険証セクション */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Shield className="w-4 h-4 mr-1 text-purple-600" />
                  任意保険証（{application.insurances.length}件）
                </h3>
                {application.insurances.length > 0 ? (
                  <div className="space-y-2">
                    {application.insurances.map((insurance, index) => (
                      <button
                        key={insurance.id}
                        onClick={() => setSelectedDoc({ category: "insurance", index })}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          selectedDoc.category === "insurance" && selectedDoc.index === index
                            ? "border-purple-600 bg-purple-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{insurance.policy_number}</span>
                          {getStatusBadge(insurance.approval_status)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {insurance.insurance_company} |
                          保険期限: {new Date(insurance.coverage_end_date).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
                    未登録
                  </div>
                )}
              </div>
            </div>

            {/* 選択中のドキュメント詳細 */}
            {currentDoc && (
              <div className="border-t pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  {getDocumentIcon()}
                  <h2 className="text-xl font-bold text-gray-900">{getDocumentTitle()}</h2>
                </div>

                {/* 免許証の情報 */}
                {selectedDoc.category === "license" && application.license && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">基本情報</h3>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">免許証番号</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {application.license.license_number}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">有効期限</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {new Date(application.license.expiration_date).toLocaleDateString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">承認状態</dt>
                          <dd>{getStatusBadge(application.license.approval_status)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* 車検証の情報 */}
                {selectedDoc.category === "vehicle" && application.vehicles[selectedDoc.index] && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">基本情報</h3>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">車両番号</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {application.vehicles[selectedDoc.index].vehicle_number}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">メーカー・車種</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {application.vehicles[selectedDoc.index].manufacturer} {application.vehicles[selectedDoc.index].model_name}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">車検期限</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {new Date(application.vehicles[selectedDoc.index].inspection_expiration_date).toLocaleDateString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">承認状態</dt>
                          <dd>{getStatusBadge(application.vehicles[selectedDoc.index].approval_status)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* 任意保険の情報 */}
                {selectedDoc.category === "insurance" && application.insurances[selectedDoc.index] && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">基本情報</h3>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">証券番号</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {application.insurances[selectedDoc.index].policy_number}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">保険会社</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {application.insurances[selectedDoc.index].insurance_company}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">保険期限</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {new Date(application.insurances[selectedDoc.index].coverage_end_date).toLocaleDateString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-600">承認状態</dt>
                          <dd>{getStatusBadge(application.insurances[selectedDoc.index].approval_status)}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* 補償内容 */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h3 className="text-sm font-medium text-purple-800 mb-3">補償内容（会社規定）</h3>
                      <dl className="space-y-2">
                        <div className="flex justify-between items-center">
                          <dt className="text-sm text-purple-700">対人補償</dt>
                          <dd>
                            {application.insurances[selectedDoc.index].liability_personal_unlimited ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                無制限
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                条件未達
                              </span>
                            )}
                          </dd>
                        </div>
                        <div className="flex justify-between items-center">
                          <dt className="text-sm text-purple-700">対物補償</dt>
                          <dd>
                            {(application.insurances[selectedDoc.index].liability_property_amount || 0) >= 5000 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {(application.insurances[selectedDoc.index].liability_property_amount || 0).toLocaleString()}万円
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                {(application.insurances[selectedDoc.index].liability_property_amount || 0).toLocaleString()}万円（5,000万円以上必要）
                              </span>
                            )}
                          </dd>
                        </div>
                        <div className="flex justify-between items-center">
                          <dt className="text-sm text-purple-700">搭乗者傷害</dt>
                          <dd>
                            {(application.insurances[selectedDoc.index].passenger_injury_amount || 0) >= 2000 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {(application.insurances[selectedDoc.index].passenger_injury_amount || 0).toLocaleString()}万円
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                {(application.insurances[selectedDoc.index].passenger_injury_amount || 0).toLocaleString()}万円（2,000万円以上必要）
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      {/* 会社規定を満たしているかの判定 */}
                      {(() => {
                        const ins = application.insurances[selectedDoc.index];
                        const meetsRequirements =
                          ins.liability_personal_unlimited &&
                          (ins.liability_property_amount || 0) >= 5000 &&
                          (ins.passenger_injury_amount || 0) >= 2000;
                        return meetsRequirements ? (
                          <div className="mt-3 p-2 bg-green-100 rounded text-center">
                            <span className="text-green-800 text-sm font-medium">
                              ✓ 会社規定を満たしています（許可証発行可能）
                            </span>
                          </div>
                        ) : (
                          <div className="mt-3 p-2 bg-red-100 rounded text-center">
                            <span className="text-red-800 text-sm font-medium">
                              ✗ 会社規定を満たしていません（許可証発行不可）
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 操作ボタン */}
                <div className="pt-4 border-t space-y-2 mt-4">
                  {(() => {
                    const currentStatus = getCurrentApprovalStatus();

                    if (currentStatus === "approved") {
                      return (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                          <CheckCircle className="inline h-6 w-6 text-green-600 mb-2" />
                          <p className="text-green-800 font-medium">この書類は承認済みです</p>
                        </div>
                      );
                    } else if (currentStatus === "rejected") {
                      return (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                          <XCircle className="inline h-6 w-6 text-red-600 mb-2" />
                          <p className="text-red-800 font-medium">この書類は却下済みです</p>
                          <p className="text-red-600 text-sm mt-1">申請者に再申請を依頼してください</p>
                        </div>
                      );
                    } else {
                      return (
                        <>
                          <button
                            onClick={handleApproveDocument}
                            disabled={processing}
                            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="inline h-5 w-5 mr-2" />
                            {processing ? "処理中..." : `${getDocumentTitle()}を承認`}
                          </button>
                          <button
                            onClick={handleRejectDocument}
                            disabled={processing}
                            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XCircle className="inline h-5 w-5 mr-2" />
                            {processing ? "処理中..." : `${getDocumentTitle()}を却下`}
                          </button>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右パネル: 画像/PDFビューア */}
        <div className="w-1/2 bg-gray-900 flex flex-col">
          {/* 免許証の場合は表面・裏面を縦2段で表示（横向き） */}
          {selectedDoc.category === "license" ? (
            <>
              <div className="bg-gray-800 px-4 py-3">
                <h3 className="text-white font-medium">{getDocumentTitle()} - ファイル</h3>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-4">
                  {/* 表面 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm">表面</p>
                      {getCurrentFileUrl() && (
                        <a
                          href={getCurrentFileUrl()!}
                          download
                          className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors flex items-center"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          ダウンロード
                        </a>
                      )}
                    </div>
                    <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                      {getCurrentFileUrl() ? (
                        isAttachmentPdf(application.license?.image_attachment) ? (
                          <iframe
                            src={getCurrentFileUrl()!}
                            className="w-full h-full border-0"
                            title="運転免許証（表面）"
                          />
                        ) : (
                          <img
                            src={getCurrentFileUrl()!}
                            alt="運転免許証（表面）"
                            className="w-full h-full object-contain"
                          />
                        )
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">画像なし</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* 裏面 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm">裏面</p>
                      {getLicenseBackFileUrl() && (
                        <a
                          href={getLicenseBackFileUrl()!}
                          download
                          className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors flex items-center"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          ダウンロード
                        </a>
                      )}
                    </div>
                    <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                      {getLicenseBackFileUrl() ? (
                        isAttachmentPdf(application.license?.image_attachment_ura) ? (
                          <iframe
                            src={getLicenseBackFileUrl()!}
                            className="w-full h-full border-0"
                            title="運転免許証（裏面）"
                          />
                        ) : (
                          <img
                            src={getLicenseBackFileUrl()!}
                            alt="運転免許証（裏面）"
                            className="w-full h-full object-contain"
                          />
                        )
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">画像なし</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : getCurrentFileUrl() ? (
            // 車検証・保険証の場合は従来通りの画像ビューア
            isPdfFile() ? (
              <PDFViewer
                fileUrl={getCurrentFileUrl()!}
                title={getDocumentTitle()}
              />
            ) : (
              <>
                {/* 画像コントロールバー */}
                <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-white font-medium">{getDocumentTitle()} - 画像</h3>
                  {/* 回転コントロール */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => rotateImage(-90)}
                      className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                      title="左に90°回転"
                    >
                      <RotateCcw className="h-4 w-4 text-white" />
                    </button>
                    <span className="text-white text-sm min-w-[40px] text-center">
                      {imageRotation}°
                    </span>
                    <button
                      onClick={() => rotateImage(90)}
                      className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                      title="右に90°回転"
                    >
                      <RotateCw className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* 画像表示エリア */}
                <div className="flex-1 relative bg-gray-900">
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit
                    key={`${selectedDoc.category}-${selectedDoc.index}-${imageRotation}`}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        {/* ズームコントロール */}
                        <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                          <button
                            onClick={() => zoomIn()}
                            className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                            title="拡大"
                          >
                            <ZoomIn className="h-5 w-5 text-gray-700" />
                          </button>
                          <button
                            onClick={() => zoomOut()}
                            className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                            title="縮小"
                          >
                            <ZoomOut className="h-5 w-5 text-gray-700" />
                          </button>
                          <button
                            onClick={() => {
                              resetTransform();
                              setImageRotation(0);
                            }}
                            className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                            title="リセット"
                          >
                            <RotateCw className="h-5 w-5 text-gray-700" />
                          </button>
                          <a
                            href={getCurrentFileUrl()!}
                            download
                            className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                            title="ダウンロード"
                          >
                            <Download className="h-5 w-5 text-gray-700" />
                          </a>
                        </div>

                        <TransformComponent
                          wrapperClass="w-full h-full"
                          contentClass="w-full h-full flex items-center justify-center"
                        >
                          <img
                            src={getCurrentFileUrl()!}
                            alt={getDocumentTitle()}
                            className="max-w-full max-h-full object-contain transition-transform duration-300"
                            style={{ transform: `rotate(${imageRotation}deg)` }}
                          />
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                </div>
              </>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">ファイルがアップロードされていません</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 却下モーダル */}
      {showRejectModal && (
        <RejectModal
          application={application}
          target={rejectTarget}
          onClose={() => setShowRejectModal(false)}
          onReject={async () => {
            if (rejectTarget === "all") {
              toast.success(`${application.employee.employee_name}さんのすべての審査中書類を却下しました`);
              router.push("/soumu/syaryo/admin/applications");
            } else {
              toast.success(`書類を却下しました`);
              // データを再取得して画面を更新
              const refreshResponse = await fetch(
                `/api/syaryo/applications/overview?employeeId=${employeeId}`
              );
              const refreshData = await refreshResponse.json();
              if (refreshData.success && refreshData.data?.[0]) {
                setApplication(refreshData.data[0]);
              }
            }
          }}
        />
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}

function RejectModal({
  application,
  target,
  onClose,
  onReject,
}: {
  application: ApplicationOverview;
  target: { category: DocumentCategory; index: number } | "all";
  onClose: () => void;
  onReject: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTargetLabel = () => {
    if (target === "all") return "すべての審査中書類";
    switch (target.category) {
      case "license":
        return "運転免許証";
      case "vehicle":
        const vehicle = application.vehicles[target.index];
        return vehicle ? `車検証 (${vehicle.vehicle_number})` : `車検証 #${target.index + 1}`;
      case "insurance":
        const insurance = application.insurances[target.index];
        return insurance ? `任意保険証 (${insurance.policy_number})` : `任意保険証 #${target.index + 1}`;
    }
  };

  // pending状態のドキュメントを全て取得
  const getPendingDocuments = () => {
    const pending: { category: DocumentCategory; index: number; id: string }[] = [];

    if (application.license?.approval_status === "pending") {
      pending.push({ category: "license", index: 0, id: application.license.id });
    }
    application.vehicles.forEach((v, i) => {
      if (v.approval_status === "pending") {
        pending.push({ category: "vehicle", index: i, id: v.id });
      }
    });
    application.insurances.forEach((ins, i) => {
      if (ins.approval_status === "pending") {
        pending.push({ category: "insurance", index: i, id: ins.id });
      }
    });
    return pending;
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("却下理由を入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (target === "all") {
        // 一括却下: pending状態のもののみ
        const pendingDocs = getPendingDocuments();
        const results = await Promise.all(
          pendingDocs.map(doc =>
            fetch(`/api/syaryo/approvals/${doc.id}/reject`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: doc.category, reason }),
            })
          )
        );

        const allSuccess = results.every((r) => r.ok);
        if (!allSuccess) {
          throw new Error("Some rejections failed");
        }
      } else {
        // 個別却下
        let docId: string;
        switch (target.category) {
          case "license":
            docId = application.license!.id;
            break;
          case "vehicle":
            docId = application.vehicles[target.index].id;
            break;
          case "insurance":
            docId = application.insurances[target.index].id;
            break;
        }

        const response = await fetch(`/api/syaryo/approvals/${docId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: target.category, reason }),
        });

        if (!response.ok) {
          throw new Error("Rejection failed");
        }
      }

      onClose();
      onReject();
    } catch (err) {
      console.error("Failed to reject:", err);
      setError("却下に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {getTargetLabel()}を却下
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {application.employee.employee_name}さんの{getTargetLabel()}を却下します。却下理由を入力してください。
        </p>
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded-lg p-3 mb-4 h-32"
          placeholder="却下理由を入力..."
        />
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "送信中..." : "却下する"}
          </button>
        </div>
      </div>
    </div>
  );
}
