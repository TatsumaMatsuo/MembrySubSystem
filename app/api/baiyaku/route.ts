import { NextRequest, NextResponse } from "next/server";
import { searchBaiyakuInfo } from "@/services/baiyaku.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = searchParams.get("seiban") || undefined;
    const tantousha = searchParams.get("tantousha") || undefined;
    const anken_name = searchParams.get("anken_name") || undefined;
    const tokuisaki = searchParams.get("tokuisaki") || undefined;
    const juchu_date_from = searchParams.get("juchu_date_from") || undefined;
    const juchu_date_to = searchParams.get("juchu_date_to") || undefined;

    const results = await searchBaiyakuInfo({
      seiban,
      tantousha,
      anken_name,
      tokuisaki,
      juchu_date_from,
      juchu_date_to,
    });

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Error searching baiyaku:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "検索中にエラーが発生しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
