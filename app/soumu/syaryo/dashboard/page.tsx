"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Car, Shield, CheckCircle, Clock, XCircle, Search, Plus, Award } from "lucide-react";

interface DocumentData {
  id?: string;
  approval_status?: string;
}

interface MyDocuments {
  license: DocumentData | null;
  vehicles: DocumentData[];
  insurances: DocumentData[];
}

// ステータスの集計
interface StatusSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [documents, setDocuments] = useState<MyDocuments>({
    license: null,
    vehicles: [],
    insurances: [],
  });
  const [loading, setLoading] = useState(true);

  // 書類データを取得
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("/api/syaryo/my-documents");
        const data = await response.json();

        if (data.success && data.data) {
          setDocuments({
            license: data.data.license || null,
            vehicles: data.data.vehicles || [],
            insurances: data.data.insurances || [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchDocuments();
    }
  }, [status]);

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

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

  const user = {
    name: session.user.name || "ゲスト",
    employee_id: (session.user as any).id || session.user.email || "N/A",
  };

  // 配列のステータス集計
  const getStatusSummary = (docs: DocumentData[]): StatusSummary => {
    return docs.reduce(
      (acc, doc) => {
        acc.total++;
        const status = doc.approval_status || "pending";
        if (status === "approved") acc.approved++;
        else if (status === "pending") acc.pending++;
        else if (status === "rejected") acc.rejected++;
        return acc;
      },
      { total: 0, approved: 0, pending: 0, rejected: 0 }
    );
  };

  // 単一ドキュメントのステータスバッジ
  const getStatusBadge = (status: string | undefined, submitted: boolean) => {
    if (!submitted) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <Clock className="w-4 h-4 mr-1" />
          未申請
        </span>
      );
    }

    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            承認済み
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            審査中
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            却下
          </span>
        );
      default:
        return null;
    }
  };

  // 複数ドキュメントのサマリーバッジ
  const getMultiStatusBadge = (summary: StatusSummary) => {
    if (summary.total === 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <Clock className="w-4 h-4 mr-1" />
          未申請
        </span>
      );
    }

    // すべて承認済み
    if (summary.approved === summary.total) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-4 h-4 mr-1" />
          {summary.total}件承認済み
        </span>
      );
    }

    // 却下があれば（承認と混在している可能性あり）
    if (summary.rejected > 0) {
      // 承認もある場合は両方の情報を表示
      if (summary.approved > 0) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            {summary.total}件中{summary.approved}件承認
          </span>
        );
      }
      // 却下のみ
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <XCircle className="w-4 h-4 mr-1" />
          {summary.rejected}件却下
        </span>
      );
    }

    // 審査中がある
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-4 h-4 mr-1" />
        {summary.pending}件審査中
      </span>
    );
  };

  const vehicleSummary = getStatusSummary(documents.vehicles);
  const insuranceSummary = getStatusSummary(documents.insurances);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                マイカー通勤申請ダッシュボード
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {user.name}さん（社員ID: {user.employee_id}）
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/soumu/syaryo/dashboard/permits"
                className="flex items-center justify-center px-3 py-2 text-sm sm:px-4 sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Award className="w-4 h-4 mr-1 sm:mr-2" />
                許可証
              </Link>
              <Link
                href="/soumu/syaryo/dashboard/documents"
                className="flex items-center justify-center px-3 py-2 text-sm sm:px-4 sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="sm:hidden">書類照会</span>
                <span className="hidden sm:inline">承認済書類照会</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 申請カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 免許証（1:1） */}
          <Link href="/soumu/syaryo/dashboard/license/new">
            <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6">
              <div className="flex items-center justify-between mb-4">
                <FileText className="h-12 w-12 text-blue-600" />
                {getStatusBadge(documents.license?.approval_status, !!documents.license)}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">免許証</h3>
              <p className="text-xs text-gray-500 mb-2">1件まで登録可能</p>
              <p className="text-sm text-gray-600">
                運転免許証の情報を登録してください
              </p>
              <div className="mt-4 text-blue-600 text-sm font-medium">
                {documents.license ? "詳細を見る →" : "申請する →"}
              </div>
            </div>
          </Link>

          {/* 車検証（1:多） */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Car className="h-12 w-12 text-green-600" />
              {getMultiStatusBadge(vehicleSummary)}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">車検証</h3>
            <p className="text-xs text-gray-500 mb-2">複数登録可能（現在{vehicleSummary.total}件）</p>
            <p className="text-sm text-gray-600 mb-4">
              車検証の情報を登録してください
            </p>

            {/* 詳細表示 */}
            {vehicleSummary.total > 0 && (
              <div className="mb-4 text-xs text-gray-500 space-y-1">
                {vehicleSummary.approved > 0 && (
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                    承認済み: {vehicleSummary.approved}件
                  </div>
                )}
                {vehicleSummary.pending > 0 && (
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 text-yellow-500 mr-1" />
                    審査中: {vehicleSummary.pending}件
                  </div>
                )}
                {vehicleSummary.rejected > 0 && (
                  <div className="flex items-center">
                    <XCircle className="w-3 h-3 text-red-500 mr-1" />
                    却下: {vehicleSummary.rejected}件
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Link
                href="/soumu/syaryo/dashboard/vehicle/new"
                className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Link>
              {vehicleSummary.total > 0 && (
                <Link
                  href="/soumu/syaryo/dashboard/documents"
                  className="flex-1 flex items-center justify-center px-3 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm"
                >
                  一覧を見る
                </Link>
              )}
            </div>
          </div>

          {/* 任意保険（1:多） */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-12 w-12 text-purple-600" />
              {getMultiStatusBadge(insuranceSummary)}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">任意保険証</h3>
            <p className="text-xs text-gray-500 mb-2">複数登録可能（現在{insuranceSummary.total}件）</p>
            <p className="text-sm text-gray-600 mb-4">
              任意保険証の情報を登録してください
            </p>

            {/* 詳細表示 */}
            {insuranceSummary.total > 0 && (
              <div className="mb-4 text-xs text-gray-500 space-y-1">
                {insuranceSummary.approved > 0 && (
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                    承認済み: {insuranceSummary.approved}件
                  </div>
                )}
                {insuranceSummary.pending > 0 && (
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 text-yellow-500 mr-1" />
                    審査中: {insuranceSummary.pending}件
                  </div>
                )}
                {insuranceSummary.rejected > 0 && (
                  <div className="flex items-center">
                    <XCircle className="w-3 h-3 text-red-500 mr-1" />
                    却下: {insuranceSummary.rejected}件
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Link
                href="/soumu/syaryo/dashboard/insurance/new"
                className="flex-1 flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Link>
              {insuranceSummary.total > 0 && (
                <Link
                  href="/soumu/syaryo/dashboard/documents"
                  className="flex-1 flex items-center justify-center px-3 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                >
                  一覧を見る
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* お知らせ */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                マイカー通勤を許可するには、免許証・車検証・任意保険証がそれぞれ最低1件以上承認される必要があります。
                車検証と任意保険証は複数台分を登録できます。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
