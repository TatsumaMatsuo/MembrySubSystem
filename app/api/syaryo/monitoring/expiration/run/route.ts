import { NextRequest, NextResponse } from "next/server";
import { runExpirationMonitor } from "@/lib/syaryo/services/expiration-monitor.job";
import { requireAdmin } from "@/lib/syaryo/auth-utils";

/**
 * POST /api/monitoring/run-check
 * 有効期限チェックを手動で実行（管理者のみ）
 */
export async function POST(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  console.log(
    `[ManualCheck] Admin ${authCheck.userId} triggered expiration check at ${new Date().toISOString()}`
  );

  try {
    await runExpirationMonitor();

    return NextResponse.json({
      success: true,
      message: "有効期限チェックが完了しました",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ManualCheck] Expiration check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "有効期限チェックに失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
