import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { getEmployee } from "@/lib/syaryo/services/employee.service";
import {
  createPermit,
  revokeExistingPermit,
  updatePermitFileKey,
} from "@/lib/syaryo/services/permit.service";
import { generatePermitPdf } from "@/lib/syaryo/services/pdf-generator.service";
import { calculatePermitExpiration } from "@/lib/syaryo/permit-utils";
import { checkInsuranceRequirements } from "@/lib/syaryo/validations/application";

/**
 * POST /api/permits/generate-for-employee
 * 特定の社員に対して許可証を手動発行（既に全書類が承認済みの場合）
 */
export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    const authCheck = await requireAdmin();
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const body = await request.json();
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json(
        { success: false, error: "employee_id is required" },
        { status: 400 }
      );
    }

    console.log(`[generate-for-employee] Starting for employee_id: ${employee_id}`);

    // 免許証を確認
    const licenses = await getDriversLicenses(employee_id);
    const approvedLicense = licenses.find((l) => l.approval_status === "approved");
    if (!approvedLicense) {
      return NextResponse.json(
        { success: false, error: "承認済みの免許証がありません" },
        { status: 400 }
      );
    }

    // 車検証を確認
    const vehicles = await getVehicleRegistrations(employee_id);
    const approvedVehicles = vehicles.filter((v) => v.approval_status === "approved");
    if (approvedVehicles.length === 0) {
      return NextResponse.json(
        { success: false, error: "承認済みの車検証がありません" },
        { status: 400 }
      );
    }

    // 保険証を確認
    const insurances = await getInsurancePolicies(employee_id);
    const approvedInsurance = insurances.find((i) => i.approval_status === "approved");
    if (!approvedInsurance) {
      return NextResponse.json(
        { success: false, error: "承認済みの保険証がありません" },
        { status: 400 }
      );
    }

    // 会社規定の保険条件チェック（対人無制限、対物5000万以上、搭乗者傷害2000万以上）
    const insuranceCheck = checkInsuranceRequirements({
      liability_personal_unlimited: approvedInsurance.liability_personal_unlimited,
      liability_property_amount: approvedInsurance.liability_property_amount || 0,
      passenger_injury_amount: approvedInsurance.passenger_injury_amount || 0,
    });
    if (!insuranceCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `保険が会社規定を満たしていません: ${insuranceCheck.errors.join("、")}`,
        },
        { status: 400 }
      );
    }

    // 社員情報を取得
    const employee = await getEmployee(employee_id);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "社員情報が見つかりません" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const generatedPermits: string[] = [];

    // 各車両に対して許可証を発行
    for (const vehicle of approvedVehicles) {
      try {
        console.log(`[generate-for-employee] Processing vehicle: ${vehicle.vehicle_number}`);

        // 既存の許可証があれば無効化
        await revokeExistingPermit(vehicle.id);

        // 有効期限を計算
        const expirationDate = calculatePermitExpiration(
          approvedLicense.expiration_date,
          vehicle.inspection_expiration_date,
          approvedInsurance.coverage_end_date
        );

        // 車両情報（車名・メーカー）を組み立て（null対応）
        const vehicleModelParts = [vehicle.manufacturer, vehicle.model_name].filter(Boolean);
        const vehicleModel = vehicleModelParts.length > 0 ? vehicleModelParts.join(" ") : "（未登録）";

        // 許可証を作成
        const permitData = {
          employee_id: employee_id,
          employee_name: employee.employee_name,
          vehicle_id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          vehicle_model: vehicleModel,
          manufacturer: vehicle.manufacturer || "",
          model_name: vehicle.model_name || "",
          expiration_date: expirationDate,
        };

        const permit = await createPermit(permitData, "");
        console.log(`[generate-for-employee] Permit created: ${permit.id}`);

        // PDFを生成
        const fileKey = await generatePermitPdf({
          employeeName: employee.employee_name,
          vehicleNumber: vehicle.vehicle_number,
          vehicleModel: vehicleModel,
          issueDate: new Date(),
          expirationDate,
          permitId: permit.id,
          verificationToken: permit.verification_token,
          baseUrl,
        });

        // 許可証のfile_keyを更新
        await updatePermitFileKey(permit.id, fileKey);
        console.log(`[generate-for-employee] PDF generated: ${fileKey}`);

        generatedPermits.push(vehicle.vehicle_number);
      } catch (error) {
        console.error(`[generate-for-employee] Error for vehicle ${vehicle.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${generatedPermits.length}件の許可証を発行しました`,
      permits: generatedPermits,
    });
  } catch (error) {
    console.error("[generate-for-employee] Error:", error);
    return NextResponse.json(
      { success: false, error: "許可証の発行に失敗しました" },
      { status: 500 }
    );
  }
}
