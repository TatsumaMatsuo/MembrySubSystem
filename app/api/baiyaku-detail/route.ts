import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

export const dynamic = 'force-dynamic';

// 売約詳細テーブルID
const TABLE_ID = "tbl1ICzfUixpGqDy";

interface BaiyakuDetailRecord {
  fields: {
    "製番"?: string;
    "受注伝票番号"?: string;
    "受注件名"?: string;
    "担当者"?: string;
    "得意先宛名1"?: string;
    "得意先宛名2"?: string;
    "得意先郵便番号"?: string;
    "得意先住所"?: string;
    "得意先TEL"?: string;
    "得意先FAX"?: string;
    "納入先宛名1"?: string;
    "納入先宛名2"?: string;
    "納入先郵便番号"?: string;
    "納入先住所"?: string;
    "納入先TEL"?: string;
    "部門"?: string;
    "受注日"?: string;
    "品名"?: string;
    "品名2"?: string;
    "受注数量"?: number;
    "受注単位"?: string;
    "受注単価"?: number;
    "受注金額"?: number;
    "予定粗利率"?: number;
    "納期"?: string;
    "間口サイズ（M）"?: number;
    "桁サイズ（M）"?: number;
    "高さ（M）"?: number;
    "建屋㎡数（間口×桁）"?: number;
    "鉄骨重量（kg）"?: number;
    "膜㎡数"?: number;
    "膜材仕様(色)"?: string;
    "塗装仕様（色）"?: string;
    "予定鉄工製作時間"?: number;
    "予定縫製製作時間"?: number;
    "予定製作図作業時間"?: number;
    "予定施工人数"?: number;
    "予定施工日数"?: number;
    "売上見込日"?: string;
    [key: string]: any;
  };
}

function parseValue(value: any): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function parseNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[,，]/g, ""));
  return isNaN(num) ? null : num;
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const seiban = searchParams.get("seiban");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番が指定されていません" },
      { status: 400 }
    );
  }

  try {
    const response = await client.bitable.appTableRecord.list({
      path: {
        app_token: getLarkBaseToken(),
        table_id: TABLE_ID,
      },
      params: {
        filter: `CurrentValue.[製番] = "${seiban}"`,
        page_size: 1,
      },
    });

    const records = (response.data?.items || []) as BaiyakuDetailRecord[];

    if (records.length === 0) {
      return NextResponse.json({
        success: false,
        error: "売約詳細情報が見つかりません",
      }, { status: 404 });
    }

    const record = records[0];
    const f = record.fields;

    const detail = {
      // 基本情報
      seiban: parseValue(f.製番),
      juchu_denpyo_no: parseValue(f.受注伝票番号),
      juchu_kenmei: parseValue(f.受注件名),
      tantousha: parseValue(f.担当者),
      bumon: parseValue(f.部門),

      // 得意先情報
      tokuisaki: {
        name1: parseValue(f.得意先宛名1),
        name2: parseValue(f.得意先宛名2),
        postal_code: parseValue(f.得意先郵便番号),
        address: parseValue(f.得意先住所),
        tel: parseValue(f.得意先TEL),
        fax: parseValue(f.得意先FAX),
      },

      // 納入先情報
      nounyusaki: {
        name1: parseValue(f.納入先宛名1),
        name2: parseValue(f.納入先宛名2),
        postal_code: parseValue(f.納入先郵便番号),
        address: parseValue(f.納入先住所),
        tel: parseValue(f.納入先TEL),
      },

      // 受注情報
      juchu_date: parseValue(f.受注日),
      hinmei: parseValue(f.品名),
      hinmei2: parseValue(f.品名2),
      juchu_suryo: parseNumber(f.受注数量),
      juchu_tani: parseValue(f.受注単位),
      juchu_tanka: parseNumber(f.受注単価),
      juchu_kingaku: parseNumber(f.受注金額),
      yotei_arariritsu: parseNumber(f.予定粗利率),
      nouki: parseValue(f.納期),
      uriage_mikomi_date: parseValue(f.売上見込日),

      // 仕様情報
      maguchi_size: parseNumber(f["間口サイズ（M）"]),
      keta_size: parseNumber(f["桁サイズ（M）"]),
      takasa: parseNumber(f["高さ（M）"]),
      tateya_area: parseNumber(f["建屋㎡数（間口×桁）"]),
      tekkotsu_juryo: parseNumber(f["鉄骨重量（kg）"]),
      maku_area: parseNumber(f["膜㎡数"]),
      maku_shiyou: parseValue(f["膜材仕様(色)"]),
      tosou_shiyou: parseValue(f["塗装仕様（色）"]),

      // 予定工数
      yotei_tekko_jikan: parseNumber(f.予定鉄工製作時間),
      yotei_housei_jikan: parseNumber(f.予定縫製製作時間),
      yotei_seizu_jikan: parseNumber(f.予定製作図作業時間),
      yotei_sekou_ninzu: parseNumber(f.予定施工人数),
      yotei_sekou_nissu: parseNumber(f.予定施工日数),
    };

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error("Baiyaku detail error:", error);
    return NextResponse.json(
      { success: false, error: "売約詳細情報の取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
