import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { voidEntries } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 送信済み実績の取消（F-03）。追記専用のため物理削除せず 状態=取消 に更新する。
 *   POST { entryIds: string[] }
 * ※ 差分リスト発行（回数確定）後の変更不可ガードは Phase 3 の発行実装時に round 比較で追加。
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
  const operator = session.user.name || session.user.email || "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const entryIds: string[] = Array.isArray(body?.entryIds) ? body.entryIds.map((x: any) => String(x)) : [];
  if (!entryIds.length) return NextResponse.json({ success: false, error: "対象がありません" }, { status: 400 });
  if (entryIds.length > 200) return NextResponse.json({ success: false, error: "一度に取消できるのは200件までです" }, { status: 400 });

  try {
    const voided = await voidEntries(entryIds, operator);
    return NextResponse.json({ success: true, voided });
  } catch (e: any) {
    console.error("[tanaoroshi/entries/void]", e);
    return NextResponse.json({ success: false, error: e?.message || "取消に失敗しました" }, { status: 500 });
  }
}
