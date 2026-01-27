/**
 * 設計依頼データ取得API
 * Issue #29: 設計部メニュー - 設計依頼工程管理機能
 */
import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, getTableFields } from "@/lib/lark-client";
import {
  DESIGN_REQUEST_BASE_TOKEN,
  DESIGN_REQUEST_TABLE_ID,
  DESIGN_REQUEST_FIELDS,
  DesignRequestRecord,
  FileAttachment,
  LarkUser,
} from "@/lib/design-request-tables";

/**
 * 設計依頼データを取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const pageToken = searchParams.get("pageToken") || undefined;
    const tantousha = searchParams.get("tantousha") || undefined;
    const sagyouKubun = searchParams.get("sagyouKubun") || undefined;
    const kubun = searchParams.get("kubun") || undefined;
    const searchText = searchParams.get("search") || undefined;

    // フィルター構築
    const filters: string[] = [];

    if (tantousha) {
      filters.push(`CurrentValue.[${DESIGN_REQUEST_FIELDS.tantousha}].contains("${tantousha}")`);
    }

    if (sagyouKubun) {
      filters.push(`CurrentValue.[${DESIGN_REQUEST_FIELDS.sagyou_kubun}]="${sagyouKubun}"`);
    }

    if (kubun) {
      filters.push(`CurrentValue.[${DESIGN_REQUEST_FIELDS.kubun}]="${kubun}"`);
    }

    if (searchText) {
      filters.push(
        `OR(CurrentValue.[${DESIGN_REQUEST_FIELDS.anken_mei}].contains("${searchText}"),CurrentValue.[${DESIGN_REQUEST_FIELDS.anken_bangou}].contains("${searchText}"))`
      );
    }

    const filterString = filters.length > 0 ? `AND(${filters.join(",")})` : undefined;

    console.log("[design-request] Fetching records with filter:", filterString);

    const response = await getBaseRecords(DESIGN_REQUEST_TABLE_ID, {
      filter: filterString,
      sort: [{ field_name: DESIGN_REQUEST_FIELDS.sakusei_nichiji, desc: true }],
      pageSize,
      pageToken,
      baseToken: DESIGN_REQUEST_BASE_TOKEN,
    });

    if (response.code !== 0) {
      console.error("[design-request] Error fetching records:", response.msg);
      return NextResponse.json(
        { success: false, error: response.msg },
        { status: 500 }
      );
    }

    const records = response.data?.items || [];
    const transformedRecords = records.map((record: any) => transformRecord(record));

    return NextResponse.json({
      success: true,
      data: {
        records: transformedRecords,
        total: response.data?.total || 0,
        hasMore: response.data?.has_more || false,
        pageToken: response.data?.page_token,
      },
    });
  } catch (error) {
    console.error("[design-request] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * Larkレコードを設計依頼レコード型に変換
 */
function transformRecord(record: any): DesignRequestRecord {
  const fields = record.fields || {};

  return {
    record_id: record.record_id,
    anken_bangou: extractText(fields[DESIGN_REQUEST_FIELDS.anken_bangou]),
    anken_mei: extractText(fields[DESIGN_REQUEST_FIELDS.anken_mei]),
    kubun: extractText(fields[DESIGN_REQUEST_FIELDS.kubun]),
    kaishi_bi: extractTimestamp(fields[DESIGN_REQUEST_FIELDS.kaishi_bi]),
    kanryo_kijitsu: extractSerialDate(fields[DESIGN_REQUEST_FIELDS.kanryo_kijitsu]),
    tenpu_file: extractFiles(fields[DESIGN_REQUEST_FIELDS.tenpu_file]),
    tantousha: extractUsers(fields[DESIGN_REQUEST_FIELDS.tantousha]),
    taiou_bi: extractTimestamp(fields[DESIGN_REQUEST_FIELDS.taiou_bi]),
    sagyou_kubun: extractText(fields[DESIGN_REQUEST_FIELDS.sagyou_kubun]),
    kouzou_kanryou: extractSerialDate(fields[DESIGN_REQUEST_FIELDS.kouzou_kanryou]),
    sakuzu_kanryou: extractSerialDate(fields[DESIGN_REQUEST_FIELDS.sakuzu_kanryou]),
    keikaku_joukyou: extractText(fields[DESIGN_REQUEST_FIELDS.keikaku_joukyou]),
    juchuu_doai: extractText(fields[DESIGN_REQUEST_FIELDS.juchuu_doai]),
    kensetsu_basho_todouhuken: extractText(fields[DESIGN_REQUEST_FIELDS.kensetsu_basho_todouhuken]),
    kensetsu_basho_ika: extractText(fields[DESIGN_REQUEST_FIELDS.kensetsu_basho_ika]),
    tatemono_tousuu: extractText(fields[DESIGN_REQUEST_FIELDS.tatemono_tousuu]),
    eigyou_tantousha: extractUsers(fields[DESIGN_REQUEST_FIELDS.eigyou_tantousha]),
    youto: extractText(fields[DESIGN_REQUEST_FIELDS.youto]),
    tatemono_keijou: extractText(fields[DESIGN_REQUEST_FIELDS.tatemono_keijou]),
    size_w: extractNumber(fields[DESIGN_REQUEST_FIELDS.size_w]),
    size_l: extractNumber(fields[DESIGN_REQUEST_FIELDS.size_l]),
    size_h: extractNumber(fields[DESIGN_REQUEST_FIELDS.size_h]),
    shinsei_umu: extractText(fields[DESIGN_REQUEST_FIELDS.shinsei_umu]),
    bikou: extractText(fields[DESIGN_REQUEST_FIELDS.bikou]),
    buzai_list: extractFiles(fields[DESIGN_REQUEST_FIELDS.buzai_list]),
    kansei_zumen: extractFiles(fields[DESIGN_REQUEST_FIELDS.kansei_zumen]),
    buzai_list_comment: extractText(fields[DESIGN_REQUEST_FIELDS.buzai_list_comment]),
    kansei_zumen_comment: extractText(fields[DESIGN_REQUEST_FIELDS.kansei_zumen_comment]),
    sakusei_nichiji: extractTimestamp(fields[DESIGN_REQUEST_FIELDS.sakusei_nichiji]),
  };
}

/**
 * テキスト値を抽出
 */
function extractText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]?.text) return value[0].text;
  return String(value);
}

/**
 * 数値を抽出
 */
function extractNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * タイムスタンプを抽出
 */
function extractTimestamp(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  return null;
}

/**
 * シリアル日付（Excel形式）をタイムスタンプに変換
 */
function extractSerialDate(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    // Excelシリアル日付をJavaScriptタイムスタンプに変換
    // Excel基準日: 1900/1/1, JavaScript基準: 1970/1/1
    const excelEpoch = new Date(1899, 11, 30).getTime();
    return excelEpoch + value * 24 * 60 * 60 * 1000;
  }
  return null;
}

/**
 * ファイル添付を抽出
 */
function extractFiles(value: any): FileAttachment[] {
  if (!value || !Array.isArray(value)) return [];
  return value.map((file: any) => ({
    file_token: file.file_token || "",
    name: file.name || "",
    size: file.size || 0,
    tmp_url: file.tmp_url,
    type: file.type,
  }));
}

/**
 * ユーザー情報を抽出
 */
function extractUsers(value: any): LarkUser[] {
  if (!value || !Array.isArray(value)) return [];
  return value.map((user: any) => ({
    id: user.id || "",
    email: user.email || "",
    en_name: user.en_name || "",
    avatar_url: user.avatar_url,
  }));
}
