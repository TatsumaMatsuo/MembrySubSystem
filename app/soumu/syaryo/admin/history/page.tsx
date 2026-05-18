"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock, FileText, Car, Shield, Filter, Calendar } from "lucide-react";
import { useToast, ToastContainer } from "@/components/features/syaryo/ui/toast";

interface ApprovalHistory {
  id: string;
  application_type: "license" | "vehicle" | "insurance";
  application_id: string;
  employee_id: string;
  employee_name: string;
  action: "approved" | "rejected";
  approver_id: string;
  approver_name: string;
  reason: string;
  timestamp: number;
  created_at: number;
}

export default function ApprovalHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [histories, setHistories] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [actionFilter, setActionFilter] = useState<"all" | "approved" | "rejected">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "license" | "vehicle" | "insurance">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // 承認履歴を取得
  const fetchHistories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (actionFilter !== "all") {
        params.append("action", actionFilter);
      }

      const response = await fetch(`/api/syaryo/history?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setHistories(data.data || []);
      } else {
        setError(data.error || "履歴の取得に失敗しました");
      }
    } catch (error) {
      console.error("Failed to fetch histories:", error);
      setError("履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchHistories();
    }
  }, [fetchHistories, status]);

  // フィルター処理（クライアントサイド）
  const filteredHistories = histories.filter((history) => {
    // タイプフィルター
    if (typeFilter !== "all" && history.application_type !== typeFilter) {
      return false;
    }

    // 検索クエリ
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (history.employee_name || "").toLowerCase().includes(query) ||
        (history.approver_name || "").toLowerCase().includes(query) ||
        (history.employee_id || "").toLowerCase().includes(query) ||
        (history.approver_id || "").toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getActionBadge = (action: string) => {
    if (action === "approved") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          承認
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          却下
        </span>
      );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "license":
        return <FileText className="h-5 w-5 text-blue-600" />;
      case "vehicle":
        return <Car className="h-5 w-5 text-green-600" />;
      case "insurance":
        return <Shield className="h-5 w-5 text-purple-600" />;
      default:
        return null;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "license":
        return "運転免許証";
      case "vehicle":
        return "車検証";
      case "insurance":
        return "任意保険証";
      default:
        return type;
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

  // セッションがない場合は何も表示しない（リダイレクト中）
  if (!session || !session.user) {
    return null;
  }

  return (
    <div className="p-4 sm:p-8">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">承認履歴</h1>
        <p className="mt-1 text-sm text-gray-600">
          承認・却下の履歴を確認できます
        </p>
      </div>

      {/* フィルター */}
      <div>
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">フィルター</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* アクションフィルター */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                アクション
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="w-full border rounded-lg p-2"
              >
                <option value="all">すべて</option>
                <option value="approved">承認のみ</option>
                <option value="rejected">却下のみ</option>
              </select>
            </div>

            {/* タイプフィルター */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                書類タイプ
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full border rounded-lg p-2"
              >
                <option value="all">すべて</option>
                <option value="license">運転免許証</option>
                <option value="vehicle">車検証</option>
                <option value="insurance">任意保険証</option>
              </select>
            </div>

            {/* 検索 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                検索（名前・ID）
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="検索..."
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 履歴一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredHistories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">履歴がありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      書類タイプ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申請者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      承認者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      理由
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistories.map((history) => (
                    <tr key={history.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(history.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(history.application_type)}
                          <span className="text-sm text-gray-900">
                            {getTypeName(history.application_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {history.employee_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {history.employee_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {history.approver_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {history.approver_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(history.action)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {history.reason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 統計情報 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">総件数</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {filteredHistories.length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">承認件数</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {filteredHistories.filter((h) => h.action === "approved").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">却下件数</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {filteredHistories.filter((h) => h.action === "rejected").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
