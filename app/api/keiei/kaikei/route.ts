import { NextRequest, NextResponse } from "next/server";
import { getKaikeiInput, upsertKaikeiActual } from "@/services/keiei.service";
import { getCurrentPeriod } from "@/services/seisan-kpi.service";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/** GET /api/keiei/kaikei?period=50 — 会計入力データ */
export async function GET(req: NextRequest) {
  try {
    let period = Number(req.nextUrl.searchParams.get("period"));
    if (!period) period = (await getCurrentPeriod())?.period ?? 50;
    const data = await getKaikeiInput(period);
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[keiei/kaikei GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/** POST /api/keiei/kaikei — 会計データの upsert(items) */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const inputBy = (session as any)?.user?.name || (session as any)?.user?.email || "";
    const body = await req.json();
    const items = (Array.isArray(body?.items) ? body.items : []).map((it: any) => ({
      period: Number(it.period),
      account: String(it.account),
      granularity: it.granularity,
      span: String(it.span),
      value: it.value === "" || it.value == null ? null : Number(it.value),
      inputBy,
    }));
    if (items.length === 0) return NextResponse.json({ error: "items が空です" }, { status: 400 });
    const r = await upsertKaikeiActual(items);
    return NextResponse.json({ data: r });
  } catch (e: any) {
    console.error("[keiei/kaikei POST] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
