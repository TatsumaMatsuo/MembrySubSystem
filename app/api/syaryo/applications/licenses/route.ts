import { NextRequest, NextResponse } from "next/server";
import { getDriversLicenses, createDriversLicense } from "@/lib/syaryo/services/drivers-license.service";
import { notifyAdminsOfNewApplication } from "@/lib/syaryo/services/notify-admins";
import { requireAdmin, getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/applications/licenses
 * 免許証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 自分の免許証のみ閲覧可。他人分は管理者のみ。
    // (employeeId 未指定=全件 だと他人のPIIを列挙できたため本人に強制)
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

    const licenses = await getDriversLicenses(employeeId);

    return NextResponse.json({
      success: true,
      data: licenses,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/licenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch drivers licenses",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/licenses
 * 免許証を新規作成
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

    const license = await createDriversLicense({
      employee_id: employeeId,
      license_number: body.license_number,
      license_type: body.license_type,
      issue_date: new Date(body.issue_date),
      expiration_date: new Date(body.expiration_date),
      image_attachment: body.image_attachment || null,
      image_attachment_ura: body.image_attachment_ura || null,
      status: "temporary",
      approval_status: "pending",
      deleted_flag: false,
    });

    // 管理者に Bot 通知（失敗しても申請自体には影響させない）
    const adminNotification = await notifyAdminsOfNewApplication(
      employeeId,
      "license",
      body.license_number || ""
    );

    return NextResponse.json({
      success: true,
      data: license,
      adminNotification,
    });
  } catch (error) {
    console.error("Error in POST /api/applications/licenses:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create drivers license: ${message}`,
      },
      { status: 500 }
    );
  }
}
