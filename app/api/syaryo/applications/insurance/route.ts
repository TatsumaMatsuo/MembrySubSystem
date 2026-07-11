import { NextRequest, NextResponse } from "next/server";
import {
  getInsurancePolicies,
  createInsurancePolicy,
} from "@/lib/syaryo/services/insurance-policy.service";
import { notifyAdminsOfNewApplication } from "@/lib/syaryo/services/notify-admins";
import { requireAdmin, getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/applications/insurance
 * 任意保険証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 自分の保険証のみ閲覧可。他人分は管理者のみ。
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

    const policies = await getInsurancePolicies(employeeId);

    return NextResponse.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/insurance:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch insurance policies",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/insurance
 * 任意保険証を新規作成
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

    const policy = await createInsurancePolicy({
      employee_id: employeeId,
      policy_number: body.policy_number,
      insurance_company: body.insurance_company,
      policy_type: body.policy_type,
      coverage_start_date: new Date(body.coverage_start_date),
      coverage_end_date: new Date(body.coverage_end_date),
      insured_amount: body.insured_amount,
      // 補償内容フィールド
      liability_personal_unlimited: body.liability_personal_unlimited ?? false,
      liability_property_amount: body.liability_property_amount ?? 0,
      passenger_injury_amount: body.passenger_injury_amount ?? 0,
      image_attachment: body.image_attachment || null,
      status: "temporary",
      approval_status: "pending",
      deleted_flag: false,
    });

    // 管理者に Bot 通知
    const adminNotification = await notifyAdminsOfNewApplication(
      employeeId,
      "insurance",
      body.policy_number || ""
    );

    return NextResponse.json({
      success: true,
      data: policy,
      adminNotification,
    });
  } catch (error) {
    console.error("Error in POST /api/applications/insurance:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create insurance policy",
      },
      { status: 500 }
    );
  }
}
