import { NextRequest, NextResponse } from "next/server";
import { getKpiMasterFull, upsertKpiMaster, getCurrentPeriod } from "@/services/seisan-kpi.service";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/master?period=50
 * KPIマスタ全項目(管理画面用)
 */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const rows = await getKpiMasterFull(period);
    return NextResponse.json({ data: { period, rows } });
  } catch (e: any) {
    console.error("[seisan-kpi/master GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/**
 * POST /api/seisan-kpi/master
 * body: KPIマスタの作成・更新(KPIコード×期で一意)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const operator = (session as any)?.user?.name || (session as any)?.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const kpiId = String(body?.kpiId ?? "").trim();
    if (!period || !kpiId) {
      return NextResponse.json({ error: "period / kpiId は必須です" }, { status: 400 });
    }

    const num = (v: any) => (v === "" || v == null ? undefined : Number(v));
    const result = await upsertKpiMaster({
      period,
      kpiId,
      level: body?.level,
      departmentDiv: body?.departmentDiv,
      department: body?.department,
      departmentId: body?.departmentId,
      category: body?.category,
      kpiName: body?.kpiName,
      unit: body?.unit,
      aggType: body?.aggType,
      direction: body?.direction,
      annualTarget: num(body?.annualTarget),
      monthlyTarget: num(body?.monthlyTarget),
      owner: body?.owner,
      dataSource: body?.dataSource,
      inputTiming: body?.inputTiming,
      sortOrder: num(body?.sortOrder),
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      notes: body?.notes,
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/master POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
