import { NextRequest, NextResponse } from "next/server";
import { getBaiyakuBySeiban } from "@/services/baiyaku.service";
import { generateGanttChartData } from "@/services/gantt.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = searchParams.get("seiban");

    if (!seiban) {
      return NextResponse.json(
        { success: false, error: "製番が指定されていません" },
        { status: 400 }
      );
    }

    const baiyaku = await getBaiyakuBySeiban(seiban);

    if (!baiyaku) {
      return NextResponse.json(
        { success: false, error: "売約情報が見つかりません" },
        { status: 404 }
      );
    }

    const ganttData = generateGanttChartData(baiyaku);

    return NextResponse.json({
      success: true,
      data: ganttData,
    });
  } catch (error) {
    console.error("Error fetching gantt data:", error);
    return NextResponse.json(
      { success: false, error: "ガントチャートデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
