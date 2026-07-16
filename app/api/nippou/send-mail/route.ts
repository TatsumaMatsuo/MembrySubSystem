import { NextRequest, NextResponse } from "next/server";
import { getNippouAnkenByCode, sendContractorMail } from "@/lib/nippou";

// F2-09 案件別URLを外注業者へ Lark Mail で送信(明細行からの単独「再送信」用)。
// 業者は受付コードで一意特定する。保存と同時の送信は /api/nippou/anken (sendMail:true) 側で行う。
// 認証は middleware(/api/*)が担保(社内スタッフのみ)。
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json().catch(() => ({ code: "" }));
    if (!code) {
      return NextResponse.json({ success: false, error: "受付コードは必須です" }, { status: 400 });
    }

    const anken = await getNippouAnkenByCode(code);
    if (!anken) {
      return NextResponse.json({ success: false, error: "該当業者が見つかりません。" }, { status: 404 });
    }

    const origin = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    const mail = await sendContractorMail(anken, origin);
    if (!mail.sent) {
      return NextResponse.json({ success: false, error: mail.error || "メール送信に失敗しました。" }, { status: 502 });
    }
    return NextResponse.json({ success: true, to: mail.to });
  } catch (error) {
    console.error("[nippou/send-mail] Error:", error);
    return NextResponse.json({ success: false, error: "メール送信中にエラーが発生しました。" }, { status: 500 });
  }
}
