import { NextRequest, NextResponse } from "next/server";
import { getNippouReports, getNippouAnkenList, getBaiyakuInfoForNippou } from "@/lib/nippou";
import { getLarkTables } from "@/lib/lark-tables";

// F2-06 社内閲覧: 売約詳細画面に出す当該案件の作業日報+案件マスタ情報。
// 認証は middleware(/api/*)が担保。既定は有効投稿のみ。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = searchParams.get("seiban");
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番は必須です" }, { status: 400 });
    }

    const [reports, ankenList, info] = await Promise.all([
      getNippouReports(seiban, { onlyValid: true }),
      getNippouAnkenList(seiban),
      getBaiyakuInfoForNippou(seiban),
    ]);

    // mailto 本文用に 物件名/施工場所/営業担当者 を売約情報から補完(Lookup未計算対策)。同一製番で共通。
    const enrichedAnkenList = ankenList.map((a) => ({
      ...a,
      bukken: a.bukken || info?.bukken || "",
      location: a.location || info?.location || "",
      salesPerson: a.salesPerson || info?.salesPerson || "",
    }));

    return NextResponse.json({
      success: true,
      reports,
      ankenList: enrichedAnkenList,
      total: reports.length,
      // 写真の一時URL取得(/api/file?table_id=)に使う添付元テーブルID
      tableId: getLarkTables().NIPPOU,
    });
  } catch (error) {
    console.error("Error fetching nippou:", error);
    return NextResponse.json(
      { success: false, error: "データ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
