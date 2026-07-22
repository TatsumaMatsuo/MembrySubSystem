import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { getServerSession } from "@/lib/auth-server";
import { listPeriods, createAndActivatePeriod, setPeriodStatus, writeAudit } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 棚卸期の一覧（GET はログインのみ） */
export async function GET() {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
  try {
    const periods = await listPeriods();
    return NextResponse.json({ success: true, periods });
  } catch (e: any) {
    console.error("[tanaoroshi/periods GET]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}

/**
 * 棚卸期の作成（実施中化）／締め。管理操作のため生産管理部権限を要求。
 *   POST { action: "create", name, closingDate? }
 *   POST { action: "close", recordId }
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

  try {
    if (body?.action === "create") {
      const name = String(body?.name || "").trim();
      if (!name) return NextResponse.json({ success: false, error: "棚卸名称を入力してください" }, { status: 400 });
      const closingDate = typeof body?.closingDate === "number" ? body.closingDate : null;
      const { periodId } = await createAndActivatePeriod({ name, closingDate, operator });
      return NextResponse.json({ success: true, periodId });
    }
    if (body?.action === "close") {
      const recordId = String(body?.recordId || "");
      if (!recordId) return NextResponse.json({ success: false, error: "対象が不正です" }, { status: 400 });
      await setPeriodStatus(recordId, "締め");
      await writeAudit({ action: "締め", targetKey: recordId, operator }).catch(() => {});
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "操作が不正です" }, { status: 400 });
  } catch (e: any) {
    console.error("[tanaoroshi/periods POST]", e);
    return NextResponse.json({ success: false, error: e?.message || "処理に失敗しました" }, { status: 500 });
  }
}
