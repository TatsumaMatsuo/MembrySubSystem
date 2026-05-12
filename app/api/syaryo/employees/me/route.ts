import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/syaryo/employees/me
 *
 * 現在のログインユーザーの社員情報を取得する。
 * 内部実装は auth-utils.ts の getCurrentEmployeeInfo() に委譲
 * （email → Lark Open ID フォールバック付き）。
 */
export async function GET(_request: NextRequest) {
  const employee = await getCurrentEmployeeInfo();

  if (!employee) {
    return NextResponse.json(
      {
        success: false,
        error: "社員情報が見つかりません。管理者にお問い合わせください。",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      employee_id: employee.employeeId,
      employee_name: employee.employeeName,
      email: employee.email,
      department: employee.department,
    },
  });
}
