import { NextRequest, NextResponse } from "next/server";

// Lark OAuthコールバックを正しいパスにリダイレクト
// Lark Developer Consoleの設定が古い場合の互換性対応
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // /auth/lark-callback にリダイレクト
  const redirectUrl = new URL("/auth/lark-callback", request.url);
  if (code) redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return NextResponse.redirect(redirectUrl);
}
