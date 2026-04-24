import { NextRequest, NextResponse } from "next/server";
import {
  getInsurancePolicies,
  createInsurancePolicy,
} from "@/lib/syaryo/services/insurance-policy.service";

/**
 * GET /api/applications/insurance
 * 任意保険証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId") || undefined;

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

    const policy = await createInsurancePolicy({
      employee_id: body.employee_id,
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

    return NextResponse.json({
      success: true,
      data: policy,
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
