import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { getActivePeriod, getProgress, listPeriods } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 進捗ダッシュボード（F-09）。生産管理部向け。
 *   GET /api/tanaoroshi/progress?period=<期ID>   （省略時は実施中の期）
 */
export async function GET(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;

  try {
    const periods = await listPeriods();
    let periodId = req.nextUrl.searchParams.get("period")?.trim() || "";
    if (!periodId) {
      const active = await getActivePeriod();
      periodId = active?.periodId || periods[0]?.periodId || "";
    }
    if (!periodId) return NextResponse.json({ success: true, periodId: "", periods, rows: [] });

    const rows = await getProgress(periodId);
    return NextResponse.json({ success: true, periodId, periods, rows });
  } catch (e: any) {
    console.error("[tanaoroshi/progress]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
