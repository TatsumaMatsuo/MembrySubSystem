import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { getDiffRows } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 差分リスト参照（F-07）。
 *   GET /api/tanaoroshi/diff?period=&warehouse=&round=
 */
export async function GET(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;

  const period = req.nextUrl.searchParams.get("period")?.trim() || "";
  const warehouse = req.nextUrl.searchParams.get("warehouse")?.trim() || "";
  const roundStr = req.nextUrl.searchParams.get("round")?.trim() || "";
  if (!period) return NextResponse.json({ success: false, error: "期が指定されていません" }, { status: 400 });

  try {
    const rows = await getDiffRows(period, warehouse || undefined, roundStr ? Number(roundStr) : undefined);
    return NextResponse.json({ success: true, rows });
  } catch (e: any) {
    console.error("[tanaoroshi/diff]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
