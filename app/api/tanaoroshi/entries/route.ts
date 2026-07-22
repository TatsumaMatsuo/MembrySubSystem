import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { submitEntries, touchWhStatus } from "@/lib/tanaoroshi/store";
import type { EntryDraft } from "@/lib/tanaoroshi/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 実績の冪等バッチ登録（F-06/F-12）。
 *   POST { entries: EntryDraft[] }  最大100件/リクエスト
 * サーバは既存 実績ID を除外して登録し、accepted/duplicated を返す。
 * クライアントは accepted∪duplicated をキューから削除する（再送で二重計上しない）。
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const entries: EntryDraft[] = Array.isArray(body?.entries) ? body.entries : [];
  if (entries.length === 0) {
    return NextResponse.json({ success: false, error: "送信データが空です" }, { status: 400 });
  }
  if (entries.length > 100) {
    return NextResponse.json({ success: false, error: "1回の送信は最大100件です" }, { status: 400 });
  }

  // 必須項目の最低限チェック
  for (const e of entries) {
    if (!e.entryId || !e.periodId || !e.warehouseCode || !e.itemCode || typeof e.qty !== "number") {
      return NextResponse.json({ success: false, error: "エントリの必須項目が不足しています" }, { status: 400 });
    }
  }

  try {
    const result = await submitEntries(entries);

    // 倉庫進捗を更新（代表の1件から 期・倉庫・回数 を取る）
    const head = entries[0];
    await touchWhStatus(head.periodId, head.warehouseCode, head.warehouseName || "", head.round).catch((e) =>
      console.error("[tanaoroshi/entries] touchWhStatus:", e)
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("[tanaoroshi/entries]", e);
    return NextResponse.json({ success: false, error: e?.message || "登録に失敗しました" }, { status: 500 });
  }
}
