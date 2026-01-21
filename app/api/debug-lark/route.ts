import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET;

  // リクエストボディを構築
  const requestBody = {
    app_id: appId,
    app_secret: appSecret,
  };

  try {
    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
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
