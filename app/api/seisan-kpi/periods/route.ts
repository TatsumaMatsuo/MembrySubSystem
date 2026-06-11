import { NextResponse } from "next/server";
import { getPeriods } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const periods = await getPeriods();
    return NextResponse.json({ data: periods });
  } catch (e: any) {
    console.error("[seisan-kpi/periods] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
