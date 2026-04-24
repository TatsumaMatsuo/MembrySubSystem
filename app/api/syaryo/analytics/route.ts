import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { getApprovalHistory } from "@/lib/syaryo/services/approval-history.service";
import { getEmployees } from "@/lib/syaryo/services/employee.service";

interface AnalyticsSummary {
  // 申請状況サマリー
  applications: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    approvalRate: number;
  };
  // 書類種別ごとの件数
  byType: {
    licenses: { total: number; approved: number; pending: number; rejected: number };
    vehicles: { total: number; approved: number; pending: number; rejected: number };
    insurance: { total: number; approved: number; pending: number; rejected: number };
  };
  // 月別申請トレンド（過去6ヶ月）
  monthlyTrend: {
    month: string;
    approved: number;
    rejected: number;
  }[];
  // 部署別申請状況
  byDepartment: {
    department: string;
    total: number;
    approved: number;
    pending: number;
  }[];
  // 有効期限アラート
  expirationAlerts: {
    expiringSoon: number; // 30日以内
    expired: number;
  };
}

/**
 * ステータスをカウント
 */
function countByStatus(items: { approval_status: string }[]) {
  return {
    total: items.length,
    approved: items.filter(i => i.approval_status === "approved").length,
    pending: items.filter(i => i.approval_status === "pending").length,
    rejected: items.filter(i => i.approval_status === "rejected").length,
  };
}

/**
 * 月別トレンドを計算
 */
function calculateMonthlyTrend(history: any[]): AnalyticsSummary["monthlyTrend"] {
  const months: Map<string, { approved: number; rejected: number }> = new Map();

  // 過去6ヶ月分のキーを初期化
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, { approved: 0, rejected: 0 });
  }

  // 履歴を集計
  history.forEach(record => {
    const date = new Date(record.timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (months.has(key)) {
      const current = months.get(key)!;
      if (record.action === "approved") {
        current.approved++;
      } else if (record.action === "rejected") {
        current.rejected++;
      }
    }
  });

  return Array.from(months.entries()).map(([month, data]) => ({
    month,
    ...data,
  }));
}

/**
 * 部署別の申請状況を計算
 */
async function calculateByDepartment(
  employees: any[],
  licenses: any[],
  vehicles: any[],
  insurances: any[]
): Promise<AnalyticsSummary["byDepartment"]> {
  const departmentMap: Map<string, { total: number; approved: number; pending: number }> = new Map();

  // 社員IDから部署へのマッピングを作成
  const employeeDeptMap: Map<string, string> = new Map();
  employees.forEach(emp => {
    employeeDeptMap.set(emp.employee_id, emp.department || "未設定");
  });

  // 各書類の部署を集計
  const allDocs = [
    ...licenses.map(l => ({ employee_id: l.employee_id, status: l.approval_status })),
    ...vehicles.map(v => ({ employee_id: v.employee_id, status: v.approval_status })),
    ...insurances.map(i => ({ employee_id: i.employee_id, status: i.approval_status })),
  ];

  allDocs.forEach(doc => {
    const dept = employeeDeptMap.get(doc.employee_id) || "未設定";

    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, { total: 0, approved: 0, pending: 0 });
    }

    const current = departmentMap.get(dept)!;
    current.total++;
    if (doc.status === "approved") current.approved++;
    if (doc.status === "pending") current.pending++;
  });

  return Array.from(departmentMap.entries())
    .map(([department, data]) => ({ department, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // 上位10部署
}

/**
 * 有効期限アラートを計算
 */
function calculateExpirationAlerts(
  licenses: any[],
  vehicles: any[],
  insurances: any[]
): AnalyticsSummary["expirationAlerts"] {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let expiringSoon = 0;
  let expired = 0;

  // 免許証
  licenses.filter(l => l.approval_status === "approved").forEach(license => {
    const expDate = new Date(license.expiration_date);
    if (expDate < now) expired++;
    else if (expDate < thirtyDaysLater) expiringSoon++;
  });

  // 車検証
  vehicles.filter(v => v.approval_status === "approved").forEach(vehicle => {
    const expDate = new Date(vehicle.inspection_expiration_date);
    if (expDate < now) expired++;
    else if (expDate < thirtyDaysLater) expiringSoon++;
  });

  // 保険
  insurances.filter(i => i.approval_status === "approved").forEach(insurance => {
    const expDate = new Date(insurance.coverage_end_date);
    if (expDate < now) expired++;
    else if (expDate < thirtyDaysLater) expiringSoon++;
  });

  return { expiringSoon, expired };
}

/**
 * GET /api/analytics
 * 分析データを取得
 */
export async function GET(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    // データを並行取得
    const [licenses, vehicles, insurances, history, employees] = await Promise.all([
      getDriversLicenses(),
      getVehicleRegistrations(),
      getInsurancePolicies(),
      getApprovalHistory(),
      getEmployees(),
    ]);

    // 書類種別ごとのステータス集計
    const licenseStats = countByStatus(licenses);
    const vehicleStats = countByStatus(vehicles);
    const insuranceStats = countByStatus(insurances);

    // 全体の集計
    const totalApproved = licenseStats.approved + vehicleStats.approved + insuranceStats.approved;
    const totalPending = licenseStats.pending + vehicleStats.pending + insuranceStats.pending;
    const totalRejected = licenseStats.rejected + vehicleStats.rejected + insuranceStats.rejected;
    const totalAll = totalApproved + totalPending + totalRejected;

    const analytics: AnalyticsSummary = {
      applications: {
        total: totalAll,
        approved: totalApproved,
        pending: totalPending,
        rejected: totalRejected,
        approvalRate: totalAll > 0 ? Math.round((totalApproved / (totalApproved + totalRejected)) * 100) : 0,
      },
      byType: {
        licenses: licenseStats,
        vehicles: vehicleStats,
        insurance: insuranceStats,
      },
      monthlyTrend: calculateMonthlyTrend(history),
      byDepartment: await calculateByDepartment(employees, licenses, vehicles, insurances),
      expirationAlerts: calculateExpirationAlerts(licenses, vehicles, insurances),
    };

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { success: false, error: "分析データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
