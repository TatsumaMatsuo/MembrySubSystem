import { NextRequest, NextResponse } from "next/server";
import { getLarkClient } from "@/lib/lark-client";
import { syncLarkContacts, checkContactScopes } from "@/lib/lark-contact-sync";
import { batchUnauthorized } from "@/lib/batch-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lark Contact → 社員マスタ 同期バッチ。
 *
 * 起動: GitHub Actions cron → POST（Authorization: Bearer ${BATCH_SECRET}）
 *   body: { dryRun?: boolean, force?: boolean }
 *
 * BATCH_SECRET による Bearer 認証を必須とする（未設定/不一致は401=fail-closed）。
 */
export async function POST(request: NextRequest) {
  const unauth = batchUnauthorized(request);
  if (unauth) return unauth;

  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const force = body.force === true;

    // プリフライト: プロフィール読取スコープ未付与なら実反映を中止（空値でマスタを壊さない）
    const scope = await checkContactScopes();
    if (!dryRun && !scope.ok && !force) {
      return NextResponse.json(
        {
          error: "Contactプロフィール読取スコープ未付与のため書込を中止しました",
          missing: scope.missing,
          sample: scope.sample,
          hint: "docs/lark-contact-sync/README.md のスコープ手順を参照。承認後に再実行、または force=true で強制。",
        },
        { status: 412 }
      );
    }

    const report = await syncLarkContacts({ dryRun });
    return NextResponse.json({ success: true, scopeOk: scope.ok, ...report });
  } catch (error: any) {
    console.error("[sync-lark-contacts] Error:", error);
    return NextResponse.json(
      { error: "Lark Contact 同期に失敗しました"},
      { status: 500 }
    );
  }
}

/** 現状確認用（スコープ状態 + dry-run 差分） */
export async function GET(request: NextRequest) {
  const unauth = batchUnauthorized(request);
  if (unauth) return unauth;

  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }
  try {
    const scope = await checkContactScopes();
    const report = await syncLarkContacts({ dryRun: true });
    return NextResponse.json({ success: true, scope, ...report });
  } catch (error: any) {
    console.error("[sync-lark-contacts] GET Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
