import { cookies } from "next/headers";
import { jwtVerify } from "jose";

// AWS Amplify SSR では環境変数にアクセスできないため、lark-auth と同じフォールバック値を使用
const FALLBACK_JWT_SECRET = "baiyaku_info_secret_key_12345";

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

    const jwtSecret = process.env.NEXTAUTH_SECRET || FALLBACK_JWT_SECRET;
    const SECRET = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, SECRET);

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
