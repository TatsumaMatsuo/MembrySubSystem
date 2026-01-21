import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const authOptions: NextAuthOptions = {
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
          // Lark トークン取得
          const tokenResponse = await fetch(
            "https://open.feishu.cn/open-apis/authen/v1/access_token",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                grant_type: "authorization_code",
                code: credentials.code,
                app_id: process.env.LARK_OAUTH_CLIENT_ID,
                app_secret: process.env.LARK_OAUTH_CLIENT_SECRET,
              }),
            }
          );

          const tokenData = await tokenResponse.json();
          if (tokenData.code !== 0) {
            console.error("[Lark Auth] Token error:", tokenData.msg);
            return null;
          }

          // Lark ユーザー情報取得
          const userResponse = await fetch(
            "https://open.feishu.cn/open-apis/authen/v1/user_info",
            {
              headers: {
                Authorization: `Bearer ${tokenData.data.access_token}`,
              },
            }
          );

          const userData = await userResponse.json();
          if (userData.code !== 0) {
            console.error("[Lark Auth] User info error:", userData.msg);
            return null;
          }

          const userInfo = userData.data;
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
