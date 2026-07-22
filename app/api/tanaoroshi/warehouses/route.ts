import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getWarehouses } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 倉庫一覧（システム在庫の DISTINCT）。入力者が使うため GET はログインのみで可 */
export async function GET() {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  try {
    const warehouses = await getWarehouses();
    return NextResponse.json({ success: true, warehouses });
  } catch (e: any) {
    console.error("[tanaoroshi/warehouses]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
