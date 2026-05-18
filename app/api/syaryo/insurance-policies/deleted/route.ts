import { NextRequest, NextResponse } from "next/server";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";
import { getDeletedInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";

/**
 * GET /api/insurance-policies/deleted
 * 削除済み保険証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 管理者権限チェック
    const authCheck = await requireViewPermission();
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    const policies = await getDeletedInsurancePolicies(employeeId || undefined);

    return NextResponse.json({
      success: true,
      policies,
      count: policies.length,
    });
  } catch (error) {
    console.error("削除済み保険証取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "削除済み保険証の取得に失敗しました" },
      { status: 500 }
    );
  }
}
