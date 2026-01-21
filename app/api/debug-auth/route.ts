import { NextResponse } from "next/server";

export async function GET() {
  try {
    // NextAuth の初期化テスト
    const NextAuth = (await import("next-auth")).default;
    const CredentialsProvider = (await import("next-auth/providers/credentials")).default;

    const testOptions = {
      providers: [
        CredentialsProvider({
          id: "test",
          name: "Test",
          credentials: {
            code: { label: "Code", type: "text" },
          },
          async authorize() {
            return null;
          },
        }),
      ],
      secret: process.env.NEXTAUTH_SECRET,
    };

    // NextAuth handler を作成してみる
    const handler = NextAuth(testOptions);

    return NextResponse.json({
      status: "ok",
      nextAuthLoaded: !!NextAuth,
      credentialsProviderLoaded: !!CredentialsProvider,
      secretSet: !!process.env.NEXTAUTH_SECRET,
      handlerCreated: !!handler,
      nodeVersion: process.version,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
