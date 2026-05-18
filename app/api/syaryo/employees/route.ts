import { NextRequest, NextResponse } from "next/server";
import { getEmployees } from "@/lib/syaryo/services/employee.service";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/employees
 * 社員一覧を取得（管理者・閲覧者のみ）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const includeResigned = searchParams.get("includeResigned") === "true";

    const employees = await getEmployees(includeResigned);

    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Error in GET /api/employees:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch employees",
      },
      { status: 500 }
    );
  }
}
