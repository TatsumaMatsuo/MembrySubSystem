import { NextRequest, NextResponse } from "next/server";
import { getTemplate } from "@/lib/gantt/store";

// ガントひな形 1件取得（#95）
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const template = await getTemplate(params.id);
    if (!template) return NextResponse.json({ success: false, error: "ひな形が見つかりません" }, { status: 404 });
    return NextResponse.json({ success: true, template });
  } catch (e: any) {
    console.error("[gantt/templates/:id] GET error", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
