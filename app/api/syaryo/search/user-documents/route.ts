import { NextRequest, NextResponse } from "next/server";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { pickLatestActive } from "@/lib/syaryo/utils";

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

    // 表示すべき1件を選択。
    // 注: このテーブルには created_at 列が無く、取得時に既定値(new Date())が入るため
    // created_at ソートは実質無効。却下より最新アクティブを優先するロジックに統一する。
    const latestLicense = pickLatestActive(licenses);
    const latestVehicle = pickLatestActive(vehicles);
    const latestInsurance = pickLatestActive(insurances);

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
