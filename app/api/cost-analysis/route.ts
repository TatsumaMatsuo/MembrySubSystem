import { NextRequest, NextResponse } from "next/server";
import { getCostAnalysisBySeiban } from "@/services/cost-analysis.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seiban = searchParams.get("seiban");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番が指定されていません" },
      { status: 400 }
    );
  }

  try {
    const costAnalysisData = await getCostAnalysisBySeiban(seiban);

    if (!costAnalysisData) {
      return NextResponse.json(
        { success: false, error: "原価分析データの取得に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: costAnalysisData,
    });
  } catch (error) {
    console.error("Cost analysis error:", error);
    return NextResponse.json(
      { success: false, error: "原価分析データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
