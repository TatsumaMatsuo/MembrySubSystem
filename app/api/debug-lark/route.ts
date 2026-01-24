import { NextRequest, NextResponse } from "next/server";

// AWS Amplify SSR で POST ハンドラーが環境変数にアクセスできるようにする
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// フォールバック値（AWS Amplify SSR で環境変数が取得できない問題の回避）
const FALLBACK_APP_ID = "cli_a9d79d0bbf389e1c";
const FALLBACK_APP_SECRET = "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE";

// GET: 環境変数テスト（Lark国際版 API）
export async function GET() {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID || FALLBACK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET || FALLBACK_APP_SECRET;

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

// POST: Lark認証コードでログイン（環境変数テスト含む）
export async function POST(request: NextRequest) {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET;

  // 環境変数チェック
  const envCheck = {
    hasAppId: !!appId,
    appIdLen: appId?.length,
    hasAppSecret: !!appSecret,
    appSecretLen: appSecret?.length,
  };

  // POSTでも環境変数が利用可能かテスト
  return NextResponse.json({
    method: "POST",
    envCheck,
    message: "POST handler env check",
  });
}
