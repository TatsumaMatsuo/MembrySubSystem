import { NextRequest, NextResponse } from "next/server";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";

/**
 * GET /api/search/user-documents
 * 特定ユーザーの最新書類を取得（管理者・閲覧者のみ）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: "employee_id is required",
        },
        { status: 400 }
      );
    }

    // 各書類を並行取得
    const [licenses, vehicles, insurances] = await Promise.all([
      getDriversLicenses(employeeId),
      getVehicleRegistrations(employeeId),
      getInsurancePolicies(employeeId),
    ]);

    // 最新の書類のみ取得（created_atでソート）
    const latestLicense = licenses.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;

    const latestVehicle = vehicles.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;

    const latestInsurance = insurances.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        license: latestLicense,
        vehicle: latestVehicle,
        insurance: latestInsurance,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/search/user-documents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user documents",
      },
      { status: 500 }
    );
  }
}
