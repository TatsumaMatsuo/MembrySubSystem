import { NextRequest, NextResponse } from "next/server";
import { buildMidtermDashboard } from "@/services/keiei.service";

export const dynamic = "force-dynamic";

/** GET /api/keiei/dashboard?plan=MTP-1&period=51 — 中期経営計画ダッシュボード */
export async function GET(req: NextRequest) {
  try {
    const planId = req.nextUrl.searchParams.get("plan") || undefined;
    const periodRaw = req.nextUrl.searchParams.get("period");
    const period = periodRaw ? Number(periodRaw) : undefined;
    const data = await buildMidtermDashboard(planId, period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[keiei/dashboard] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
