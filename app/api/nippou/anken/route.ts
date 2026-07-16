import { NextRequest, NextResponse } from "next/server";
import {
  createNippouAnken,
  updateNippouAnken,
  sendContractorMail,
  type NippouAnken,
} from "@/lib/nippou";

// F2-07 案件マスタ「配布設定」の登録/更新(売約詳細の編集フォームから)。
// 施工業者単位に複数行を持てる: recordId ありは更新、無しは新規作成(受付コードはサーバ自動生成)。
// sendMail:true のとき保存後に当該業者へ案件別URLをメール送信(F2-09)。認証は middleware が担保。
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const seiban = (body.seiban || "").trim();
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番は必須です" }, { status: 400 });
    }

    const contractorEmail = typeof body.contractorEmail === "string" ? body.contractorEmail.trim() : undefined;
    const contractor = typeof body.contractor === "string" ? body.contractor.trim() : undefined;
    const sendMail = body.sendMail === true;

    if (contractorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      return NextResponse.json({ success: false, error: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }
    if (!contractor) {
      return NextResponse.json({ success: false, error: "施工業者を入力してください。" }, { status: 400 });
    }

    let anken: NippouAnken | null;
    if (recordId) {
      anken = await updateNippouAnken(recordId, seiban, { contractorEmail, contractor });
    } else {
      anken = await createNippouAnken(seiban, { contractorEmail, contractor });
    }
    if (!anken) {
      return NextResponse.json({ success: false, error: "保存後の案件情報を取得できませんでした。" }, { status: 500 });
    }

    // 保存＆メール送信: 保存成否とメール成否は分離して返す(保存は成功扱い)。
    let mail: { sent: boolean; to?: string; error?: string } | undefined;
    if (sendMail) {
      const origin = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
      mail = await sendContractorMail(anken, origin);
    }

    return NextResponse.json({ success: true, anken, mail });
  } catch (error) {
    console.error("[nippou/anken] Error:", error);
    return NextResponse.json({ success: false, error: "保存中にエラーが発生しました。" }, { status: 500 });
  }
}
