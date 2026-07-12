import { cookies } from "next/headers";
import { jwtVerify } from "jose";

// JWT署名鍵は環境変数(NEXTAUTH_SECRET)必須。既知のフォールバック鍵はセッション偽造を招くため撤去。

export interface ServerSession {
  user: {
    id: string;
    name: string;
    email?: string;
    image?: string;
    accessToken?: string;
    refreshToken?: string;
  } | null;
  accessToken?: string;
}

/**
 * サーバーサイドでJWTからセッションを取得
 * API Routesで使用
 */
export async function getServerSession(): Promise<ServerSession> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return { user: null };
    }

    const jwtSecret = process.env.NEXTAUTH_SECRET;
    if (!jwtSecret) {
      console.error("[auth-server] NEXTAUTH_SECRET 未設定のためセッションを無効化します");
      return { user: null };
    }
    const SECRET = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });

    const user = {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string | undefined,
      image: payload.image as string | undefined,
      accessToken: payload.accessToken as string | undefined,
      refreshToken: payload.refreshToken as string | undefined,
    };

    return {
      user,
      accessToken: user.accessToken,
    };
  } catch (error) {
    console.error("[auth-server] Session error:", error);
    return { user: null };
  }
}
