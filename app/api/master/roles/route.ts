import { NextRequest, NextResponse } from "next/server";
import { getRoles, createRole } from "@/services/permission.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roles = await getRoles();

    return NextResponse.json({
      success: true,
      data: roles,
      total: roles.length,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "ロールマスタの取得に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const role = await createRole({
      ロールID: body.ロールID,
      ロール名: body.ロール名,
      説明: body.説明,
      有効フラグ: body.有効フラグ ?? true,
    });

    return NextResponse.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "ロールマスタの作成に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
