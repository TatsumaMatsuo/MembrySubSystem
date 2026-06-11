import { NextRequest, NextResponse } from "next/server";
import { getDashboard, getCurrentPeriod } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

/** GET /api/seisan-kpi/dashboard?period=50 — 生産本部ダッシュボード集約 */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) period = (await getCurrentPeriod())?.period ?? 50;
    const data = await getDashboard(period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/dashboard] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
