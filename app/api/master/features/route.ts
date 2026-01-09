import { NextRequest, NextResponse } from "next/server";
import { getFeatures, createFeature } from "@/services/permission.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const features = await getFeatures();

    return NextResponse.json({
      success: true,
      data: features,
      total: features.length,
    });
  } catch (error) {
    console.error("Error fetching features:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "機能マスタの取得に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const feature = await createFeature({
      機能ID: body.機能ID,
      機能名: body.機能名,
      所属メニューグループ: body.所属メニューグループ,
      機能タイプ: body.機能タイプ,
      親機能ID: body.親機能ID,
      表示順: body.表示順 || 0,
      機能説明: body.機能説明,
      有効フラグ: body.有効フラグ ?? true,
    });

    return NextResponse.json({
      success: true,
      data: feature,
    });
  } catch (error) {
    console.error("Error creating feature:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "機能マスタの作成に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
