import { NextRequest, NextResponse } from "next/server";
import { reactivateEmployee } from "@/lib/syaryo/services/employee.service";
import { requireAdmin } from "@/lib/syaryo/auth-utils";

/**
 * POST /api/employees/:id/reactivate
 * 社員を復職させる（管理者のみ）
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

    await reactivateEmployee(id);

    return NextResponse.json({
      success: true,
      message: "Employee reactivated successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/employees/:id/reactivate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reactivate employee",
      },
      { status: 500 }
    );
  }
}
