import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { listTemplates, upsertTemplate, deleteTemplate } from "@/lib/gantt/store";
import type { GanttTemplatePayload } from "@/lib/gantt/types";

// ガントひな形 一覧/保存/削除（#95）
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get("all") === "1";
    const templates = await listTemplates({ includeInactive });
    return NextResponse.json({ success: true, templates });
  } catch (e: any) {
    console.error("[gantt/templates] GET error", e);
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
    const name = String(body?.name || "").trim();
    const data = body?.data as GanttTemplatePayload;
    if (!name) return NextResponse.json({ success: false, error: "ひな形名は必須です" }, { status: 400 });
    if (!data || typeof data !== "object" || !Array.isArray(data.steps)) {
      return NextResponse.json({ success: false, error: "ひな形データが不正です" }, { status: 400 });
    }
    const { id } = await upsertTemplate({
      id: body?.id ? String(body.id) : undefined,
      name,
      category: body?.category ? String(body.category) : undefined,
      active: body?.active !== false,
      data,
      user: { name: session.user.name },
    });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    console.error("[gantt/templates] POST error", e);
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
    const ok = await deleteTemplate(id);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    console.error("[gantt/templates] DELETE error", e);
    return NextResponse.json({ success: false, error: e?.message || "削除に失敗しました" }, { status: 500 });
  }
}
