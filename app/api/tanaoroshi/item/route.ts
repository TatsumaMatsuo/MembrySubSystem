import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getItemFromMaster } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 品目マスタ照会（在庫にない品番を読み取ったときの品名・規格解決）。
 *   GET /api/tanaoroshi/item?code=F00001
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  if (!code) return NextResponse.json({ success: false, error: "品番が指定されていません" }, { status: 400 });

  try {
    const item = await getItemFromMaster(code);
    return NextResponse.json({ success: true, item });
  } catch (e: any) {
    console.error("[tanaoroshi/item]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
