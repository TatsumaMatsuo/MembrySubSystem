import { NextRequest, NextResponse } from "next/server";
import {
  createNippouAnken,
  updateNippouAnken,
  getBaiyakuInfoForNippou,
  type NippouAnken,
} from "@/lib/nippou";

// F2-07 案件マスタ「配布設定」の登録/更新(売約詳細の編集フォームから)。
// 施工業者単位に複数行を持てる: recordId ありは更新、無しは新規作成(受付コードはサーバ自動生成)。
// メール送信はクライアント側 mailto(操作者のメールソフト)で行うため、ここは保存のみ。
// 返却 anken の物件名/施工場所は売約情報から補完(mailto本文用。Lookupは作成直後に未計算のことがある)。
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

    // mailto 本文用に 物件名/施工場所 を売約情報から補完(Lookup未計算対策)。
    if (!anken.bukken || !anken.location) {
      const info = await getBaiyakuInfoForNippou(seiban);
      if (info) {
        anken = { ...anken, bukken: anken.bukken || info.bukken, location: anken.location || info.location };
      }
    }

    return NextResponse.json({ success: true, anken });
  } catch (error) {
    console.error("[nippou/anken] Error:", error);
    return NextResponse.json({ success: false, error: "保存中にエラーが発生しました。" }, { status: 500 });
  }
}
