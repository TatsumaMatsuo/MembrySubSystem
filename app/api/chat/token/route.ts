import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getServerSession } from "@/lib/auth-server";

// #32: 社内AIチャット(shainai /api/chat)相乗り用トークン発行
//
// 目的: ブラウザから VPC内 shainai /api/chat を直叩き(SEC-01 方式a)するために、
//   セッションの open_id だけを載せた「短命・用途限定」の HS256 JWT を発行する。
//
// 設計方針:
//   - 鍵は NEXTAUTH_SECRET(shainai 側 WEBCHAT_JWT_SECRET と共有)。fail-closed。
//   - httpOnly の auth-token(4h・name/email/image入り)を直接ブラウザへ渡さず、
//     ここで open_id のみの最小クレームを 10分 有効で再発行する(露出/寿命を最小化)。
//   - open_id はセッション(検証済み)から取得。body 等クライアント入力は信用しない(なりすまし防止)。
export const dynamic = "force-dynamic";

const TOKEN_TTL_SEC = 10 * 60; // 10分

export async function GET() {
  const session = await getServerSession();
  const openId = session.user?.id;
  if (!openId) {
    return NextResponse.json(
      { error: "認証が必要です。再度ログインしてください。" },
      { status: 401 }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[chat/token] NEXTAUTH_SECRET 未設定のためトークンを発行できません");
    return NextResponse.json(
      { error: "チャット機能が構成されていません。" },
      { status: 503 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    // shainai extractUserId は sub → id → open_id の順で探索するため冗長に載せる
    sub: openId,
    open_id: openId,
    name: session.user?.name,
    aud: "shainai-webchat",
    scope: "chat",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SEC)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, expiresIn: TOKEN_TTL_SEC });
}
