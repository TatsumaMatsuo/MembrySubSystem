import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import {
  PURGEABLE_TABLES,
  fetchRecordIds,
  deleteRecordIds,
  countActivePeriods,
  writeAudit,
} from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * テーブル初期化（洗い替え）。1リクエスト = 最大500件削除。
 * クライアントは done=false の間ループする（Amplify 28秒対策）。
 *
 * body: { table: "stock" | "result", confirmName: string, done?: {total:number} }
 *   confirmName: 誤操作防止。テーブル論理名の手入力一致を要求。
 *   done.total を付けて呼ぶと、削除は行わず監査ログのみ記録して終了（クライアントが最後に1回呼ぶ）。
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

  const table = String(body?.table || "");
  const def = PURGEABLE_TABLES[table];
  if (!def) {
    return NextResponse.json({ success: false, error: "初期化対象が不正です" }, { status: 400 });
  }

  // 二重確認: テーブル論理名の手入力一致
  if (String(body?.confirmName || "").trim() !== def.label) {
    return NextResponse.json(
      { success: false, error: `確認のため「${def.label}」を正確に入力してください` },
      { status: 400 }
    );
  }

  // 「実施中」の棚卸期があるとき、作業対象テーブルの初期化を拒否（作業中データの消失防止）
  if (def.needsActivePeriodGuard) {
    const active = await countActivePeriods();
    if (active > 0) {
      return NextResponse.json(
        { success: false, error: `実施中の棚卸期があるため、${def.label}は初期化できません` },
        { status: 409 }
      );
    }
  }

  const tableId = def.id();

  // 監査コミット呼び出し（削除は行わない）
  if (body?.done && typeof body.done.total === "number") {
    await writeAudit({
      action: "初期化",
      targetKey: def.label,
      after: `${body.done.total}件削除`,
      operator,
    });
    return NextResponse.json({ success: true, committed: true });
  }

  try {
    const ids = await fetchRecordIds(tableId, 500);
    await deleteRecordIds(tableId, ids);
    return NextResponse.json({ success: true, deleted: ids.length, done: ids.length < 500 });
  } catch (e: any) {
    console.error("[tanaoroshi/stock/purge]", e);
    return NextResponse.json({ success: false, error: e?.message || "削除に失敗しました" }, { status: 500 });
  }
}
