import { NextRequest, NextResponse } from "next/server";
import { runExpirationMonitor } from "@/lib/syaryo/services/expiration-monitor.job";
import { safeStrEqual } from "@/lib/batch-auth";

/**
 * GET /api/cron/expiration-check
 * 有効期限チェックのCronジョブエンドポイント
 * Vercel Cronまたは外部サービスから呼び出される
 */
export async function GET(request: NextRequest) {
  // Cron認証チェック(fail-closed)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET未設定は「検証不能」= fail-closed(未設定時に検証スキップすると
  // 誰でもこのエンドポイントを叩けるオープンなCronになるため拒否する)。
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET 未設定のため認証を拒否します");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!safeStrEqual(authHeader || "", `Bearer ${cronSecret}`)) {
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
