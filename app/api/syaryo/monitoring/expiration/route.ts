import { NextRequest, NextResponse } from "next/server";
import { getExpirationSummary } from "@/lib/syaryo/services/expiration.service";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/monitoring/expiration
 * 有効期限のサマリー情報を取得（管理者・閲覧者のみ）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const summary = await getExpirationSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error in GET /api/monitoring/expiration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expiration summary",
      },
      { status: 500 }
    );
  }
}
