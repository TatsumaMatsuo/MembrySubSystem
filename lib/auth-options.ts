import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Lark トークン取得
async function getLarkAccessToken(code: string) {
  const response = await fetch(
    "https://open.larksuite.com/open-apis/authen/v1/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        app_id: process.env.LARK_OAUTH_CLIENT_ID,
        app_secret: process.env.LARK_OAUTH_CLIENT_SECRET,
      }),
    }
  );

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Lark token error: ${data.msg}`);
  }
  return data.data;
}

// Lark ユーザー情報取得
async function getLarkUserInfo(accessToken: string) {
  const response = await fetch(
    "https://open.larksuite.com/open-apis/authen/v1/user_info",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Lark userinfo error: ${data.msg}`);
  }
  return data.data;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "lark",
      name: "Lark",
      credentials: {
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.code) {
          return null;
        }

        try {
          const tokenData = await getLarkAccessToken(credentials.code);
          const userInfo = await getLarkUserInfo(tokenData.access_token);

          return {
            id: userInfo.open_id || userInfo.union_id,
            name: userInfo.name,
            email: userInfo.email || userInfo.enterprise_email,
            image: userInfo.avatar_url || userInfo.avatar_thumb,
          };
        } catch (error) {
          console.error("[Lark Auth] Error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
