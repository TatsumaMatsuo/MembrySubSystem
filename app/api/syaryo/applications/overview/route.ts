import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationOverview,
  getPendingApplications,
  getApprovedApplications,
} from "@/lib/syaryo/services/application.service";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/applications/overview
 * 申請の統合ビューを取得（管理者・閲覧者のみ）
 *
 * Query Parameters:
 * - employeeId: 社員ID（オプション）
 * - filter: "pending" | "approved" | "all"（デフォルト: "all"）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId") || undefined;
    const filter = searchParams.get("filter") || "all";

    let applications;

    switch (filter) {
      case "pending":
        applications = await getPendingApplications();
        break;
      case "approved":
        applications = await getApprovedApplications();
        break;
      default:
        applications = await getApplicationOverview(employeeId);
    }

    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/overview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch application overview",
      },
      { status: 500 }
    );
  }
}
