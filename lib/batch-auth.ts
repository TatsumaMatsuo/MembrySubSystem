import { NextRequest, NextResponse } from "next/server";

/**
 * cron用バッチAPIのBearer認証(fail-closed)。
 *
 * GitHub Actions等から `Authorization: Bearer ${BATCH_SECRET}` で叩かれる前提。
 * BATCH_SECRET が未設定、またはヘッダが一致しない場合は 401 を返す(公開防止)。
 * ※ BATCH_SECRET は amplify.yml で .env.production に注入し、Amplify環境変数に設定すること。
 *   GitHub側 secrets.BATCH_SECRET と同一値にする。
 *
 * @returns 認証NGなら 401 レスポンス、OKなら null
 */
export function batchUnauthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.BATCH_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
