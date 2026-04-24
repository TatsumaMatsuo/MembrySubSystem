"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Car,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Plus,
  UserPlus,
  User,
  RefreshCw,
  X,
} from "lucide-react";
import { DriversLicenseForm } from "@/components/features/syaryo/forms/drivers-license-form";
import { VehicleRegistrationForm } from "@/components/features/syaryo/forms/vehicle-registration-form";
import { InsurancePolicyForm } from "@/components/features/syaryo/forms/insurance-policy-form";
import { DriversLicenseFormData, VehicleRegistrationFormData, InsurancePolicyFormData } from "@/lib/syaryo/validations/application";

interface Employee {
  employee_id: string;
  employee_name: string;
  email?: string;
  department?: string;
}

interface DocumentData {
  id?: string;
  approval_status?: string;
}

interface MyDocuments {
  license: DocumentData | null;
  vehicles: DocumentData[];
  insurances: DocumentData[];
}

interface StatusSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

type FormType = "license" | "vehicle" | "insurance" | null;

function ProxyApplicationContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [documents, setDocuments] = useState<MyDocuments>({
    license: null,
    vehicles: [],
    insurances: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // URLパラメータから社員情報を復元
  useEffect(() => {
    const empId = searchParams.get("employee_id");
    const empName = searchParams.get("employee_name");
    if (empId && empName && !selectedEmployee) {
      setSelectedEmployee({
        employee_id: empId,
        employee_name: decodeURIComponent(empName),
      });
    }
  }, [searchParams, selectedEmployee]);

  // 書類データを取得
  const fetchDocuments = useCallback(async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/syaryo/my-documents?employee_id=${selectedEmployee.employee_id}`);
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
  }, [selectedEmployee]);

  // 社員選択時に書類データを取得
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 社員検索
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      alert("2文字以上で検索してください");
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/syaryo/lark/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        const employees: Employee[] = data.data.map((user: any) => ({
          employee_id: user.user_id || user.open_id,
          employee_name: user.name,
          email: user.email,
        }));
        setSearchResults(employees);

        if (employees.length === 0) {
          alert("社員が見つかりませんでした");
        }
      } else {
        alert("検索に失敗しました");
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert("検索中にエラーが発生しました");
    } finally {
      setSearching(false);
    }
  };

  // 免許証申請送信
  const handleLicenseSubmit = async (data: DriversLicenseFormData) => {
    if (!selectedEmployee) return;

    setFormLoading(true);
    setFormError(null);

    try {
      let imageAttachment = null;
      if (data.image_file) {
        const formData = new FormData();
        formData.append("file", data.image_file);
        const uploadResponse = await fetch("/api/syaryo/upload-attachment", { method: "POST", body: formData });
        if (!uploadResponse.ok) throw new Error("ファイルのアップロードに失敗しました");
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) throw new Error(uploadResult.error || "ファイルのアップロードに失敗しました");
        imageAttachment = uploadResult.attachment;
      }

      let imageAttachmentUra = null;
      if (data.image_file_ura) {
        const formDataUra = new FormData();
        formDataUra.append("file", data.image_file_ura);
        const uploadResponseUra = await fetch("/api/syaryo/upload-attachment", { method: "POST", body: formDataUra });
        if (!uploadResponseUra.ok) throw new Error("裏面ファイルのアップロードに失敗しました");
        const uploadResultUra = await uploadResponseUra.json();
        if (!uploadResultUra.success) throw new Error(uploadResultUra.error || "裏面ファイルのアップロードに失敗しました");
        imageAttachmentUra = uploadResultUra.attachment;
      }

      const response = await fetch("/api/syaryo/applications/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          license_number: data.license_number,
          license_type: data.license_type,
          issue_date: data.issue_date.toISOString(),
          expiration_date: data.expiration_date.toISOString(),
          image_attachment: imageAttachment,
          image_attachment_ura: imageAttachmentUra,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "申請の送信に失敗しました");
      }

      setActiveForm(null);
      setSuccessMessage("免許証を登録しました");
      await fetchDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  };

  // 車検証申請送信
  const handleVehicleSubmit = async (data: VehicleRegistrationFormData) => {
    if (!selectedEmployee) return;

    setFormLoading(true);
    setFormError(null);

    try {
      let imageAttachment = null;
      if (data.image_file) {
        const formData = new FormData();
        formData.append("file", data.image_file);
        const uploadResponse = await fetch("/api/syaryo/upload-attachment", { method: "POST", body: formData });
        if (!uploadResponse.ok) throw new Error("ファイルのアップロードに失敗しました");
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) throw new Error(uploadResult.error || "ファイルのアップロードに失敗しました");
        imageAttachment = uploadResult.attachment;
      }

      const response = await fetch("/api/syaryo/applications/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          vehicle_number: data.vehicle_number,
          vehicle_type: data.vehicle_type,
          manufacturer: data.manufacturer,
          model_name: data.model_name,
          inspection_expiration_date: data.inspection_expiration_date.toISOString(),
          owner_name: data.owner_name,
          image_attachment: imageAttachment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "申請の送信に失敗しました");
      }

      setActiveForm(null);
      setSuccessMessage("車検証を登録しました");
      await fetchDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  };

  // 保険証申請送信
  const handleInsuranceSubmit = async (data: InsurancePolicyFormData) => {
    if (!selectedEmployee) return;

    setFormLoading(true);
    setFormError(null);

    try {
      let imageAttachment = null;
      if (data.image_file) {
        const formData = new FormData();
        formData.append("file", data.image_file);
        const uploadResponse = await fetch("/api/syaryo/upload-attachment", { method: "POST", body: formData });
        if (!uploadResponse.ok) throw new Error("ファイルのアップロードに失敗しました");
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) throw new Error(uploadResult.error || "ファイルのアップロードに失敗しました");
        imageAttachment = uploadResult.attachment;
      }

      const response = await fetch("/api/syaryo/applications/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          policy_number: data.policy_number,
          insurance_company: data.insurance_company,
          policy_type: data.policy_type,
          coverage_start_date: data.coverage_start_date.toISOString(),
          coverage_end_date: data.coverage_end_date.toISOString(),
          insured_amount: data.insured_amount,
          liability_personal_unlimited: data.liability_personal_unlimited,
          liability_property_amount: data.liability_property_amount,
          passenger_injury_amount: data.passenger_injury_amount,
          image_attachment: imageAttachment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "申請の送信に失敗しました");
      }

      setActiveForm(null);
      setSuccessMessage("任意保険証を登録しました");
      await fetchDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  };

  // ステータス集計
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

  const getMultiStatusBadge = (summary: StatusSummary) => {
    if (summary.total === 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <Clock className="w-4 h-4 mr-1" />
          未申請
        </span>
      );
    }

    if (summary.approved === summary.total) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-4 h-4 mr-1" />
          {summary.total}件承認済み
        </span>
      );
    }

    if (summary.rejected > 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <XCircle className="w-4 h-4 mr-1" />
          {summary.rejected}件却下
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-4 h-4 mr-1" />
        {summary.pending}件審査中
      </span>
    );
  };

  // 社員未選択時: 検索画面
  if (!selectedEmployee) {
    return (
      <div className="p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-cyan-600" />
            代理申請
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            代理で申請する社員を選択してください
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">社員を検索</h2>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="社員名または社員IDで検索..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {searchResults.map((employee) => (
                <div
                  key={employee.employee_id}
                  onClick={() => setSelectedEmployee(employee)}
                  className="p-4 hover:bg-cyan-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{employee.employee_name}</p>
                      <p className="text-sm text-gray-500">
                        ID: {employee.employee_id}
                        {employee.email && ` | ${employee.email}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 社員選択後: ダッシュボード
  const vehicleSummary = getStatusSummary(documents.vehicles);
  const insuranceSummary = getStatusSummary(documents.insurances);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 成功メッセージ */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* フォームモーダル */}
      {activeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {activeForm === "license" && "免許証申請（代理）"}
                  {activeForm === "vehicle" && "車検証申請（代理）"}
                  {activeForm === "insurance" && "任意保険証申請（代理）"}
                </h2>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <User className="w-4 h-4 text-cyan-600" />
                  <span className="text-cyan-700 font-medium">{selectedEmployee.employee_name}</span>
                  <span className="text-gray-500">（ID: {selectedEmployee.employee_id}）</span>
                </div>
              </div>
              <button
                onClick={() => { setActiveForm(null); setFormError(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* 代理申請の注意書き */}
              <div className="mb-6 bg-cyan-50 border-l-4 border-cyan-400 p-4 rounded">
                <div className="flex">
                  <UserPlus className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-cyan-800">
                      <strong>{selectedEmployee.employee_name}</strong> さんの代理として申請を行っています。
                    </p>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              {activeForm === "license" && (
                <DriversLicenseForm onSubmit={handleLicenseSubmit} isLoading={formLoading} />
              )}
              {activeForm === "vehicle" && (
                <VehicleRegistrationForm onSubmit={handleVehicleSubmit} isLoading={formLoading} />
              )}
              {activeForm === "insurance" && (
                <InsurancePolicyForm onSubmit={handleInsuranceSubmit} isLoading={formLoading} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
              >
                ← 社員選択に戻る
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-7 h-7 text-cyan-600" />
                代理申請
              </h1>
              <div className="mt-2 flex items-center gap-2 bg-cyan-50 px-4 py-2 rounded-lg">
                <User className="w-5 h-5 text-cyan-600" />
                <span className="font-medium text-cyan-800">
                  {selectedEmployee.employee_name}
                </span>
                <span className="text-cyan-600 text-sm">
                  （社員ID: {selectedEmployee.employee_id}）
                </span>
              </div>
            </div>
            <button
              onClick={fetchDocuments}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              更新
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          </div>
        ) : (
          <>
            {/* 申請カード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 免許証（1:1） */}
              <div
                onClick={() => !documents.license && setActiveForm("license")}
                className={`bg-white rounded-lg shadow p-6 ${!documents.license ? "hover:shadow-lg cursor-pointer" : ""} transition-shadow`}
              >
                <div className="flex items-center justify-between mb-4">
                  <FileText className="h-12 w-12 text-blue-600" />
                  {getStatusBadge(documents.license?.approval_status, !!documents.license)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">免許証</h3>
                <p className="text-xs text-gray-500 mb-2">1件まで登録可能</p>
                <p className="text-sm text-gray-600">
                  運転免許証の情報を登録してください
                </p>
                {!documents.license && (
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    申請する →
                  </div>
                )}
              </div>

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

                <button
                  onClick={() => setActiveForm("vehicle")}
                  className="w-full flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  追加
                </button>
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

                <button
                  onClick={() => setActiveForm("insurance")}
                  className="w-full flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  追加
                </button>
              </div>
            </div>

            {/* お知らせ */}
            <div className="mt-8 bg-cyan-50 border-l-4 border-cyan-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-cyan-800">
                    <strong>{selectedEmployee.employee_name}</strong> さんの代理として申請を行います。
                    登録されたデータは選択した社員のデータとして保存されます。
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ProxyApplicationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    }>
      <ProxyApplicationContent />
    </Suspense>
  );
}
