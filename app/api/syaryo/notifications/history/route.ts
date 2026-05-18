import { NextRequest, NextResponse } from "next/server";
import { getNotificationHistory } from "@/lib/syaryo/services/notification-history.service";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/notifications/history
 * 通知履歴を取得（管理者・閲覧者のみ）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const recipientId = searchParams.get("recipientId") || undefined;

    const history = await getNotificationHistory(recipientId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error in GET /api/notifications/history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch notification history",
      },
      { status: 500 }
    );
  }
}
