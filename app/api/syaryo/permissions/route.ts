import { NextRequest, NextResponse } from "next/server";
import {
  getUserPermissions,
  createUserPermission,
} from "@/lib/syaryo/services/user-permission.service";
import { requireAdmin } from "@/lib/syaryo/auth-utils";

/**
 * GET /api/permissions
 * 全ての権限を取得（管理者のみ）
 */
export async function GET(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const permissions = await getUserPermissions();

    return NextResponse.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error("Error in GET /api/permissions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch permissions",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions
 * 権限を作成（管理者のみ）
 */
export async function POST(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const body = await request.json();

    // 権限を付与したユーザーIDを記録
    const currentUserId = authCheck.userId || "system";

    const permission = await createUserPermission({
      lark_user_id: body.lark_user_id,
      user_name: body.user_name,
      user_email: body.user_email,
      role: body.role,
      granted_by: currentUserId,
    });

    return NextResponse.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error("Error in POST /api/permissions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create permission",
      },
      { status: 500 }
    );
  }
}
