import { NextRequest, NextResponse } from "next/server";
import { runExpirationMonitor } from "@/lib/syaryo/services/expiration-monitor.job";

/**
 * GET /api/cron/expiration-check
 * 有効期限チェックのCronジョブエンドポイント
 * Vercel Cronまたは外部サービスから呼び出される
 */
export async function GET(request: NextRequest) {
  // Cron認証チェック
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRETが設定されている場合は認証をチェック
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Cron] Unauthorized access attempt");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  console.log(`[Cron] Starting expiration check at ${new Date().toISOString()}`);

  try {
    await runExpirationMonitor();

    console.log("[Cron] Expiration check completed successfully");

    return NextResponse.json({
      success: true,
      message: "Expiration check completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Expiration check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Expiration check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Vercel Cronの設定
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 最大60秒
