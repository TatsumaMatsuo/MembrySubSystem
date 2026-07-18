import { NextRequest, NextResponse } from "next/server";
import { getChart } from "@/lib/gantt/store";

// ガントチャート 1件取得（#95）
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const chart = await getChart(params.id);
    if (!chart) return NextResponse.json({ success: false, error: "チャートが見つかりません" }, { status: 404 });
    return NextResponse.json({ success: true, chart });
  } catch (e: any) {
    console.error("[gantt/charts/:id] GET error", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
