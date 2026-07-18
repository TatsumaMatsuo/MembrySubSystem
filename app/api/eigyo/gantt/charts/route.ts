import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { listCharts, upsertChart, deleteChart } from "@/lib/gantt/store";
import type { GanttChartPayload } from "@/lib/gantt/types";

// ガントチャート 一覧/保存/削除（#95）
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const charts = await listCharts({ q: sp.get("q") || undefined, seiban: sp.get("seiban") || undefined });
    return NextResponse.json({ success: true, charts });
  } catch (e: any) {
    console.error("[gantt/charts] GET error", e);
    return NextResponse.json({ success: false, error: e?.message || "一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const data = body?.data as GanttChartPayload;
    if (!data || typeof data !== "object" || !Array.isArray(data.tasks)) {
      return NextResponse.json({ success: false, error: "チャートデータが不正です" }, { status: 400 });
    }
    if (JSON.stringify(data).length > 500000) {
      return NextResponse.json({ success: false, error: "データが大きすぎます" }, { status: 400 });
    }
    const { id } = await upsertChart({
      id: body?.id ? String(body.id) : undefined,
      title,
      seiban: body?.seiban ? String(body.seiban) : undefined,
      data,
      user: { name: session.user.name, email: session.user.email },
    });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    console.error("[gantt/charts] POST error", e);
    return NextResponse.json({ success: false, error: e?.message || "保存に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "IDが指定されていません" }, { status: 400 });
    const ok = await deleteChart(id);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    console.error("[gantt/charts] DELETE error", e);
    return NextResponse.json({ success: false, error: e?.message || "削除に失敗しました" }, { status: 500 });
  }
}
