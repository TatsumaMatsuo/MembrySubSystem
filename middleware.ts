import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-development"
);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;

  // トークンがない場合はサインインページにリダイレクト
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    // JWT検証
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    // トークンが無効な場合はサインインページにリダイレクト
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    const response = NextResponse.redirect(signInUrl);
    // 無効なトークンを削除
    response.cookies.delete("auth-token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * 以下を除外してすべてのパスで認証を要求:
     * - api/auth (認証API routes)
     * - api/debug-env, api/debug-auth (デバッグAPI)
     * - auth (認証関連ページ: signin, error, lark-callback)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, public assets
     */
    "/((?!api/auth|api/lark-auth|api/debug-env|api/debug-auth|api/debug-lark|auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
