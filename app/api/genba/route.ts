import { NextRequest, NextResponse } from "next/server";
import { getNippouAnkenByCode, buildNippouFormUrl, getBaiyakuInfoForNippou } from "@/lib/nippou";

// F2-10 外注業者向け(認証不要)API。案件別URL `/genba/<製番>?code=<受付コード>` の裏側。
//
// セキュリティ:
//   - middleware 除外の公開エンドポイント。**受付コード照合(SEC-04)でゲート**する。
//   - 返すのは最小情報のみ(物件名/施工場所/施工業者/担当営業)。金額・顧客等は返さない。
//   - 列挙防止: 「不存在」と「コード不一致」を区別しない汎用エラー。受付コードは推測困難(8桁)。
//   - 完了案件(SEC-02)は受付終了として拒否。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = (searchParams.get("seiban") || "").trim();
    const code = (searchParams.get("code") || "").trim();

    if (!seiban || !code) {
      return NextResponse.json({ ok: false, message: "URLが正しくありません。" }, { status: 400 });
    }

    // 受付コードで業者行を一意特定(1製番=複数業者)。URLの製番と不一致も無効扱い。
    const anken = await getNippouAnkenByCode(code);

    // 不存在 or 製番不一致 → 汎用エラー(存在有無を漏らさない)
    if (!anken || anken.seiban !== seiban) {
      return NextResponse.json(
        { ok: false, message: "URLが無効か、有効期限が切れています。担当者にご確認ください。" },
        { status: 200 }
      );
    }

    // 完了案件は受付終了(SEC-02)
    if (anken.status === "完了") {
      return NextResponse.json(
        { ok: false, message: "この案件の日報受付は終了しています。" },
        { status: 200 }
      );
    }

    // Lookup(物件名/施工場所/営業担当者)は作成直後に未計算のことがあるため、
    // 空なら売約情報から直接取得(業者ページ表示・フォーム prefill の空欄防止)。
    let bukken = anken.bukken;
    let location = anken.location;
    let salesPerson = anken.salesPerson;
    if (!bukken || !location || !salesPerson) {
      const info = await getBaiyakuInfoForNippou(seiban);
      if (info) {
        bukken = bukken || info.bukken;
        location = location || info.location;
        salesPerson = salesPerson || info.salesPerson;
      }
    }

    return NextResponse.json({
      ok: true,
      seiban,
      code,
      bukken,
      location,
      salesPerson,
      contractor: anken.contractor,
      formUrl: buildNippouFormUrl(seiban, code, { bukken, salesPerson, company: anken.contractor }),
    });
  } catch (error) {
    console.error("Error in /api/genba:", error);
    return NextResponse.json(
      { ok: false, message: "エラーが発生しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
