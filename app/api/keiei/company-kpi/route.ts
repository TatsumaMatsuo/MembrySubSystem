import { NextRequest, NextResponse } from "next/server";
import { buildCompanyKpi } from "@/services/keiei.service";
import { getCurrentPeriod } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

/** GET /api/keiei/company-kpi?period=50 — 全社KPI(年度計画 vs 実績) */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) period = (await getCurrentPeriod())?.period ?? 50;
    const data = await buildCompanyKpi(period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[keiei/company-kpi] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
