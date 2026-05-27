import { NextResponse } from "next/server";
import { getCurrentUserPermission } from "@/lib/syaryo/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const perm = await getCurrentUserPermission();
  if (!perm) {
    return NextResponse.json({ success: true, data: null });
  }
  return NextResponse.json({
    success: true,
    data: { role: perm.role, user_email: perm.user_email, user_name: perm.user_name },
  });
}
