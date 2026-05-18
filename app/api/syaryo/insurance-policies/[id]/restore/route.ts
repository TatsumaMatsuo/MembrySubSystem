import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import { restoreInsurancePolicy } from "@/lib/syaryo/services/insurance-policy.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/insurance-policies/[id]/restore
 * 削除済み保険証を復元
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 管理者権限チェック
    const authCheck = await requireAdmin();
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "保険証IDが必要です" },
        { status: 400 }
      );
    }

    await restoreInsurancePolicy(id);

    return NextResponse.json({
      success: true,
      message: "保険証を復元しました",
    });
  } catch (error) {
    console.error("保険証復元エラー:", error);
    return NextResponse.json(
      { success: false, error: "保険証の復元に失敗しました" },
      { status: 500 }
    );
  }
}
