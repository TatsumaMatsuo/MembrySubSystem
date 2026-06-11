import { NextRequest, NextResponse } from "next/server";
import { setGroupMember } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/seisan-kpi/groups/members
 * body: { period, groupId, department, member: boolean }
 * 所属マトリクスのトグル(member=true で所属追加、false で解除)
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const groupId = String(body?.groupId ?? "");
    const department = String(body?.department ?? "");
    if (!period || !groupId || !department) {
      return NextResponse.json({ error: "period / groupId / department は必須です" }, { status: 400 });
    }

    const result = await setGroupMember({
      period,
      groupId,
      department,
      departmentId: body?.departmentId || undefined,
      member: Boolean(body?.member),
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/groups/members POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
