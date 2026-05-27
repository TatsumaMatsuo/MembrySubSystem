import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/syaryo/auth-utils";
import { getPermitById } from "@/lib/syaryo/services/permit.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuth();
  if (!authCheck.authorized) return authCheck.response;

  const { id } = await params;
  const permit = await getPermitById(id);
  if (!permit) {
    return NextResponse.json({ success: false, error: "許可証が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: permit });
}
