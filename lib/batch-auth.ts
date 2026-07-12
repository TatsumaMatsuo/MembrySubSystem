import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * 文字列の定数時間比較。長さが異なれば即 false(長さはタイミングで漏れうるが実害は軽微)。
 * シークレット照合のタイミング側チャネルを避けるために使う。
 */
export function safeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

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
  if (!secret || !safeStrEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
