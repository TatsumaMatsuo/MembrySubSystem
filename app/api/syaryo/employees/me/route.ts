import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getEmployeeByEmail, getEmployeeByLarkId } from "@/lib/menu-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/syaryo/employees/me
 *
 * 現在のログインユーザーの社員情報を取得する。
 * email → Lark Open ID の順で社員マスタを検索する。
 *
 * 404 を返す場合は、原因切り分けのため診断情報 (diagnostic) を併せて返す:
 *   - reason:        no_session | no_lookup_keys | not_in_master
 *   - session_email: セッションの email（マスクなし。本人のみ閲覧可なので許容）
 *   - session_lark_id_present: Lark Open ID が JWT に含まれるか
 *   - tried:         email / lark_id どちらのルックアップを試みたか
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "ログインセッションが見つかりません。再ログインしてください。",
        diagnostic: { reason: "no_session" },
      },
      { status: 401 }
    );
  }

  const email = session.user.email || null;
  const larkId = (session.user as any).id || null;

  const tried: string[] = [];
  let employee = null;
  if (email) {
    tried.push("email");
    employee = await getEmployeeByEmail(email);
  }
  if (!employee && larkId) {
    tried.push("lark_id");
    employee = await getEmployeeByLarkId(larkId);
  }

  if (!employee) {
    const reason = tried.length === 0 ? "no_lookup_keys" : "not_in_master";
    console.warn("[syaryo/employees/me] Employee not found", {
      sessionEmail: email,
      sessionLarkIdPresent: !!larkId,
      tried,
      reason,
    });

    return NextResponse.json(
      {
        success: false,
        error: "社員情報が見つかりません。管理者にお問い合わせください。",
        diagnostic: {
          reason,
          session_email: email,
          session_lark_id_present: !!larkId,
          tried,
        },
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
