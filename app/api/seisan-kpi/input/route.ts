import { NextRequest, NextResponse } from "next/server";
import { getInputRows, getDepartments, getCurrentPeriod } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/input?period=50&dept=本社鉄工課
 * 入力画面用: KPIマスタ + 月次実績 + 算出(現在値/達成率/判定) + 部署一覧
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    let period = Number(sp.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const dept = sp.get("dept") || undefined;

    const [data, departments] = await Promise.all([
      getInputRows(period, dept),
      getDepartments(period),
    ]);

    return NextResponse.json({
      data: { ...data, departments, selectedDept: dept ?? null },
    });
  } catch (e: any) {
    console.error("[seisan-kpi/input] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
