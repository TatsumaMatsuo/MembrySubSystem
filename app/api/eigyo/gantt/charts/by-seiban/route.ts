import { NextRequest, NextResponse } from "next/server";
import { getChartBySeiban } from "@/lib/gantt/store";

// 製番に紐づくガント（社内工程表タブの表示用）。無ければ chart:null（#95）
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const seiban = request.nextUrl.searchParams.get("seiban") || "";
    if (!seiban) return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });
    const chart = await getChartBySeiban(seiban);
    return NextResponse.json({ success: true, chart });
  } catch (e: any) {
    console.error("[gantt/charts/by-seiban] error", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
