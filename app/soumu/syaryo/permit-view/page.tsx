"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

interface CompanyInfo {
  company_name: string;
  company_postal_code: string;
  company_address: string;
  issuing_department: string;
}

interface VehicleInfo {
  vehicle_number: string;
  vehicle_type: string;
  manufacturer: string;
  model_name: string;
  inspection_expiration_date: string;
  owner_name: string;
}

interface InsuranceInfo {
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  coverage_start_date: string;
  coverage_end_date: string;
  liability_personal_unlimited: boolean;
  liability_property_amount: number;
  passenger_injury_amount: number;
}

interface LicenseInfo {
  license_type: string;
  issue_date: string;
  expiration_date: string;
}

interface Permit {
  id: string;
  employee_name: string;
  employee_id: string;
  vehicle_number: string;
  vehicle_model?: string;
  manufacturer?: string;
  model_name?: string;
  issue_date: string;
  expiration_date: string;
  status: string;
  verification_token?: string;
  companyInfo?: CompanyInfo;
  vehicle?: VehicleInfo;
  insurance?: InsuranceInfo;
  license?: LicenseInfo;
}

function formatDate(dateValue: string | number | Date | null | undefined): string {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function PermitViewContent() {
  const searchParams = useSearchParams();
  const permitId = searchParams.get("id");
  const [permit, setPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) { setError("許可証IDが指定されていません"); setLoading(false); return; }
    fetch(`/api/syaryo/permits/${permitId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setPermit(data.data);
        else setError(data.error || "取得に失敗しました");
      })
      .catch(() => setError("通信エラー"))
      .finally(() => setLoading(false));
  }, [permitId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !permit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "許可証が見つかりません"}</p>
          <button onClick={() => history.back()} className="text-blue-600 hover:underline">戻る</button>
        </div>
      </div>
    );
  }

  const vehicleModel = permit.vehicle_model || `${permit.manufacturer || ""} ${permit.model_name || ""}`.trim() || "-";
  const isExpired = new Date(permit.expiration_date) < new Date();

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      {/* 操作バー（印刷時非表示） */}
      <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-4 print:hidden">
        <button onClick={() => history.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow"
        >
          <Printer className="w-4 h-4" />
          印刷 / PDF保存
        </button>
      </div>

      {/* 許可証本体 */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none" style={{ minHeight: "297mm", padding: "30px" }}>
        {/* ヘッダー */}
        <div style={{ borderBottom: "2px solid #1a365d", paddingBottom: 12, marginBottom: 15 }}>
          <h1 style={{ fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#1a365d", marginBottom: 4 }}>
            車両通勤許可証
          </h1>
          <p style={{ fontSize: 10, textAlign: "center", color: "#718096" }}>
            Vehicle Commuting Permit
          </p>
        </div>

        {/* コンテンツ */}
        <div style={{ display: "flex", gap: 20 }}>
          {/* 左側: 情報 */}
          <div style={{ flex: 1 }}>
            {/* 使用者情報 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                使用者情報
              </div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#718096", width: 80 }}>氏名</span>
                <span style={{ fontSize: 14, fontWeight: "bold", color: "#1a202c" }}>{permit.employee_name}</span>
              </div>
            </div>

            {/* 免許証情報 */}
            {permit.license && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                  運転免許証情報
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>免許種類</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.license.license_type || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>交付日</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{formatDate(permit.license.issue_date)}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>有効期限</span>
                  <span style={{ fontSize: 11, fontWeight: "bold", color: "#1a202c" }}>{formatDate(permit.license.expiration_date)}</span>
                </div>
              </div>
            )}

            {/* 車両情報 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                車両情報
              </div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#718096", width: 80 }}>車両番号</span>
                <span style={{ fontSize: 11, fontWeight: "bold", color: "#1a202c" }}>{permit.vehicle_number}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#718096", width: 80 }}>車種</span>
                <span style={{ fontSize: 11, fontWeight: "bold", color: "#1a202c" }}>{vehicleModel}</span>
              </div>
            </div>

            {/* 車検証情報 */}
            {permit.vehicle && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                  車検証情報
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>車両タイプ</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.vehicle.vehicle_type || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>所有者</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.vehicle.owner_name || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>車検有効期限</span>
                  <span style={{ fontSize: 11, fontWeight: "bold", color: "#1a202c" }}>{formatDate(permit.vehicle.inspection_expiration_date)}</span>
                </div>
              </div>
            )}

            {/* 任意保険情報 */}
            {permit.insurance && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                  任意保険情報
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>保険会社</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.insurance_company || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>証券番号</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.policy_number || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>保険種類</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.policy_type || "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>保険期間</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{formatDate(permit.insurance.coverage_start_date)} ～ {formatDate(permit.insurance.coverage_end_date)}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>対人補償</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.liability_personal_unlimited ? "無制限" : "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>対物補償</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.liability_property_amount ? `${permit.insurance.liability_property_amount.toLocaleString()}万円` : "-"}</span>
                </div>
                <div style={{ display: "flex", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#718096", width: 100 }}>搭乗者傷害</span>
                  <span style={{ fontSize: 11, color: "#1a202c" }}>{permit.insurance.passenger_injury_amount ? `${permit.insurance.passenger_injury_amount.toLocaleString()}万円` : "-"}</span>
                </div>
              </div>
            )}

            {/* 発行情報 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                許可情報
              </div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#718096", width: 100 }}>発行日</span>
                <span style={{ fontSize: 11, color: "#1a202c" }}>{formatDate(permit.issue_date)}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#718096", width: 100 }}>許可証番号</span>
                <span style={{ fontSize: 9, color: "#718096" }}>{permit.id}</span>
              </div>
            </div>

            {/* 有効期限 */}
            <div style={{
              backgroundColor: isExpired ? "#fed7d7" : "#fef5e7",
              padding: 10,
              borderRadius: 4,
              borderLeft: `3px solid ${isExpired ? "#e53e3e" : "#ed8936"}`,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: isExpired ? "#9b2c2c" : "#744210", marginBottom: 3 }}>
                有効期限 {isExpired && "（期限切れ）"}
              </div>
              <div style={{ fontSize: 16, fontWeight: "bold", color: isExpired ? "#e53e3e" : "#c05621" }}>
                {formatDate(permit.expiration_date)}
              </div>
            </div>
          </div>
        </div>

        {/* フッター: 発行者情報 */}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
          {permit.companyInfo && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 4 }}>発行者</div>
              <div style={{ fontSize: 11, fontWeight: "bold", color: "#1a202c" }}>
                {permit.companyInfo.company_name}
              </div>
              {permit.companyInfo.company_address && (
                <div style={{ fontSize: 9, color: "#4a5568", marginTop: 2 }}>
                  〒{permit.companyInfo.company_postal_code} {permit.companyInfo.company_address}
                </div>
              )}
              {permit.companyInfo.issuing_department && (
                <div style={{ fontSize: 9, color: "#4a5568", marginTop: 2 }}>
                  {permit.companyInfo.issuing_department}
                </div>
              )}
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <p style={{ fontSize: 9, color: "#718096" }}>
              この許可証は車両通勤を許可するものです
            </p>
            <p style={{ fontSize: 8, color: "#a0aec0", marginTop: 3 }}>
              許可証の偽造・改ざんは固く禁じます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PermitViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <PermitViewContent />
    </Suspense>
  );
}
