import { NextRequest, NextResponse } from "next/server";
import { buildMidtermDashboard } from "@/services/keiei.service";

export const dynamic = "force-dynamic";

/** GET /api/keiei/dashboard?plan=MTP-1 — 中期経営計画ダッシュボード */
export async function GET(req: NextRequest) {
  try {
    const planId = req.nextUrl.searchParams.get("plan") || undefined;
    const data = await buildMidtermDashboard(planId);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[keiei/dashboard] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
