import { NextRequest, NextResponse } from "next/server";
import { retireEmployeeWithDocuments } from "@/lib/syaryo/services/employee.service";
import { requireAdmin } from "@/lib/syaryo/auth-utils";

/**
 * POST /api/employees/:id/retire
 * 社員を退職させる（管理者のみ）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const resignationDate = body.resignationDate
      ? new Date(body.resignationDate)
      : undefined;

    const result = await retireEmployeeWithDocuments(id, resignationDate);

    return NextResponse.json({
      success: true,
      message: "Employee retired successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/employees/:id/retire:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retire employee",
      },
      { status: 500 }
    );
  }
}
