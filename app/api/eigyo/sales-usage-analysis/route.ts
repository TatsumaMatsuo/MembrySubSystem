import { NextRequest, NextResponse } from "next/server";
import { getSalesUsageAnalysis } from "@/services/keiei.service";

export const dynamic = "force-dynamic";
// 売上情報を全ページ集計するため延長
export const maxDuration = 60;

/**
 * GET /api/eigyo/sales-usage-analysis?period=50 — 用途別売上分析
 *  - kgis: 製品分類別の売上比率KGI(目標=中計明細 × 実績=売上情報の期別構成比)。
 *  - usage: 指定期の用途別 件数・売上合計・構成比 + 担当者別 件数・売上合計。
 * 売上情報の全ページ取得は1回のみ(getSalesUsageAnalysis 内で集約)。
 */
export async function GET(req: NextRequest) {
  try {
    const periodRaw = req.nextUrl.searchParams.get("period");
    const period = periodRaw ? Number(periodRaw) : undefined;
    if (period == null || !Number.isFinite(period)) {
      return NextResponse.json({ success: false, error: "period が必要です" }, { status: 400 });
    }

    const a = await getSalesUsageAnalysis(period);

    return NextResponse.json({
      success: true,
      data: {
        period: a.period,
        planName: a.planName,
        basePeriod: a.period,
        currentPeriod: a.currentPeriod,
        kgis: a.kgis,
        usage: {
          period: a.period,
          start: a.start,
          end: a.end,
          total: a.total,
          byUsage: a.byUsage,
          bySalesperson: a.bySalesperson,
        },
      },
    });
  } catch (e: any) {
    console.error("[eigyo/sales-usage-analysis] error:", e);
    return NextResponse.json({ success: false, error: e?.message ?? "failed" }, { status: 500 });
  }
}
