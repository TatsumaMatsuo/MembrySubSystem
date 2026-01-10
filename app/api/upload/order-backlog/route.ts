import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import * as XLSX from "xlsx";

// 売約情報テーブルID
const TABLE_ID = "tbl1ICzfUixpGqDy";

// Excelカラム名とLarkフィールド名のマッピング
const COLUMN_MAPPING: Record<string, string> = {
  "製番": "製番",
  "受注伝票番号": "受注伝票番号",
  "受注件名": "受注件名",
  "担当者": "担当者",
  "得意先宛名1": "得意先宛名1",
  "得意先宛名2": "得意先宛名2",
  "得意先郵便番号": "得意先郵便番号",
  "得意先住所": "得意先住所",
  "得意先TEL": "得意先TEL",
  "得意先FAX": "得意先FAX",
  "得意先備考": "得意先備考",
  "納入先宛名1": "納入先宛名1",
  "納入先宛名2": "納入先宛名2",
  "納入先郵便番号": "納入先郵便番号",
  "納入先住所": "納入先住所",
  "納入先TEL": "納入先TEL",
  "納入先FAX": "納入先FAX",
  "納入先備考": "納入先備考",
  "部門": "部門",
  "受注日": "受注日",
  "手配日": "手配日",
  "品番": "品番",
  "品名": "品名",
  "品名2": "品名2",
  "受注数量": "受注数量",
  "受注単位": "受注単位",
  "受注単価": "受注単価",
  "受注金額": "受注金額",
  "予定粗利率": "予定粗利率",
  "納期": "納期",
  "出荷予定日": "出荷予定日",
  "間口サイズ（M）": "間口サイズ（M）",
  "桁サイズ（M）": "桁サイズ（M）",
  "高さ（M）": "高さ（M）",
  "建屋㎡数（間口×桁）": "建屋㎡数（間口×桁）",
  "鉄骨重量（kg）": "鉄骨重量（kg）",
  "膜㎡数": "膜㎡数",
  "膜材仕様(色)": "膜材仕様(色)",
  "産業分類": "産業分類",
  "納入先県名": "納入先県名",
  "Web新規（TEL含む）": "Web新規（TEL含む）",
  "PJ区分": "PJ区分",
  "塗装仕様（色）": "塗装仕様（色）",
  "予定鉄工製作時間": "予定鉄工製作時間",
  "予定縫製製作時間": "予定縫製製作時間",
  "予定製作図作業時間": "予定製作図作業時間",
  "予定施工人数": "予定施工人数",
  "予定施工日数": "予定施工日数",
  "売上見込日": "売上見込日",
  "安心パック": "安心パック",
};

// 数値型フィールド
const NUMBER_FIELDS = [
  "受注数量", "受注単価", "受注金額", "予定粗利率",
  "間口サイズ（M）", "桁サイズ（M）", "高さ（M）",
  "建屋㎡数（間口×桁）", "鉄骨重量（kg）", "膜㎡数",
  "予定鉄工製作時間", "予定縫製製作時間", "予定製作図作業時間",
  "予定施工人数", "予定施工日数"
];

interface UploadResult {
  success: boolean;
  totalRows: number;
  inserted: number;
  updated: number;
  errors: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    // Excelファイルを読み込み
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    if (data.length === 0) {
      return NextResponse.json({ error: "データが空です" }, { status: 400 });
    }

    // 既存レコードを取得（製番をキーにマップ作成）
    const existingRecords = new Map<string, string>();
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify(["製番"]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const seiban = (item.fields as any)?.製番;
          if (seiban && item.record_id) {
            existingRecords.set(String(seiban).trim(), item.record_id);
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[upload] Existing records: ${existingRecords.size}`);

    const result: UploadResult = {
      success: true,
      totalRows: data.length,
      inserted: 0,
      updated: 0,
      errors: [],
    };

    // バッチ処理（10件ずつ）
    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          // フィールドをマッピング
          const fields: Record<string, any> = {};
          for (const [excelCol, larkField] of Object.entries(COLUMN_MAPPING)) {
            if (row[excelCol] !== undefined && row[excelCol] !== null && row[excelCol] !== "") {
              let value = row[excelCol];

              // 数値型フィールドの処理
              if (NUMBER_FIELDS.includes(larkField)) {
                const numValue = parseFloat(String(value));
                if (!isNaN(numValue)) {
                  value = numValue;
                } else {
                  continue; // 無効な数値はスキップ
                }
              } else {
                // 文字列型の場合は全角スペースのみは空として扱う
                value = String(value).trim();
                if (value === "　" || value === "") {
                  continue;
                }
              }

              fields[larkField] = value;
            }
          }

          // 製番が必須
          const seiban = String(row["製番"] || "").trim();
          if (!seiban || seiban === "　") {
            result.errors.push(`行${i + batch.indexOf(row) + 2}: 製番が空です`);
            continue;
          }

          const recordId = existingRecords.get(seiban);

          if (recordId) {
            // 更新
            await client.bitable.appTableRecord.update({
              path: {
                app_token: getLarkBaseToken(),
                table_id: TABLE_ID,
                record_id: recordId,
              },
              data: { fields },
            });
            result.updated++;
          } else {
            // 新規作成
            await client.bitable.appTableRecord.create({
              path: {
                app_token: getLarkBaseToken(),
                table_id: TABLE_ID,
              },
              data: { fields },
            });
            result.inserted++;
          }
        } catch (error: any) {
          result.errors.push(`行${i + batch.indexOf(row) + 2}: ${error.message || String(error)}`);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: "アップロード処理に失敗しました", details: error.message || String(error) },
      { status: 500 }
    );
  }
}
