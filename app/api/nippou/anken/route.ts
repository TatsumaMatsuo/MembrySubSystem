import { NextRequest, NextResponse } from "next/server";
import { upsertNippouAnken } from "@/lib/nippou";

// F2-07 案件マスタ「配布設定」の登録/更新(売約詳細の編集フォームから)。
// 書込むのは書込可能項目のみ(業者メールアドレス/受付コード/業者/状態)。認証は middleware が担保。
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const seiban = (body.seiban || "").trim();
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番は必須です" }, { status: 400 });
    }

    const contractorEmail = typeof body.contractorEmail === "string" ? body.contractorEmail.trim() : undefined;
    const uketsukeCode = typeof body.uketsukeCode === "string" ? body.uketsukeCode.trim() : undefined;
    const contractor = typeof body.contractor === "string" ? body.contractor.trim() : undefined;
    const status = typeof body.status === "string" ? body.status.trim() : undefined;

    if (contractorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      return NextResponse.json({ success: false, error: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }
    if (status && status !== "有効" && status !== "完了") {
      return NextResponse.json({ success: false, error: "状態は「有効」または「完了」を指定してください。" }, { status: 400 });
    }

    const anken = await upsertNippouAnken(seiban, { contractorEmail, uketsukeCode, contractor, status });
    return NextResponse.json({ success: true, anken });
  } catch (error) {
    console.error("[nippou/anken] Error:", error);
    return NextResponse.json({ success: false, error: "保存中にエラーが発生しました。" }, { status: 500 });
  }
}
