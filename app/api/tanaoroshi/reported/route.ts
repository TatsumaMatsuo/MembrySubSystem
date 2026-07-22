import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getActivePeriod, getWhStatus, getReportedItemCodes } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 当該倉庫・現在回数で「報告済みの品目コード」（全員分）。未報告品目リスト（F-05）算出用。
 * 数え漏れは倉庫単位で見るため、自分だけでなく全ユーザーの報告を対象にする。
 *   GET /api/tanaoroshi/reported?warehouse=<倉庫コード>
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  const warehouse = req.nextUrl.searchParams.get("warehouse")?.trim() || "";
  if (!warehouse) return NextResponse.json({ success: false, error: "倉庫が指定されていません" }, { status: 400 });

  try {
    const period = await getActivePeriod();
    if (!period) return NextResponse.json({ success: true, reportedItemCodes: [] });
    const wh = await getWhStatus(period.periodId, warehouse);
    const reportedItemCodes = await getReportedItemCodes(period.periodId, warehouse, wh.round);
    return NextResponse.json({ success: true, reportedItemCodes });
  } catch (e: any) {
    console.error("[tanaoroshi/reported]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
