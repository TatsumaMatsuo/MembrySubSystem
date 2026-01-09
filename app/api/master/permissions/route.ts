import { NextRequest, NextResponse } from "next/server";
import {
  getUserPermissions,
  createUserPermission,
  updateUserPermission,
} from "@/services/permission.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("user_email") || undefined;

    const permissions = await getUserPermissions(userEmail);

    return NextResponse.json({
      success: true,
      data: permissions,
      total: permissions.length,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "ユーザー権限の取得に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const permission = await createUserPermission({
      ユーザーメール: body.ユーザーメール,
      ユーザー名: body.ユーザー名,
      対象機能: body.対象機能,
      権限レベル: body.権限レベル,
      付与者: body.付与者,
      付与日時: body.付与日時 || Date.now(),
      有効期限: body.有効期限,
      備考: body.備考,
    });

    return NextResponse.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "ユーザー権限の作成に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { record_id, ...updateData } = body;

    if (!record_id) {
      return NextResponse.json(
        {
          success: false,
          error: "record_id は必須です",
        },
        { status: 400 }
      );
    }

    await updateUserPermission(record_id, updateData);

    return NextResponse.json({
      success: true,
      message: "権限を更新しました",
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "ユーザー権限の更新に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
