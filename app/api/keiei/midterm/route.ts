import { NextRequest, NextResponse } from "next/server";
import {
  getMidtermHeaders,
  getMidtermForEdit,
  upsertMidtermPlan,
  type MidtermPlanEdit,
} from "@/services/keiei.service";

export const dynamic = "force-dynamic";

/** GET /api/keiei/midterm           → ヘッダ一覧
 *  GET /api/keiei/midterm?plan=MTP-1 → 編集用(ヘッダ+明細) */
export async function GET(req: NextRequest) {
  try {
    const planId = req.nextUrl.searchParams.get("plan");
    if (planId) {
      const data = await getMidtermForEdit(planId);
      return NextResponse.json({ data });
    }
    const headers = await getMidtermHeaders();
    return NextResponse.json({ data: { headers } });
  } catch (e: any) {
    console.error("[keiei/midterm GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/** POST /api/keiei/midterm — 中計の保存(ヘッダ+明細 upsert) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtermPlanEdit;
    if (!body?.planId || !body?.startPeriod || !body?.endPeriod) {
      return NextResponse.json({ error: "planId / startPeriod / endPeriod は必須です" }, { status: 400 });
    }
    const r = await upsertMidtermPlan(body);
    return NextResponse.json({ data: r });
  } catch (e: any) {
    console.error("[keiei/midterm POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
