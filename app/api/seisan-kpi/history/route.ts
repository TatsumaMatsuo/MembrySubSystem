import { NextRequest, NextResponse } from "next/server";
import { getHistory, getCurrentPeriod, type HistoryScope } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/seisan-kpi/history?scope=zensha|busho|group&period=50&dept=...&group=...
 * 過去実績参照: 全社・部門 / 部署別 / グループ別 の3スコープ
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    let period = Number(sp.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }
    const scopeParam = sp.get("scope") || "zensha";
    const scope: HistoryScope = (["zensha", "busho", "group"].includes(scopeParam) ? scopeParam : "zensha") as HistoryScope;

    const data = await getHistory(scope, {
      period,
      department: sp.get("dept") || undefined,
      groupId: sp.get("group") || undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[seisan-kpi/history GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
