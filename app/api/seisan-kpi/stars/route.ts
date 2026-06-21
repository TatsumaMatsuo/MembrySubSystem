import { NextRequest, NextResponse } from "next/server";
import { getStars, upsertStarAdj, setStarExclusion, getCurrentPeriod } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/stars?period=50
 * ★達成評価: 製造6課 / 間接3課の部署別★グリッド + ランキング
 */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const data = await getStars(period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/stars GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/**
 * POST /api/seisan-kpi/stars
 * body: { period, department, fiscalMonth, type, delta, reason? }
 * 5S大賞・労災 等の手入力★調整(STAR_ADJ)を upsert
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_STARS);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const department = String(body?.department ?? "");
    const fiscalMonth = Number(body?.fiscalMonth);
    const kpiId = String(body?.kpiId ?? "");

    // 自動★の手動削除/復元(kpiId 指定): 月間達成で付いた★を非表示・集計除外する
    if (kpiId) {
      if (!period || !department || !fiscalMonth) {
        return NextResponse.json(
          { error: "period / department / fiscalMonth / kpiId は必須です" },
          { status: 400 }
        );
      }
      const result = await setStarExclusion({
        period,
        department,
        departmentId: body?.departmentId || undefined,
        kpiId,
        fiscalMonth,
        excluded: body?.excluded !== false, // 既定=削除。false で復元
        reason: body?.reason,
        operator,
      });
      return NextResponse.json({ data: result });
    }

    const type = String(body?.type ?? "");
    if (!period || !department || !fiscalMonth || !type) {
      return NextResponse.json(
        { error: "period / department / fiscalMonth / type は必須です" },
        { status: 400 }
      );
    }

    const result = await upsertStarAdj({
      period,
      department,
      departmentId: body?.departmentId || undefined,
      fiscalMonth,
      type,
      delta: body?.delta === "" || body?.delta == null ? null : Number(body.delta),
      reason: body?.reason,
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/stars POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
