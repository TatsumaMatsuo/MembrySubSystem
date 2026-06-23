import { NextRequest, NextResponse } from "next/server";
import { getLarkClient } from "@/lib/lark-client";
import { syncLarkContacts, checkContactScopes } from "@/lib/lark-contact-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lark Contact → 社員マスタ 同期バッチ。
 *
 * 起動: GitHub Actions cron → POST（Authorization: Bearer ${BATCH_SECRET}）
 *   body: { dryRun?: boolean, force?: boolean }
 *
 * BATCH_SECRET が設定されていればヘッダ検証を行う（未設定の環境では検証スキップ）。
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.BATCH_SECRET;
  if (!secret) return true; // 未設定環境では検証しない（既存バッチと同挙動）
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      { error: "Lark Contact 同期に失敗しました", details: error?.message },
      { status: 500 }
    );
  }
}

/** 現状確認用（スコープ状態 + dry-run 差分） */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
