import { NextRequest, NextResponse } from "next/server";
import { buildCompanyKpi, type DisplayUnit } from "@/services/keiei.service";
import { getCurrentPeriod } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

const UNITS: DisplayUnit[] = ["累計", "月次", "四半期", "半期"];

/** GET /api/keiei/company-kpi?period=50&unit=四半期 — 全社KPI(年度計画 vs 実績) */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) period = (await getCurrentPeriod())?.period ?? 50;
    const unitParam = req.nextUrl.searchParams.get("unit") ?? "";
    const unit: DisplayUnit = UNITS.includes(unitParam as DisplayUnit) ? (unitParam as DisplayUnit) : "累計";
    const data = await buildCompanyKpi(period, unit);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[keiei/company-kpi] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
