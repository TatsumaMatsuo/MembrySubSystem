import { NextRequest, NextResponse } from "next/server";
import { getEmployeeByEmail } from "@/lib/syaryo/services/employee.service";
import { getServerSession } from "@/lib/auth-server";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";

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

    // 自分のメール以外での照会は管理者(閲覧権限)のみ。
    // 任意メールで他人の社員情報(社員番号・部署等PII)を取得できたIDOR対策。
    const ownEmail = session.user.email || null;
    if (!ownEmail || email.toLowerCase() !== ownEmail.toLowerCase()) {
      const view = await requireViewPermission();
      if (!view.authorized) return view.response;
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
