import { NextRequest, NextResponse } from "next/server";
import { getGroupMatrix, upsertGroup, getCurrentPeriod } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/groups?period=50
 * グループ一覧 + 所属マトリクス(行=部署×列=グループ)
 */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const data = await getGroupMatrix(period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/groups GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/**
 * POST /api/seisan-kpi/groups
 * body: グループの作成・更新(groupId 無指定で新規採番)
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const groupName = String(body?.groupName ?? "").trim();
    if (!period || !groupName) {
      return NextResponse.json({ error: "period / groupName は必須です" }, { status: 400 });
    }

    const result = await upsertGroup({
      period,
      groupId: body?.groupId || undefined,
      groupName,
      groupType: body?.groupType,
      sortOrder: body?.sortOrder != null ? Number(body.sortOrder) : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/groups POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
