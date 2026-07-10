import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// AWS Amplify SSR で POST ハンドラーが環境変数にアクセスできるようにする
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// フォールバック値（app_idは非機密のため許容。JWT鍵の既知フォールバックはセキュリティ上撤去）
const FALLBACK_APP_ID = "cli_a9d79d0bbf389e1c";

// GET: 環境変数テスト（Lark国際版 API）
export async function GET() {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID || FALLBACK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET;

  const requestBody = {
    app_id: appId,
    app_secret: appSecret,
  };

  try {
    const response = await fetch(
      "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      envCheck: {
        hasAppId: !!appId,
        appIdLen: appId?.length,
        appIdPrefix: appId?.substring(0, 4),
        hasAppSecret: !!appSecret,
        appSecretLen: appSecret?.length,
      },
      requestBodyKeys: Object.keys(requestBody),
      larkResponse: {
        code: data.code,
        msg: data.msg,
        hasToken: !!data.tenant_access_token,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      envCheck: {
        hasAppId: !!appId,
        appIdLen: appId?.length,
        hasAppSecret: !!appSecret,
        appSecretLen: appSecret?.length,
      },
      error: error.message,
    });
  }
}

// POST: auth-token検証テスト
export async function POST(request: NextRequest) {
  const jwtSecret = process.env.NEXTAUTH_SECRET;
  if (!jwtSecret) {
    return NextResponse.json({ success: false, error: "NEXTAUTH_SECRET 未設定" }, { status: 500 });
  }
  const SECRET = new TextEncoder().encode(jwtSecret);

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "auth-token cookie not found",
        jwtSecretSet: true,
      });
    }

    // JWT検証
    const { payload } = await jwtVerify(token, SECRET);

    return NextResponse.json({
      success: true,
      message: "Token verified successfully",
      jwtSecretSet: true,
      payload: {
        id: payload.id,
        name: payload.name,
        exp: payload.exp,
        iat: payload.iat,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      jwtSecretUsed: jwtSecret.substring(0, 10) + "...",
    });
  }
}
