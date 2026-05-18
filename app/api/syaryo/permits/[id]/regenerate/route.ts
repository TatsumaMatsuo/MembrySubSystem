import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import { getPermitById, updatePermitFileKey } from "@/lib/syaryo/services/permit.service";
import { generatePermitPdf } from "@/lib/syaryo/services/pdf-generator.service";
import { getEmployee } from "@/lib/syaryo/services/employee.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";

/**
 * POST /api/permits/[id]/regenerate
 * 許可証PDFを再生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 管理者権限チェック
    const authCheck = await requireAdmin();
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;

    // 許可証を取得
    const permit = await getPermitById(id);
    if (!permit) {
      return NextResponse.json(
        { success: false, error: "許可証が見つかりません" },
        { status: 404 }
      );
    }

    // 社員名を取得（permitに保存されている値が不正な場合は社員マスタから取得）
    let employeeName = permit.employee_name;
    if (!employeeName || employeeName === "[object Object]") {
      const employee = await getEmployee(permit.employee_id);
      if (employee) {
        employeeName = employee.employee_name;
      }
    }

    // 車両情報を取得（permitに保存されている値が不正な場合は車検証から取得）
    let vehicleNumber = permit.vehicle_number;
    let vehicleModel = permit.vehicle_model;
    if (!vehicleModel || vehicleModel === "null null" || vehicleModel.includes("undefined") || vehicleModel === "（未登録）") {
      const vehicles = await getVehicleRegistrations(permit.employee_id);
      const vehicle = vehicles.find(v => v.id === permit.vehicle_id) || vehicles[0];
      if (vehicle) {
        vehicleNumber = vehicle.vehicle_number || vehicleNumber;
        // 車名・メーカーを組み立て（null対応）
        const modelParts = [vehicle.manufacturer, vehicle.model_name].filter(Boolean);
        vehicleModel = modelParts.length > 0 ? modelParts.join(" ") : "（未登録）";
      }
    }

    // 日付を確実に有効なDateオブジェクトに変換（Invalid Date対策）
    const parseDate = (dateValue: Date | string | number | undefined | null, fallback: Date): Date => {
      if (!dateValue) return fallback;
      const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
      return isNaN(parsed.getTime()) ? fallback : parsed;
    };

    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const issueDate = parseDate(permit.issue_date, now);
    const expirationDate = parseDate(permit.expiration_date, oneYearLater);

    // verificationTokenが空の場合はpermitIdを使用
    const verificationToken = permit.verification_token || permit.id;

    // PDFを再生成
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const fileKey = await generatePermitPdf({
      employeeName: employeeName || "不明",
      vehicleNumber: vehicleNumber || "不明",
      vehicleModel: vehicleModel || "不明",
      issueDate,
      expirationDate,
      permitId: permit.id,
      verificationToken,
      baseUrl,
    });

    // file_keyを更新
    await updatePermitFileKey(id, fileKey);

    return NextResponse.json({
      success: true,
      message: "許可証PDFを再生成しました",
      file_key: fileKey,
    });
  } catch (error) {
    console.error("許可証再生成エラー:", error);
    return NextResponse.json(
      { success: false, error: "許可証PDFの再生成に失敗しました" },
      { status: 500 }
    );
  }
}
