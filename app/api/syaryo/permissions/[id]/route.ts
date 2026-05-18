import { NextRequest, NextResponse } from "next/server";
import {
  updateUserPermission,
  deleteUserPermission,
} from "@/lib/syaryo/services/user-permission.service";
import { requireAdmin } from "@/lib/syaryo/auth-utils";

/**
 * PATCH /api/permissions/:id
 * 権限を更新（管理者のみ）
 */
export async function PATCH(
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

    await updateUserPermission(id, {
      role: body.role,
    });

    return NextResponse.json({
      success: true,
      message: "Permission updated successfully",
    });
  } catch (error) {
    console.error("Error in PATCH /api/permissions/:id:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update permission",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/permissions/:id
 * 権限を削除（管理者のみ）
 */
export async function DELETE(
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

    await deleteUserPermission(id);

    return NextResponse.json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/permissions/:id:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete permission",
      },
      { status: 500 }
    );
  }
}
