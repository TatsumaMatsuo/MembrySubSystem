import { NextRequest, NextResponse } from "next/server";
import { buildMidtermDashboard, getSalesUsageBreakdown, SALES_RATIO_INDICATORS } from "@/services/keiei.service";

export const dynamic = "force-dynamic";
// 売上情報を全ページ集計するため延長
export const maxDuration = 60;

/**
 * GET /api/eigyo/sales-usage-analysis?period=50&plan=MTP-1 — 用途別売上分析
 *  - kgis: 製品分類別の売上比率KGI(目標トラジェクトリ×実績)。中計ダッシュボードから抽出。
 *  - usage: 指定期の用途別 件数・売上合計・構成比 + 担当者別 件数・売上合計。
 */
export async function GET(req: NextRequest) {
  try {
    const periodRaw = req.nextUrl.searchParams.get("period");
    const period = periodRaw ? Number(periodRaw) : undefined;
    const planId = req.nextUrl.searchParams.get("plan") || undefined;

    const [dash, usage] = await Promise.all([
      buildMidtermDashboard(planId, period).catch((e) => { console.error("[sales-usage-analysis] dashboard:", e?.message); return null; }),
      period != null ? getSalesUsageBreakdown(period).catch((e) => { console.error("[sales-usage-analysis] breakdown:", e?.message); return null; }) : Promise.resolve(null),
    ]);

    const kgis = (dash?.kgis ?? []).filter((k) => SALES_RATIO_INDICATORS.has(k.indicator));

    return NextResponse.json({
      success: true,
      data: {
        period: usage?.period ?? period ?? null,
        planName: dash?.header?.name ?? null,
        planPeriods: dash?.selectablePeriods ?? [],
        basePeriod: dash?.basePeriod ?? period ?? null,
        currentPeriod: dash?.currentPeriod ?? null,
        kgis,
        usage,
      },
    });
  } catch (e: any) {
    console.error("[eigyo/sales-usage-analysis] error:", e);
    return NextResponse.json({ success: false, error: e?.message ?? "failed" }, { status: 500 });
  }
}
