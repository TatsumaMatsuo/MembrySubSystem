import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getAllPermissionsForUser } from "@/services/permission.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("user_email");
    const featureId = searchParams.get("feature_id");

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "user_email パラメータは必須です",
        },
        { status: 400 }
      );
    }

    // 特定の機能の権限チェック
    if (featureId) {
      const result = await checkPermission(userEmail, featureId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // 全機能の権限を取得
    const results = await getAllPermissionsForUser(userEmail);
    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Error checking permission:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "権限チェックに失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
