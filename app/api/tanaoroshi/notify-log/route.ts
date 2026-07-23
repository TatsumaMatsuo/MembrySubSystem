import { NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { listNotifyLog } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 通知ログ（送信状況一覧・F-10）。生産管理部のみ。 */
export async function GET() {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;
  try {
    const rows = await listNotifyLog();
    return NextResponse.json({ success: true, rows });
  } catch (e: any) {
    console.error("[tanaoroshi/notify-log]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
