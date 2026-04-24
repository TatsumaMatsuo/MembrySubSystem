import { NextRequest, NextResponse } from "next/server";
import { getEmployeeByEmail } from "@/lib/syaryo/services/employee.service";
import { getServerSession } from "@/lib/auth-server";

/**
 * GET /api/employees/by-email?email=xxx
 * メールアドレスから社員情報を取得（ログインユーザーのみ）
 */
export async function GET(request: NextRequest) {
  // 認証チェック（ログインユーザーのみ）
  const session = await getServerSession();
  if (!session || !session.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const employee = await getEmployeeByEmail(email);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Error in GET /api/employees/by-email:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch employee",
      },
      { status: 500 }
    );
  }
}
