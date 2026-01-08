import { NextRequest, NextResponse } from "next/server";
import { getQualityIssuesBySeiban } from "@/services/quality-issues.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = searchParams.get("seiban");

    if (!seiban) {
      return NextResponse.json(
        { success: false, error: "製番は必須です" },
        { status: 400 }
      );
    }

    const results = await getQualityIssuesBySeiban(seiban);

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Error fetching quality issues:", error);
    return NextResponse.json(
      { success: false, error: "データ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
