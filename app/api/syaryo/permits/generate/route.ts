import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getCurrentUser } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { getEmployee } from "@/lib/syaryo/services/employee.service";
import {
  createPermit,
  revokeExistingPermit,
} from "@/lib/syaryo/services/permit.service";
import { generatePermitPdf } from "@/lib/syaryo/services/pdf-generator.service";
import { calculatePermitExpiration } from "@/lib/syaryo/permit-utils";
import { checkInsuranceRequirements } from "@/lib/syaryo/validations/application";

/**
 * POST /api/permits/generate
 * 許可証を生成（車両ごとに1枚）
 * body: { employee_id, vehicle_id }
 */
export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    const authCheck = await requireAdmin();
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const body = await request.json();
    const { employee_id, vehicle_id } = body;

    if (!employee_id || !vehicle_id) {
      return NextResponse.json(
        { success: false, error: "employee_id と vehicle_id は必須です" },
        { status: 400 }
      );
    }

    // 社員情報を取得
    const employee = await getEmployee(employee_id);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "社員情報が見つかりません" },
        { status: 404 }
      );
    }

    // 車検証情報を取得
    const vehicles = await getVehicleRegistrations(employee_id);
    const vehicle = vehicles.find((v) => v.id === vehicle_id);
    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "車検証情報が見つかりません" },
        { status: 404 }
      );
    }

    // 承認済みかチェック
    if (vehicle.approval_status !== "approved") {
      return NextResponse.json(
        { success: false, error: "車検証が承認されていません" },
        { status: 400 }
      );
    }

    // 免許証情報を取得（最新の承認済みのもの）
    const licenses = await getDriversLicenses(employee_id);
    const approvedLicense = licenses.find((l) => l.approval_status === "approved");
    if (!approvedLicense) {
      return NextResponse.json(
        { success: false, error: "承認済みの免許証がありません" },
        { status: 400 }
      );
    }

    // 保険証情報を取得（最新の承認済みのもの）
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

    // 有効期限を計算（3つの書類の最小値）
    const expirationDate = calculatePermitExpiration(
      approvedLicense.expiration_date,
      vehicle.inspection_expiration_date,
      approvedInsurance.coverage_end_date
    );

    // 既存の許可証があれば無効化
    await revokeExistingPermit(vehicle_id);

    // 車両情報（車名・メーカー）を組み立て（null対応）
    const vehicleModelParts = [vehicle.manufacturer, vehicle.model_name].filter(Boolean);
    const vehicleModel = vehicleModelParts.length > 0 ? vehicleModelParts.join(" ") : "（未登録）";

    // 許可証を作成（まずレコードを作成してIDを取得）
    const permitData = {
      employee_id,
      employee_name: employee.employee_name,
      vehicle_id,
      vehicle_number: vehicle.vehicle_number,
      vehicle_model: vehicleModel,
      manufacturer: vehicle.manufacturer || "",
      model_name: vehicle.model_name || "",
      expiration_date: expirationDate,
    };

    // 仮のfile_keyで許可証を作成
    const permit = await createPermit(permitData, "");

    // PDFを生成
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
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
    const { updatePermitFileKey } = await import("@/lib/syaryo/services/permit.service");
    await updatePermitFileKey(permit.id, fileKey);

    return NextResponse.json({
      success: true,
      permit: {
        ...permit,
        permit_file_key: fileKey,
      },
      message: "許可証を発行しました",
    });
  } catch (error) {
    console.error("許可証生成エラー:", error);
    return NextResponse.json(
      { success: false, error: "許可証の生成に失敗しました" },
      { status: 500 }
    );
  }
}
