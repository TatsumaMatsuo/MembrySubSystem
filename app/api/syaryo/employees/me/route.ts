import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getBaseRecords } from "@/lib/syaryo/lark-client";
import { USER_SEARCH_TABLE_ID, EMPLOYEE_MASTER_FIELDS } from "@/lib/syaryo/lark-tables";

export const dynamic = "force-dynamic";

/**
 * GET /api/syaryo/employees/me
 *
 * 現在のログインユーザーの社員情報を取得する。
 * セッションのemailを優先、空ならLark Open IDで社員マスタを検索（メンバーフィールドid照合）。
 *
 * Lark OIDCがemailを返さないケースに備えたフォールバック機構を持つ。
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const sessionEmail = (session.user.email || "").toLowerCase().trim();
  const sessionLarkId = (session.user as any).id || "";

  if (!sessionEmail && !sessionLarkId) {
    return NextResponse.json(
      { success: false, error: "セッションにemail/Lark IDが含まれていません" },
      { status: 400 }
    );
  }

  try {
    // 社員マスタを全件取得（数百件程度を想定）
    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      pageSize: 500,
    });

    if (!response.data?.items) {
      return NextResponse.json(
        { success: false, error: "社員マスタを取得できませんでした" },
        { status: 500 }
      );
    }

    const items = response.data.items;

    // 1) email でマッチ
    let matched: any = null;
    if (sessionEmail) {
      matched = items.find((item: any) => {
        const peopleField = item.fields?.[EMPLOYEE_MASTER_FIELDS.people_field];
        const peopleEmail =
          Array.isArray(peopleField) && peopleField[0]?.email
            ? String(peopleField[0].email)
            : typeof peopleField === "object" && peopleField?.email
              ? String(peopleField.email)
              : "";
        const directEmail = String(item.fields?.[EMPLOYEE_MASTER_FIELDS.email] || "");
        const itemEmail = (peopleEmail || directEmail).toLowerCase().trim();
        return itemEmail && itemEmail === sessionEmail;
      });
    }

    // 2) Lark Open ID でマッチ（メンバーフィールド内の id 配列）
    if (!matched && sessionLarkId) {
      matched = items.find((item: any) => {
        const peopleField = item.fields?.[EMPLOYEE_MASTER_FIELDS.people_field];
        if (Array.isArray(peopleField)) {
          return peopleField.some((m: any) => m?.id === sessionLarkId);
        }
        if (typeof peopleField === "object" && peopleField) {
          return peopleField.id === sessionLarkId;
        }
        return false;
      });
    }

    if (!matched) {
      return NextResponse.json(
        {
          success: false,
          error: "社員情報が見つかりません。管理者にお問い合わせください。",
          debug: {
            hasEmail: !!sessionEmail,
            hasLarkId: !!sessionLarkId,
          },
        },
        { status: 404 }
      );
    }

    // レスポンス整形
    const directName = matched.fields?.[EMPLOYEE_MASTER_FIELDS.employee_name];
    const peopleField = matched.fields?.[EMPLOYEE_MASTER_FIELDS.people_field];
    const peopleName =
      Array.isArray(peopleField) && peopleField[0]?.name
        ? String(peopleField[0].name)
        : typeof peopleField === "object" && peopleField?.name
          ? String(peopleField.name)
          : "";
    const employeeName = String(directName || peopleName || "");

    const peopleEmail =
      Array.isArray(peopleField) && peopleField[0]?.email
        ? String(peopleField[0].email)
        : typeof peopleField === "object" && peopleField?.email
          ? String(peopleField.email)
          : "";
    const directEmail = matched.fields?.[EMPLOYEE_MASTER_FIELDS.email];
    const employeeEmail = String(peopleEmail || directEmail || "");

    const department = matched.fields?.[EMPLOYEE_MASTER_FIELDS.department];
    const departmentVal = Array.isArray(department) ? department[0] : department;
    const departmentStr =
      typeof departmentVal === "string" ? departmentVal : String(departmentVal || "");

    return NextResponse.json({
      success: true,
      data: {
        employee_id: String(matched.fields?.[EMPLOYEE_MASTER_FIELDS.employee_id] || ""),
        employee_name: employeeName,
        email: employeeEmail,
        department: departmentStr,
      },
    });
  } catch (error) {
    console.error("[/api/syaryo/employees/me] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}
