import { NextRequest, NextResponse } from "next/server";
import { clonePeriod } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/seisan-kpi/period-clone
 * body: { fromPeriod, toPeriod, startDate?, endDate? }
 * 期切替: 前期のKPIマスタ・グループ・所属を新期に複製(定義のみ)
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const fromPeriod = Number(body?.fromPeriod);
    const toPeriod = Number(body?.toPeriod);
    if (!fromPeriod || !toPeriod) {
      return NextResponse.json({ error: "fromPeriod / toPeriod は必須です" }, { status: 400 });
    }
    if (fromPeriod === toPeriod) {
      return NextResponse.json({ error: "複製元と複製先の期が同じです" }, { status: 400 });
    }

    const result = await clonePeriod({
      fromPeriod,
      toPeriod,
      startDate: body?.startDate,
      endDate: body?.endDate,
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/period-clone POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
