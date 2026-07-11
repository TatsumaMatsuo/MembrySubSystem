import { NextRequest, NextResponse } from "next/server";
import {
  getVehicleRegistrations,
  createVehicleRegistration,
} from "@/lib/syaryo/services/vehicle-registration.service";
import { notifyAdminsOfNewApplication } from "@/lib/syaryo/services/notify-admins";
import { requireAdmin, getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/applications/vehicles
 * 車検証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 自分の車検証のみ閲覧可。他人分は管理者のみ。
    const me = await getCurrentEmployeeInfo();
    const param = request.nextUrl.searchParams.get("employeeId") || undefined;
    let employeeId = me?.employeeId;
    if (param && param !== me?.employeeId) {
      const admin = await requireAdmin();
      if (!admin.authorized) return admin.response;
      employeeId = param;
    }
    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "社員情報が解決できませんでした" },
        { status: 403 }
      );
    }

    const vehicles = await getVehicleRegistrations(employeeId);

    return NextResponse.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/vehicles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch vehicle registrations",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/vehicles
 * 車検証を新規作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 申請名義は本人に強制。他人名義(代理申請)は管理者のみ。IDOR対策。
    const me = await getCurrentEmployeeInfo();
    if (!me?.employeeId) {
      return NextResponse.json(
        { success: false, error: "社員情報が解決できませんでした" },
        { status: 403 }
      );
    }
    let employeeId = me.employeeId;
    if (body.employee_id && body.employee_id !== me.employeeId) {
      const admin = await requireAdmin();
      if (!admin.authorized) return admin.response;
      employeeId = body.employee_id;
    }

    console.log(`[vehicles API] Creating vehicle with employee_id: ${employeeId}`);

    const vehicle = await createVehicleRegistration({
      employee_id: employeeId,
      vehicle_number: body.vehicle_number,
      vehicle_type: body.vehicle_type,
      manufacturer: body.manufacturer,
      model_name: body.model_name,
      inspection_expiration_date: new Date(body.inspection_expiration_date),
      owner_name: body.owner_name,
      image_attachment: body.image_attachment || null,
      status: "temporary",
      approval_status: "pending",
      deleted_flag: false,
    });

    // 管理者に Bot 通知
    const adminNotification = await notifyAdminsOfNewApplication(
      employeeId,
      "vehicle",
      body.vehicle_number || ""
    );

    return NextResponse.json({
      success: true,
      data: vehicle,
      adminNotification,
    });
  } catch (error) {
    console.error("Error in POST /api/applications/vehicles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create vehicle registration",
      },
      { status: 500 }
    );
  }
}
