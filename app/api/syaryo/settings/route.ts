import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireViewPermission, getCurrentLarkUserId } from "@/lib/syaryo/auth-utils";
import { getSystemSettings, updateSystemSettings } from "@/lib/syaryo/services/system-settings.service";

/**
 * GET /api/settings
 * システム設定を取得（閲覧権限以上）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const settings = await getSystemSettings();

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in GET /api/settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * システム設定を更新（管理者のみ）
 */
export async function PUT(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const body = await request.json();
    const userId = await getCurrentLarkUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 401 }
      );
    }

    await updateSystemSettings(body, userId);

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
