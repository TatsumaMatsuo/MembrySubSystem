import { NextRequest, NextResponse } from "next/server";
import { getLarkClient } from "@/lib/lark-client";
import { getNippouAnken, buildContractorPageUrl } from "@/lib/nippou";

// F2-09 案件別URLを外注業者へ Lark Mail で送信(売約詳細のボタンから)。
//
// 前提(情シス設定):
//   - アプリに Lark Mail 送信スコープ `mail:user_mailbox.message:send` を付与。
//   - 送信元メールボックス(Lark Mail アドレス)を env `NIPPOU_MAIL_SENDER` に設定
//     (アプリが tenant token で送るため "me" は使えず、実在の送信元指定が必須)。
//   - 宛先=案件マスタ「業者メールアドレス」。配布URLは NEXTAUTH_URL を基点に生成(改変不可)。
// 認証は middleware(/api/*)が担保(社内スタッフのみ)。
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { seiban } = await request.json().catch(() => ({ seiban: "" }));
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番は必須です" }, { status: 400 });
    }

    const sender = process.env.NIPPOU_MAIL_SENDER;
    if (!sender) {
      return NextResponse.json(
        { success: false, error: "送信元メールボックス(NIPPOU_MAIL_SENDER)が未設定です。管理者にご連絡ください。" },
        { status: 503 }
      );
    }

    const anken = await getNippouAnken(seiban);
    if (!anken) {
      return NextResponse.json({ success: false, error: "案件マスタに該当案件がありません。" }, { status: 404 });
    }
    if (!anken.contractorEmail) {
      return NextResponse.json({ success: false, error: "業者メールアドレスが未登録です。案件マスタに登録してください。" }, { status: 400 });
    }
    if (!anken.uketsukeCode) {
      return NextResponse.json({ success: false, error: "受付コードが未登録です。" }, { status: 400 });
    }
    if (anken.status === "完了") {
      return NextResponse.json({ success: false, error: "完了案件のため送信できません。" }, { status: 400 });
    }

    const origin = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    if (!origin) {
      return NextResponse.json({ success: false, error: "アプリURL(NEXTAUTH_URL)が未設定です。" }, { status: 503 });
    }
    const url = buildContractorPageUrl(origin, seiban, anken.uketsukeCode);

    const subject = `【現場作業日報】${anken.bukken || seiban} 日報投稿のご案内`;
    const bodyHtml =
      `<p>${anken.contractor || "ご担当者"} 様</p>` +
      `<p>いつもお世話になっております。<br>下記案件の作業日報を、以下の専用ページからご投稿ください。</p>` +
      `<p>■ 物件名: ${anken.bukken || "-"}<br>■ 施工場所: ${anken.location || "-"}</p>` +
      `<p><a href="${url}">${url}</a></p>` +
      `<p>※このURLは本案件専用です。SNS等での転送はお控えください。<br>` +
      `※フォームで受付コードを求められた場合は「${anken.uketsukeCode}」をご入力ください。</p>`;
    const bodyText =
      `${anken.contractor || "ご担当者"} 様\n\n` +
      `いつもお世話になっております。下記案件の作業日報を、以下の専用ページからご投稿ください。\n\n` +
      `物件名: ${anken.bukken || "-"}\n施工場所: ${anken.location || "-"}\n\n${url}\n\n` +
      `※このURLは本案件専用です。SNS等での転送はお控えください。\n` +
      `※フォームで受付コードを求められた場合は「${anken.uketsukeCode}」をご入力ください。`;

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json({ success: false, error: "メール送信クライアントを初期化できません。" }, { status: 500 });
    }

    const res: any = await client.mail.userMailboxMessage.send({
      path: { user_mailbox_id: sender },
      data: {
        subject,
        to: [{ mail_address: anken.contractorEmail, name: anken.contractor || undefined }],
        body_html: bodyHtml,
        body_plain_text: bodyText,
      },
    });

    if (res.code !== 0) {
      console.error("[nippou/send-mail] Lark mail error:", res.code, res.msg);
      return NextResponse.json(
        { success: false, error: `メール送信に失敗しました(${res.msg || res.code})。スコープ/送信元設定をご確認ください。` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, to: anken.contractorEmail });
  } catch (error) {
    console.error("[nippou/send-mail] Error:", error);
    return NextResponse.json({ success: false, error: "メール送信中にエラーが発生しました。" }, { status: 500 });
  }
}
