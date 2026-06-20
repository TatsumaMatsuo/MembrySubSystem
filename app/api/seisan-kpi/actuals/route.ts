import { NextRequest, NextResponse } from "next/server";
import { upsertActual, recomputeRollupParents } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/seisan-kpi/actuals
 * body: { period, kpiId, fiscalMonth, value }  — 月次実績の upsert
 * 複数件の場合は { items: [...] } も可
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_ACTUALS);
    if (!gate.authorized) return gate.response;
    const inputBy = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const items: any[] = Array.isArray(body?.items) ? body.items : [body];

    const results = [];
    // 保存した子KPIを期ごとに集計し、後で親(集約)KPIを再計算する
    const changedByPeriod = new Map<number, Set<string>>();
    for (const it of items) {
      const period = Number(it.period);
      const kpiId = String(it.kpiId);
      const fiscalMonth = Number(it.fiscalMonth);
      const value = it.value === "" || it.value == null ? null : Number(it.value);
      if (!period || !kpiId || !fiscalMonth) {
        return NextResponse.json(
          { error: "period / kpiId / fiscalMonth は必須です" },
          { status: 400 }
        );
      }
      results.push(await upsertActual({ period, kpiId, fiscalMonth, value, inputBy }));
      if (!changedByPeriod.has(period)) changedByPeriod.set(period, new Set());
      changedByPeriod.get(period)!.add(kpiId);
    }

    // 親(集約)KPIを子から再計算して保持(訂正にも対応)。失敗しても子の保存は確定済みのため握りつぶして警告のみ返す
    let rollup: { updatedCells: number; updatedParents: string[] } = { updatedCells: 0, updatedParents: [] };
    let rollupWarning: string | undefined;
    try {
      for (const [period, ids] of changedByPeriod) {
        const r = await recomputeRollupParents(period, [...ids], inputBy);
        rollup = { updatedCells: rollup.updatedCells + r.updatedCells, updatedParents: [...rollup.updatedParents, ...r.updatedParents] };
      }
    } catch (e: any) {
      console.error("[seisan-kpi/actuals POST] rollup recompute error:", e);
      rollupWarning = "実績は保存しましたが、親KPIの再集計に失敗しました。時間をおいて再保存してください。";
    }

    return NextResponse.json({ data: { saved: results.length, results, rollup, ...(rollupWarning ? { rollupWarning } : {}) } });
  } catch (e: any) {
    console.error("[seisan-kpi/actuals POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
