"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import { ApplicationOverview } from "@/types/syaryo";
import { CheckCircle, XCircle, Clock, FileText, Car, Shield, ExternalLink, CheckSquare, Square } from "lucide-react";
import { useToast, ToastContainer } from "@/components/features/syaryo/ui/toast";

// 一括承認用の型定義
interface BulkApprovalItem {
  id: string;
  type: "license" | "vehicle" | "insurance";
}

export default function AdminApplicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [applications, setApplications] = useState<ApplicationOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [selectedApp, setSelectedApp] = useState<ApplicationOverview | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 一括承認用の選択状態
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/syaryo/applications/overview?filter=${filter}`);
      const data = await response.json();

      if (data.success) {
        setApplications(data.data || []);
      } else {
        setError(data.error || "申請の取得に失敗しました");
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error);
      setError("申請の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

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

  // pending状態のドキュメントを全て取得
  const getPendingDocuments = (app: ApplicationOverview) => {
    const pending: { type: string; id: string }[] = [];

    if (app.license?.approval_status === "pending") {
      pending.push({ type: "license", id: app.license.id });
    }
    app.vehicles.forEach((v) => {
      if (v.approval_status === "pending") {
        pending.push({ type: "vehicle", id: v.id });
      }
    });
    app.insurances.forEach((ins) => {
      if (ins.approval_status === "pending") {
        pending.push({ type: "insurance", id: ins.id });
      }
    });
    return pending;
  };

  // 承認サマリーを取得
  const getApprovalSummary = (app: ApplicationOverview) => {
    const docs: string[] = [];
    if (app.license) docs.push(app.license.approval_status);
    app.vehicles.forEach(v => docs.push(v.approval_status));
    app.insurances.forEach(i => docs.push(i.approval_status));

    return {
      approved: docs.filter(s => s === "approved").length,
      rejected: docs.filter(s => s === "rejected").length,
      pending: docs.filter(s => s === "pending").length,
      total: docs.length
    };
  };

  // 承認待ちのある申請のみフィルタ
  const applicationsWithPending = useMemo(() => {
    return applications.filter(app => getApprovalSummary(app).pending > 0);
  }, [applications]);

  // 全選択/解除
  const handleSelectAll = () => {
    if (selectedEmployeeIds.size === applicationsWithPending.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(applicationsWithPending.map(app => app.employee.employee_id)));
    }
  };

  // 個別選択/解除
  const handleSelectEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployeeIds(newSelected);
  };

  // 選択された申請の承認待ち書類を全て取得
  const getSelectedPendingItems = (): BulkApprovalItem[] => {
    const items: BulkApprovalItem[] = [];
    applications.forEach(app => {
      if (!selectedEmployeeIds.has(app.employee.employee_id)) return;

      if (app.license?.approval_status === "pending") {
        items.push({ id: app.license.id, type: "license" });
      }
      app.vehicles.forEach(v => {
        if (v.approval_status === "pending") {
          items.push({ id: v.id, type: "vehicle" });
        }
      });
      app.insurances.forEach(ins => {
        if (ins.approval_status === "pending") {
          items.push({ id: ins.id, type: "insurance" });
        }
      });
    });
    return items;
  };

  // 一括承認実行
  const handleBulkApprove = async () => {
    const items = getSelectedPendingItems();
    if (items.length === 0) {
      toast.error("承認待ちの書類がありません");
      return;
    }

    if (!confirm(`選択された${selectedEmployeeIds.size}名の承認待ち書類（計${items.length}件）を一括承認しますか？`)) {
      return;
    }

    setBulkApproving(true);
    try {
      const response = await fetch("/api/syaryo/approvals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, action: "approve" }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setSelectedEmployeeIds(new Set());
        fetchApplications();
      } else {
        toast.error(result.error || "一括承認に失敗しました");
      }
    } catch (error) {
      console.error("Bulk approval failed:", error);
      toast.error("一括承認に失敗しました");
    } finally {
      setBulkApproving(false);
    }
  };

  // 選択クリア
  const clearSelection = () => {
    setSelectedEmployeeIds(new Set());
  };

  const handleApprove = async (app: ApplicationOverview) => {
    const pendingDocs = getPendingDocuments(app);
    if (pendingDocs.length === 0) {
      toast.error("承認待ちの書類がありません");
      return;
    }

    if (!confirm(`審査中の書類（${pendingDocs.length}件）をすべて承認しますか？`)) return;

    try {
      const results = await Promise.all(
        pendingDocs.map(doc =>
          fetch(`/api/syaryo/approvals/${doc.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: doc.type, action: "approve" }),
          })
        )
      );

      const allSuccess = results.every(r => r.ok);
      if (allSuccess) {
        toast.success(`${app.employee.employee_name}さんの申請を承認しました`);
        fetchApplications();
      } else {
        throw new Error("Some approvals failed");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("承認に失敗しました。もう一度お試しください。");
    }
  };

  const handleReject = (app: ApplicationOverview) => {
    setSelectedApp(app);
    setShowRejectModal(true);
  };

  // ローディング中
  if (status === "loading") {
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">申請一覧</h1>
        <p className="mt-1 text-sm text-gray-600">
          マイカー通勤申請の承認・却下を行います
        </p>
      </div>

      {/* フィルター */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "pending"
                ? "bg-yellow-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            承認待ち
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "approved"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            承認済み
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            すべて
          </button>
        </div>
      </div>

      {/* 一括承認バー */}
      {applicationsWithPending.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 transition-colors"
              >
                {selectedEmployeeIds.size === applicationsWithPending.length ? (
                  <CheckSquare className="h-5 w-5" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
                {selectedEmployeeIds.size === applicationsWithPending.length ? "全解除" : "全選択"}
              </button>
              {selectedEmployeeIds.size > 0 && (
                <span className="text-sm text-blue-700">
                  {selectedEmployeeIds.size}名選択中（書類 {getSelectedPendingItems().length}件）
                </span>
              )}
            </div>
            {selectedEmployeeIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  選択解除
                </button>
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkApproving}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      処理中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      一括承認
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 申請一覧 */}
      <div>
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">申請がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const summary = getApprovalSummary(app);
              const isSelected = selectedEmployeeIds.has(app.employee.employee_id);
              const hasPending = summary.pending > 0;
              return (
                <div
                  key={app.employee.employee_id}
                  className={`bg-white rounded-lg shadow p-4 sm:p-6 ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                >
                  {/* 社員情報 */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                    <div className="flex items-start gap-3">
                      {/* チェックボックス */}
                      {hasPending && (
                        <button
                          onClick={() => handleSelectEmployee(app.employee.employee_id)}
                          className="mt-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {app.employee.employee_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          社員ID: {app.employee.employee_id} | {app.employee.department}
                        </p>
                        <div className="mt-2">
                        {summary.total === 0 ? (
                          <span className="text-xs text-gray-500">書類なし</span>
                        ) : summary.approved === summary.total ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            全{summary.total}件承認済み
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">
                            承認: {summary.approved} / 審査中: {summary.pending} / 却下: {summary.rejected} （計{summary.total}件）
                          </span>
                        )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => router.push(`/admin/applications/${app.employee.employee_id}`)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        詳細
                      </button>
                      <button
                        onClick={() => handleApprove(app)}
                        disabled={summary.pending === 0}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => handleReject(app)}
                        disabled={summary.pending === 0}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        却下
                      </button>
                    </div>
                  </div>

                  {/* 書類情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 免許証（1:1） */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="font-medium">免許証</span>
                        </div>
                        {app.license ? getStatusBadge(app.license.approval_status) : (
                          <span className="text-xs text-gray-400">未登録</span>
                        )}
                      </div>
                      {app.license ? (
                        <>
                          <p className="text-sm text-gray-600">番号: {app.license.license_number}</p>
                          <p className="text-sm text-gray-600">
                            有効期限: {new Date(app.license.expiration_date).toLocaleDateString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">未登録</p>
                      )}
                    </div>

                    {/* 車検証（1:多） */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Car className="h-5 w-5 text-green-600 mr-2" />
                          <span className="font-medium">車検証（{app.vehicles.length}件）</span>
                        </div>
                      </div>
                      {app.vehicles.length > 0 ? (
                        <div className="space-y-3">
                          {app.vehicles.map((vehicle, idx) => (
                            <div key={vehicle.id} className={idx > 0 ? "pt-3 border-t" : ""}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{vehicle.vehicle_number}</span>
                                {getStatusBadge(vehicle.approval_status)}
                              </div>
                              <p className="text-xs text-gray-600">
                                車検期限: {new Date(vehicle.inspection_expiration_date).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">未登録</p>
                      )}
                    </div>

                    {/* 任意保険（1:多） */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Shield className="h-5 w-5 text-purple-600 mr-2" />
                          <span className="font-medium">任意保険（{app.insurances.length}件）</span>
                        </div>
                      </div>
                      {app.insurances.length > 0 ? (
                        <div className="space-y-3">
                          {app.insurances.map((insurance, idx) => {
                            const meetsRequirements =
                              insurance.liability_personal_unlimited &&
                              (insurance.liability_property_amount || 0) >= 5000 &&
                              (insurance.passenger_injury_amount || 0) >= 2000;
                            return (
                              <div key={insurance.id} className={idx > 0 ? "pt-3 border-t" : ""}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{insurance.policy_number}</span>
                                  {getStatusBadge(insurance.approval_status)}
                                </div>
                                <p className="text-xs text-gray-600">
                                  保険期限: {new Date(insurance.coverage_end_date).toLocaleDateString()}
                                </p>
                                {/* 補償条件サマリー */}
                                <div className="mt-1">
                                  {meetsRequirements ? (
                                    <span className="inline-flex items-center text-xs text-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      規定OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-xs text-red-600">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      規定NG
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">未登録</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 却下モーダル */}
      {showRejectModal && selectedApp && (
        <RejectModal
          application={selectedApp}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedApp(null);
          }}
          onReject={() => {
            toast.success(`${selectedApp.employee.employee_name}さんの申請を却下しました`);
            fetchApplications();
            setShowRejectModal(false);
            setSelectedApp(null);
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
  onClose,
  onReject,
}: {
  application: ApplicationOverview;
  onClose: () => void;
  onReject: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pending状態のドキュメントを全て取得
  const getPendingDocuments = () => {
    const pending: { type: string; id: string }[] = [];

    if (application.license?.approval_status === "pending") {
      pending.push({ type: "license", id: application.license.id });
    }
    application.vehicles.forEach((v) => {
      if (v.approval_status === "pending") {
        pending.push({ type: "vehicle", id: v.id });
      }
    });
    application.insurances.forEach((ins) => {
      if (ins.approval_status === "pending") {
        pending.push({ type: "insurance", id: ins.id });
      }
    });
    return pending;
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("却下理由を入力してください");
      return;
    }

    const pendingDocs = getPendingDocuments();
    if (pendingDocs.length === 0) {
      setError("却下する書類がありません");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        pendingDocs.map(doc =>
          fetch(`/api/syaryo/approvals/${doc.id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: doc.type, reason }),
          })
        )
      );

      const allSuccess = results.every(r => r.ok);
      if (allSuccess) {
        onReject();
      } else {
        throw new Error("Some rejections failed");
      }
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">申請を却下</h2>
        <p className="text-sm text-gray-600 mb-4">
          {application.employee.employee_name}さんの審査中書類をすべて却下します。却下理由を入力してください。
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
