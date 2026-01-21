import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { MembershipType } from "@/types";
import { getEmployeeByEmail } from "@/services/employee.service";

// Lark トークン取得
async function getLarkAccessToken(code: string) {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/access_token",
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
    "https://open.feishu.cn/open-apis/authen/v1/user_info",
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
          // Lark からトークン取得
          const tokenData = await getLarkAccessToken(credentials.code);

          // ユーザー情報取得
          const userInfo = await getLarkUserInfo(tokenData.access_token);

          return {
            id: userInfo.open_id || userInfo.union_id,
            name: userInfo.name,
            email: userInfo.email || userInfo.enterprise_email,
            image: userInfo.avatar_url || userInfo.avatar_thumb,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
          };
        } catch (error) {
          console.error("[Lark Auth] Error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.userId = user.id;
        token.email = user.email ?? undefined;

        // 社員マスタからユーザー情報を取得
        let employeeId: string | null = null;
        let employeeName: string | null = null;
        let department: string | null = null;
        let membershipType: MembershipType = "internal";

        if (user.email) {
          try {
            const employee = await getEmployeeByEmail(user.email);
            if (employee) {
              employeeId = employee.社員コード;
              employeeName = employee.社員名;
              department = employee.部署 || null;
              console.log("[auth] Employee found:", { employeeId, employeeName, department });
            } else {
              console.log("[auth] Employee not found for email:", user.email);
              membershipType = "external";
            }
          } catch (error) {
            console.error("[auth] Error fetching employee:", error);
          }
        }

        token.employeeId = employeeId;
        token.employeeName = employeeName;
        token.department = department;
        token.membershipType = membershipType;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId as string,
          employeeId: token.employeeId as string | null,
          employeeName: token.employeeName as string | null,
          department: token.department as string | null,
          membershipType: token.membershipType as MembershipType | null,
        },
        accessToken: token.accessToken as string,
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60, // 4時間
  },
  jwt: {
    maxAge: 4 * 60 * 60, // 4時間
  },
  secret: process.env.NEXTAUTH_SECRET,
};
