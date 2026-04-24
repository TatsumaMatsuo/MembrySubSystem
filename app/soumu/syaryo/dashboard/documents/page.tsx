"use client";

import { useState, useEffect } from "react";

// Force dynamic rendering to avoid SSG issues with SessionProvider
export const dynamic = "force-dynamic";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Car,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { LarkAttachment } from "@/types/syaryo";
import { AttachmentViewer } from "@/components/features/syaryo/ui/attachment-viewer";

interface DocumentData {
  id: string;
  employee_id: string;
  approval_status: string;
  rejection_reason?: string;
  image_attachment?: LarkAttachment | LarkAttachment[];
  image_attachment_ura?: LarkAttachment | LarkAttachment[]; // 免許証裏面
  // License specific
  license_number?: string;
  expiration_date?: string;
  // Vehicle specific
  vehicle_number?: string;
  inspection_expiration_date?: string;
  // Insurance specific
  policy_number?: string;
  coverage_start_date?: string;
  coverage_end_date?: string;
}

interface MyDocuments {
  license: DocumentData | null;
  vehicles: DocumentData[];
  insurances: DocumentData[];
}

type SelectedDoc = {
  type: "license" | "vehicle" | "insurance";
  index: number;
};

export default function MyDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [documents, setDocuments] = useState<MyDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null);

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // 書類データを取得（承認済みのみフィルタリング）
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("/api/syaryo/my-documents");
        const data = await response.json();

        if (data.success) {
          // デバッグ: APIレスポンスを確認
          console.log("[documents] API response:", data.data);
          console.log("[documents] license image_attachment:", data.data.license?.image_attachment);

          // 承認済み書類のみをフィルタリング
          const filteredData: MyDocuments = {
            license: data.data.license?.approval_status === "approved" ? data.data.license : null,
            vehicles: (data.data.vehicles || []).filter(
              (v: DocumentData) => v.approval_status === "approved"
            ),
            insurances: (data.data.insurances || []).filter(
              (i: DocumentData) => i.approval_status === "approved"
            ),
          };
          console.log("[documents] filteredData:", filteredData);
          setDocuments(filteredData);
        } else {
          setError(data.error || "書類の取得に失敗しました");
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError("書類の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchDocuments();
    }
  }, [status]);

  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3 mr-1" />
          未申請
        </span>
      );
    }

    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            承認済み
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            審査中
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            却下
          </span>
        );
      default:
        return null;
    }
  };

  const isExpiringSoon = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date < new Date();
  };

  const getSelectedDocument = (): DocumentData | null => {
    if (!selectedDoc || !documents) return null;

    if (selectedDoc.type === "license") {
      return documents.license;
    } else if (selectedDoc.type === "vehicle") {
      return documents.vehicles[selectedDoc.index] || null;
    } else {
      return documents.insurances[selectedDoc.index] || null;
    }
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

  // セッションがない場合は何も表示しない
  if (!session || !session.user) {
    return null;
  }

  const user = {
    name: session.user.name || "ゲスト",
    employee_id: (session.user as any).id || session.user.email || "N/A",
  };

  const currentDoc = getSelectedDocument();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/soumu/syaryo/dashboard"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">承認済書類照会</h1>
              <p className="mt-1 text-sm text-gray-600">
                {user.name}さん（社員ID: {user.employee_id}）
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 書類カード一覧 */}
          <div className="space-y-4">
            {/* 免許証（1:1） */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-white" />
                  <h3 className="text-white font-medium">運転免許証</h3>
                </div>
                <span className="text-blue-200 text-xs">1件まで</span>
              </div>
              {documents?.license ? (
                <div
                  onClick={() => setSelectedDoc({ type: "license", index: 0 })}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedDoc?.type === "license" ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{documents.license.license_number}</span>
                    {getStatusBadge(documents.license.approval_status)}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center">
                    有効期限: {documents.license.expiration_date
                      ? new Date(documents.license.expiration_date).toLocaleDateString()
                      : "-"}
                    {isExpired(documents.license.expiration_date) && (
                      <AlertTriangle className="w-4 h-4 ml-1 text-red-600" />
                    )}
                    {isExpiringSoon(documents.license.expiration_date) && (
                      <AlertTriangle className="w-4 h-4 ml-1 text-yellow-600" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">未申請</p>
                  <Link
                    href="/soumu/syaryo/dashboard/license/new"
                    className="inline-flex items-center mt-2 text-blue-600 text-sm hover:underline"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    申請する
                  </Link>
                </div>
              )}
            </div>

            {/* 車検証（1:多） */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-green-600 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Car className="h-5 w-5 text-white" />
                  <h3 className="text-white font-medium">車検証</h3>
                </div>
                <span className="text-green-200 text-xs">複数登録可</span>
              </div>
              {documents?.vehicles && documents.vehicles.length > 0 ? (
                <div className="divide-y">
                  {documents.vehicles.map((vehicle, index) => (
                    <div
                      key={vehicle.id}
                      onClick={() => setSelectedDoc({ type: "vehicle", index })}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedDoc?.type === "vehicle" && selectedDoc?.index === index
                          ? "bg-green-50 ring-2 ring-green-500 ring-inset"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{vehicle.vehicle_number}</span>
                        {getStatusBadge(vehicle.approval_status)}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center">
                        車検期限: {vehicle.inspection_expiration_date
                          ? new Date(vehicle.inspection_expiration_date).toLocaleDateString()
                          : "-"}
                        {isExpired(vehicle.inspection_expiration_date) && (
                          <AlertTriangle className="w-4 h-4 ml-1 text-red-600" />
                        )}
                        {isExpiringSoon(vehicle.inspection_expiration_date) && (
                          <AlertTriangle className="w-4 h-4 ml-1 text-yellow-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">未申請</p>
                </div>
              )}
              <div className="px-4 py-3 bg-gray-50 border-t">
                <Link
                  href="/soumu/syaryo/dashboard/vehicle/new"
                  className="inline-flex items-center text-green-600 text-sm hover:underline"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  車両を追加
                </Link>
              </div>
            </div>

            {/* 任意保険証（1:多） */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-purple-600 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-white" />
                  <h3 className="text-white font-medium">任意保険証</h3>
                </div>
                <span className="text-purple-200 text-xs">複数登録可</span>
              </div>
              {documents?.insurances && documents.insurances.length > 0 ? (
                <div className="divide-y">
                  {documents.insurances.map((insurance, index) => (
                    <div
                      key={insurance.id}
                      onClick={() => setSelectedDoc({ type: "insurance", index })}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedDoc?.type === "insurance" && selectedDoc?.index === index
                          ? "bg-purple-50 ring-2 ring-purple-500 ring-inset"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{insurance.policy_number}</span>
                        {getStatusBadge(insurance.approval_status)}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center">
                        保険期限: {insurance.coverage_end_date
                          ? new Date(insurance.coverage_end_date).toLocaleDateString()
                          : "-"}
                        {isExpired(insurance.coverage_end_date) && (
                          <AlertTriangle className="w-4 h-4 ml-1 text-red-600" />
                        )}
                        {isExpiringSoon(insurance.coverage_end_date) && (
                          <AlertTriangle className="w-4 h-4 ml-1 text-yellow-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">未申請</p>
                </div>
              )}
              <div className="px-4 py-3 bg-gray-50 border-t">
                <Link
                  href="/soumu/syaryo/dashboard/insurance/new"
                  className="inline-flex items-center text-purple-600 text-sm hover:underline"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  保険を追加
                </Link>
              </div>
            </div>
          </div>

          {/* 画像プレビュー */}
          <div className="bg-white rounded-lg shadow overflow-hidden sticky top-8">
            <div className="bg-gray-800 px-4 py-3">
              <h3 className="text-white font-medium">
                {selectedDoc?.type === "license" && "運転免許証"}
                {selectedDoc?.type === "vehicle" && `車検証 #${(selectedDoc?.index || 0) + 1}`}
                {selectedDoc?.type === "insurance" && `任意保険証 #${(selectedDoc?.index || 0) + 1}`}
                {!selectedDoc && "書類プレビュー"}
              </h3>
            </div>
            <div className="bg-gray-100">
              {selectedDoc?.type === "license" && currentDoc ? (
                // 免許証の場合は表面・裏面を縦2段で表示（横向き）
                <div className="p-4 space-y-4">
                  {/* 表面 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">表面</p>
                    <AttachmentViewer
                      attachment={currentDoc.image_attachment}
                      title="運転免許証（表面）"
                      aspectClass="aspect-[16/10]"
                      enableModal={true}
                    />
                  </div>
                  {/* 裏面 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">裏面</p>
                    <AttachmentViewer
                      attachment={currentDoc.image_attachment_ura}
                      title="運転免許証（裏面）"
                      aspectClass="aspect-[16/10]"
                      enableModal={true}
                    />
                  </div>
                </div>
              ) : selectedDoc && currentDoc ? (
                // 車検証・保険証の場合は従来通り1枚表示
                <div className="p-4">
                  <AttachmentViewer
                    attachment={currentDoc.image_attachment}
                    title={selectedDoc.type === "vehicle" ? "車検証" : "任意保険証"}
                    aspectClass="aspect-[4/3]"
                    enableModal={true}
                  />
                </div>
              ) : (
                // 未選択状態
                <div className="aspect-[4/3] flex items-center justify-center text-center text-gray-400">
                  <div>
                    <FileText className="h-16 w-16 mx-auto mb-2" />
                    <p>左の書類を選択してください</p>
                  </div>
                </div>
              )}
            </div>
            {/* 選択した書類の詳細情報 */}
            {currentDoc && (
              <div className="p-4 border-t">
                <dl className="space-y-2 text-sm">
                  {selectedDoc?.type === "license" && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">免許証番号</dt>
                        <dd className="font-medium">{currentDoc.license_number}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">有効期限</dt>
                        <dd className="font-medium">
                          {currentDoc.expiration_date
                            ? new Date(currentDoc.expiration_date).toLocaleDateString()
                            : "-"}
                        </dd>
                      </div>
                    </>
                  )}
                  {selectedDoc?.type === "vehicle" && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">車両番号</dt>
                        <dd className="font-medium">{currentDoc.vehicle_number}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">車検期限</dt>
                        <dd className="font-medium">
                          {currentDoc.inspection_expiration_date
                            ? new Date(currentDoc.inspection_expiration_date).toLocaleDateString()
                            : "-"}
                        </dd>
                      </div>
                    </>
                  )}
                  {selectedDoc?.type === "insurance" && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">証券番号</dt>
                        <dd className="font-medium">{currentDoc.policy_number}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">保険期限</dt>
                        <dd className="font-medium">
                          {currentDoc.coverage_end_date
                            ? new Date(currentDoc.coverage_end_date).toLocaleDateString()
                            : "-"}
                        </dd>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">承認状態</dt>
                    <dd>{getStatusBadge(currentDoc.approval_status)}</dd>
                  </div>
                  {currentDoc.approval_status === "rejected" && currentDoc.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                      却下理由: {currentDoc.rejection_reason}
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/soumu/syaryo/dashboard"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
