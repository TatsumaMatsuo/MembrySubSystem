import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/syaryo/auth-utils";
import { getPermitById } from "@/lib/syaryo/services/permit.service";
import { getCompanyInfo } from "@/lib/syaryo/services/system-settings.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";

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

  // 車検証・保険情報を並列取得
  const [vehicles, insurances] = await Promise.all([
    getVehicleRegistrations(permit.employee_id),
    getInsurancePolicies(permit.employee_id),
  ]);

  const vehicle = vehicles.find(v => v.id === permit.vehicle_id || v.vehicle_number === permit.vehicle_number);
  const insurance = insurances.length > 0 ? insurances[0] : null;

  return NextResponse.json({
    success: true,
    data: { ...permit, companyInfo, vehicle, insurance },
  });
}
