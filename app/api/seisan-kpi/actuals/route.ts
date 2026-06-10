import { NextRequest, NextResponse } from "next/server";
import { upsertActual } from "@/services/seisan-kpi.service";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/seisan-kpi/actuals
 * body: { period, kpiId, fiscalMonth, value }  — 月次実績の upsert
 * 複数件の場合は { items: [...] } も可
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const inputBy = (session as any)?.user?.name || (session as any)?.user?.email || "";

    const body = await req.json();
    const items: any[] = Array.isArray(body?.items) ? body.items : [body];

    const results = [];
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
    }

    return NextResponse.json({ data: { saved: results.length, results } });
  } catch (e: any) {
    console.error("[seisan-kpi/actuals POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
