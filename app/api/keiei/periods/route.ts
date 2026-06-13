import { NextRequest, NextResponse } from "next/server";
import { getPeriods, upsertPeriod, deletePeriod } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/** GET /api/keiei/periods — 期マスタ一覧(全社共通) */
export async function GET() {
  try {
    const periods = await getPeriods();
    return NextResponse.json({ data: periods });
  } catch (e: any) {
    console.error("[keiei/periods GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/** POST /api/keiei/periods — 期の作成/更新(期番号で upsert) */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.KEIEI_PERIOD);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";
    const body = await req.json();
    const period = Number(body?.period);
    if (!period) return NextResponse.json({ error: "期(数値)は必須です" }, { status: 400 });
    const r = await upsertPeriod(
      {
        period,
        startDate: body?.startDate ?? "",
        endDate: body?.endDate ?? "",
        elapsedMonths: body?.elapsedMonths == null ? 0 : Number(body.elapsedMonths),
        isCurrent: !!body?.isCurrent,
        notes: body?.notes ?? "",
      },
      operator
    );
    return NextResponse.json({ data: r });
  } catch (e: any) {
    console.error("[keiei/periods POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/** DELETE /api/keiei/periods?period=51 — 期マスタの削除 */
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.KEIEI_PERIOD);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";
    const period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) return NextResponse.json({ error: "period は必須です" }, { status: 400 });
    const r = await deletePeriod(period, operator);
    return NextResponse.json({ data: r });
  } catch (e: any) {
    console.error("[keiei/periods DELETE] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
