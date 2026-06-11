import { NextRequest, NextResponse } from "next/server";
import { upsertPdca } from "@/services/seisan-kpi.service";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/seisan-kpi/pdca
 * body: { period, measureId, fiscalMonth, plan?, do?, kpiActual?, effect?, effectMemo?, directorComment?, nextAction? }
 * 施策の月次PDCAログ upsert(施策ID×対象月で一意)。指定項目のみ部分更新。
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const writer = (session as any)?.user?.name || (session as any)?.user?.email || "";

    const body = await req.json();
    const period = Number(body?.period);
    const measureId = String(body?.measureId ?? "");
    const fiscalMonth = Number(body?.fiscalMonth);
    if (!period || !measureId || !fiscalMonth) {
      return NextResponse.json(
        { error: "period / measureId / fiscalMonth は必須です" },
        { status: 400 }
      );
    }

    const result = await upsertPdca({
      period,
      measureId,
      fiscalMonth,
      plan: body?.plan,
      do: body?.do,
      kpiActual:
        body?.kpiActual === undefined
          ? undefined
          : body?.kpiActual === "" || body?.kpiActual == null
          ? null
          : Number(body.kpiActual),
      effect: body?.effect,
      effectMemo: body?.effectMemo,
      directorComment: body?.directorComment,
      nextAction: body?.nextAction,
      writer,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error("[seisan-kpi/pdca POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
