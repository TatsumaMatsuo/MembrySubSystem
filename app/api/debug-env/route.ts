import { NextResponse } from "next/server";

export async function GET() {
  // 環境変数の存在確認（値は隠す、長さは表示）
  const envStatus = {
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT_SET",
    LARK_APP_ID: process.env.LARK_APP_ID ? `set (len=${process.env.LARK_APP_ID.length})` : "NOT_SET",
    LARK_APP_SECRET: process.env.LARK_APP_SECRET ? `set (len=${process.env.LARK_APP_SECRET.length})` : "NOT_SET",
    LARK_OAUTH_CLIENT_ID: process.env.LARK_OAUTH_CLIENT_ID ? `set (len=${process.env.LARK_OAUTH_CLIENT_ID.length})` : "NOT_SET",
    LARK_OAUTH_CLIENT_SECRET: process.env.LARK_OAUTH_CLIENT_SECRET ? `set (len=${process.env.LARK_OAUTH_CLIENT_SECRET.length})` : "NOT_SET",
    LARK_OAUTH_REDIRECT_URI: process.env.LARK_OAUTH_REDIRECT_URI || "NOT_SET",
    LARK_BASE_TOKEN: !!process.env.LARK_BASE_TOKEN,
  };

  return NextResponse.json(envStatus);
}
