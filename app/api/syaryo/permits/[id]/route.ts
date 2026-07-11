import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireViewPermission, getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";
import { getPermitById } from "@/lib/syaryo/services/permit.service";
import { getCompanyInfo } from "@/lib/syaryo/services/system-settings.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuth();
  if (!authCheck.authorized) return authCheck.response;

  const { id } = await params;
  const [permit, companyInfo] = await Promise.all([
    getPermitById(id),
    getCompanyInfo(),
  ]);
  if (!permit) {
    return NextResponse.json({ success: false, error: "許可証が見つかりません" }, { status: 404 });
  }

  // 本人の許可証以外は管理者(閲覧権限)のみ。任意IDで他人の許可証PDFを参照できたIDOR対策。
  const me = await getCurrentEmployeeInfo();
  if (permit.employee_id !== me?.employeeId) {
    const view = await requireViewPermission();
    if (!view.authorized) return view.response;
  }

  // 車検証・保険・免許証情報を並列取得
  const [vehicles, insurances, licenses] = await Promise.all([
    getVehicleRegistrations(permit.employee_id),
    getInsurancePolicies(permit.employee_id),
    getDriversLicenses(permit.employee_id),
  ]);

  const vehicle = vehicles.find(v => v.id === permit.vehicle_id || v.vehicle_number === permit.vehicle_number);
  const insurance = insurances.length > 0 ? insurances[0] : null;
  const license = licenses.length > 0 ? { ...licenses[0], license_number: undefined } : null;

  return NextResponse.json({
    success: true,
    data: { ...permit, companyInfo, vehicle, insurance, license },
  });
}
