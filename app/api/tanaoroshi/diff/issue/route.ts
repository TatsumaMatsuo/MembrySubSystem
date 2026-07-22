import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { getActivePeriod, issueDiff } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 差分リスト発行＝回数確定（F-07）。生産管理部のみ。
 *   POST { period?, warehouses: string[] }   period 省略時は実施中の期
 * 倉庫ごとに突合→差分作成→回数/ステータス更新（再実行安全）。
 */
export async function POST(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;
  const operator = gate.user?.employeeName || gate.user?.email || "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const warehouses: string[] = Array.isArray(body?.warehouses) ? body.warehouses.map((x: any) => String(x)) : [];
  if (!warehouses.length) return NextResponse.json({ success: false, error: "対象倉庫がありません" }, { status: 400 });

  try {
    let periodId = String(body?.period || "").trim();
    if (!periodId) {
      const active = await getActivePeriod();
      if (!active) return NextResponse.json({ success: false, error: "実施中の棚卸期がありません" }, { status: 400 });
      periodId = active.periodId;
    }
    const results = await issueDiff(periodId, warehouses, operator);
    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error("[tanaoroshi/diff/issue]", e);
    return NextResponse.json({ success: false, error: e?.message || "発行に失敗しました" }, { status: 500 });
  }
}
