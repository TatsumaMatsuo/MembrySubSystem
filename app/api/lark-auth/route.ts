import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// AWS Amplify SSR で POST ハンドラーが環境変数にアクセスできるようにする
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// AWS Amplify SSR では環境変数にアクセスできないバグがあるため、フォールバック値を設定
// 本番環境では環境変数から取得することを推奨
const FALLBACK_APP_ID = "cli_a9d79d0bbf389e1c";
const FALLBACK_APP_SECRET = "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE";
const FALLBACK_JWT_SECRET = "baiyaku_info_secret_key_12345";

// 環境変数を取得するヘルパー関数（ランタイムで評価）
function getEnvVars() {
  return {
    appId: process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID || FALLBACK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET || FALLBACK_APP_SECRET,
    jwtSecret: process.env.NEXTAUTH_SECRET || FALLBACK_JWT_SECRET,
  };
}

// リクエストから正しいベースURLを取得（AWS Amplify SSR対応）
function getBaseUrl(request: NextRequest): string {
  // x-forwarded-host または host ヘッダーから取得
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  const actualHost = forwardedHost || host || "feat-sales-analysis.d4a0s1k3z8dqc.amplifyapp.com";

  return `${protocol}://${actualHost}`;
}

// Tenant Access Token 取得
async function getTenantAccessToken() {
  const { appId, appSecret } = getEnvVars();

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
  const { jwtSecret } = getEnvVars();
  const SECRET = new TextEncoder().encode(jwtSecret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(SECRET);
}

// POST: Lark認証コードでログイン
export async function POST(request: NextRequest) {
  try {
    const { appId, appSecret } = getEnvVars();

    // デバッグ: 環境変数の状態をログ出力
    console.log("[Lark Auth] Runtime env check:", {
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
      console.error("[Lark Auth] Tenant token error:", tenantData);
      // デバッグ: 詳細なエラー情報を返す
      return NextResponse.json({
        error: `Tenant token error: ${tenantData.msg}`,
        debug: {
          tenantResponse: tenantData,
          runtimeEnvCheck: {
            LARK_APP_ID_len: appId?.length,
            LARK_APP_SECRET_len: appSecret?.length,
          },
          processEnvCheck: {
            LARK_APP_ID_len: process.env.LARK_APP_ID?.length,
            LARK_APP_SECRET_len: process.env.LARK_APP_SECRET?.length,
          },
        },
      }, { status: 500 });
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

// GET: セッション確認 または 認証コードでログイン
// AWS Amplify SSR では POST ハンドラーで環境変数にアクセスできないため、GET を使用
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // code パラメータがある場合は認証処理
  if (code) {
    const baseUrl = getBaseUrl(request);

    try {
      const { appId, appSecret } = getEnvVars();

      console.log("[Lark Auth GET] Runtime env check:", {
        hasAppId: !!appId,
        appIdLen: appId?.length,
        hasAppSecret: !!appSecret,
        appSecretLen: appSecret?.length,
        baseUrl,
      });

      // Tenant Access Token 取得
      const tenantData = await getTenantAccessToken();
      if (tenantData.code !== 0) {
        console.error("[Lark Auth GET] Tenant token error:", tenantData);
        const errorUrl = new URL("/auth/signin", baseUrl);
        errorUrl.searchParams.set("error", `Tenant token error: ${tenantData.msg}`);
        errorUrl.searchParams.set("debug", JSON.stringify({
          appIdLen: appId?.length,
          appSecretLen: appSecret?.length,
        }));
        return NextResponse.redirect(errorUrl);
      }

      // Lark ユーザートークン取得
      const tokenData = await getLarkAccessToken(code, tenantData.tenant_access_token);
      if (tokenData.code !== 0) {
        console.error("[Lark Auth GET] Token error:", tokenData.msg);
        const errorUrl = new URL("/auth/signin", baseUrl);
        errorUrl.searchParams.set("error", tokenData.msg);
        return NextResponse.redirect(errorUrl);
      }

      // Lark ユーザー情報取得
      const userData = await getLarkUserInfo(tokenData.data.access_token);
      if (userData.code !== 0) {
        console.error("[Lark Auth GET] User info error:", userData.msg);
        const errorUrl = new URL("/auth/signin", baseUrl);
        errorUrl.searchParams.set("error", userData.msg);
        return NextResponse.redirect(errorUrl);
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

      // Cookie に設定してリダイレクト
      const redirectUrl = callbackUrl.startsWith("/") ? `${baseUrl}${callbackUrl}` : callbackUrl;
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 4 * 60 * 60, // 4時間
        path: "/",
      });

      return response;
    } catch (error) {
      console.error("[Lark Auth GET] Error:", error);
      const errorUrl = new URL("/auth/signin", baseUrl);
      errorUrl.searchParams.set("error", "Authentication failed");
      return NextResponse.redirect(errorUrl);
    }
  }

  // code パラメータがない場合はセッション確認
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const { jwtSecret } = getEnvVars();
    const SECRET = new TextEncoder().encode(jwtSecret);
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
