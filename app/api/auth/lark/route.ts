import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-development"
);

// Tenant Access Token 取得
async function getTenantAccessToken() {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET;

  console.log("[Lark Auth] getTenantAccessToken with:", {
    appIdLen: appId?.length,
    appSecretLen: appSecret?.length,
  });

  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    }
  );
  return response.json();
}

// Lark ユーザーアクセストークン取得 (OIDC)
async function getLarkAccessToken(code: string, tenantAccessToken: string) {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantAccessToken}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
      }),
    }
  );
  return response.json();
}

// Lark ユーザー情報取得
async function getLarkUserInfo(accessToken: string) {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/user_info",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return response.json();
}

// JWT トークン作成
async function createToken(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(SECRET);
}

// POST: Lark認証コードでログイン
export async function POST(request: NextRequest) {
  try {
    // デバッグ: 環境変数の状態をログ出力
    const appId = process.env.LARK_OAUTH_CLIENT_ID;
    const appSecret = process.env.LARK_OAUTH_CLIENT_SECRET;
    console.log("[Lark Auth] Env check:", {
      hasAppId: !!appId,
      appIdLen: appId?.length,
      hasAppSecret: !!appSecret,
      appSecretLen: appSecret?.length,
    });

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    // Tenant Access Token 取得
    const tenantData = await getTenantAccessToken();
    if (tenantData.code !== 0) {
      console.error("[Lark Auth] Tenant token error:", tenantData.msg);
      return NextResponse.json({ error: `Tenant token error: ${tenantData.msg}` }, { status: 500 });
    }

    // Lark ユーザートークン取得
    const tokenData = await getLarkAccessToken(code, tenantData.tenant_access_token);
    if (tokenData.code !== 0) {
      console.error("[Lark Auth] Token error:", tokenData.msg);
      return NextResponse.json({ error: tokenData.msg }, { status: 401 });
    }

    // Lark ユーザー情報取得
    const userData = await getLarkUserInfo(tokenData.data.access_token);
    if (userData.code !== 0) {
      console.error("[Lark Auth] User info error:", userData.msg);
      return NextResponse.json({ error: userData.msg }, { status: 401 });
    }

    const userInfo = userData.data;
    const user = {
      id: userInfo.open_id || userInfo.union_id,
      name: userInfo.name,
      email: userInfo.email || userInfo.enterprise_email,
      image: userInfo.avatar_url || userInfo.avatar_thumb,
    };

    // JWT トークン作成
    const token = await createToken(user);

    // Cookie に設定
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60, // 4時間
      path: "/",
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[Lark Auth] Error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

// GET: セッション確認
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const { payload } = await jwtVerify(token, SECRET);
    return NextResponse.json({ user: payload });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}

// DELETE: ログアウト
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  return NextResponse.json({ success: true });
}
