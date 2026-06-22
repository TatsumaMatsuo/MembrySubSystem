import { NextRequest, NextResponse } from "next/server";
import { getMeasuresScreen, upsertMeasure, getCurrentPeriod } from "@/services/seisan-kpi.service";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/measures?period=50&group=G-鉄工課
 * 施策管理画面用: グループ一覧 + 選択グループの所属部署/主要KPI/重点施策(PDCA含む)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    let period = Number(sp.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const group = sp.get("group") || undefined;
    const data = await getMeasuresScreen(period, group);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/measures GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/**
 * POST /api/seisan-kpi/measures
 * body: 施策(ヘッダ)の作成・更新。measureId 指定で更新、無指定で新規採番。
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MEASURES);
    if (!gate.authorized) return gate.response;
    const operator = gate.user?.employeeName || gate.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const groupId = String(body?.groupId ?? "");
    const measureName = String(body?.measureName ?? "").trim();
    const targetKpiId = String(body?.targetKpiId ?? "");
    if (!period || !groupId || !measureName) {
      return NextResponse.json(
        { error: "period / groupId / measureName は必須です" },
        { status: 400 }
      );
    }

    const result = await upsertMeasure({
      period,
      groupId,
      measureId: body?.measureId || undefined,
      no: body?.no != null ? Number(body.no) : undefined,
      measureName,
      detail: String(body?.detail ?? ""),
      targetKpiId,
      status: String(body?.status ?? "下書き"),
      startMonth: body?.startMonth != null ? Number(body.startMonth) : null,
      endMonth: body?.endMonth != null ? Number(body.endMonth) : null,
      baseValue: body?.baseValue === "" || body?.baseValue == null ? null : Number(body.baseValue),
      goalValue: body?.goalValue === "" || body?.goalValue == null ? null : Number(body.goalValue),
      operator,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/measures POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
