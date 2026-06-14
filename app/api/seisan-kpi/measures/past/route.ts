import { NextRequest, NextResponse } from "next/server";
import { getPastMeasures } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

/** GET /api/seisan-kpi/measures/past?targetKpi=&status=&period= — 過去施策の参照(期またぎ) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const targetKpiId = sp.get("targetKpi") || undefined;
    const status = sp.get("status") || undefined;
    const periodRaw = sp.get("period");
    const period = periodRaw ? Number(periodRaw) : undefined;
    const data = await getPastMeasures({ targetKpiId, status, period });
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/measures/past] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
