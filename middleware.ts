import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// NEXTAUTH_SECRET はビルド時に amplify.yml 経由で .env.production に書き出され、Edgeにもインラインされる。
// 既知のフォールバック鍵は撤去(セキュリティ: 公開鍵だとセッション偽造が可能なため)。未設定時は検証不能=fail-closed。
const SECRET_STR = process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  // 未認証時のレスポンス。
  // API は HTML のサインインページへリダイレクトすると fetch().json() が
  // "<!DOCTYPE ..." をパースして失敗するため、401 JSON を返す。
  // 画面遷移はサインインページへリダイレクトする。
  const unauthorized = () => {
    if (isApi) {
      const res = NextResponse.json({ error: "認証が必要です。再度ログインしてください。" }, { status: 401 });
      res.cookies.delete("auth-token");
      return res;
    }
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    const res = NextResponse.redirect(signInUrl);
    res.cookies.delete("auth-token");
    return res;
  };

  // トークンがない場合
  if (!token) return unauthorized();

  // NEXTAUTH_SECRET 未設定(設定不備)は検証できないため fail-closed
  if (!SECRET_STR) {
    console.error("[middleware] NEXTAUTH_SECRET 未設定のため認証を拒否します");
    return unauthorized();
  }

  try {
    // JWT検証
    await jwtVerify(token, new TextEncoder().encode(SECRET_STR));
    return NextResponse.next();
  } catch {
    // トークンが無効な場合
    return unauthorized();
  }
}

export const config = {
  matcher: [
    /*
     * 以下を除外してすべてのパスで認証を要求:
     * - api/auth (認証API routes)
     * - api/batch (cron用バッチAPI: セッション無しで叩かれるため自前のBearer BATCH_SECRET認証に委ねる)
     * - api/debug-env, api/debug-auth (デバッグAPI)
     * - auth (認証関連ページ: signin, error, lark-callback)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, public assets
     */
    "/((?!api/auth|api/lark-auth|api/batch|api/debug-env|api/debug-auth|api/debug-lark|auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
