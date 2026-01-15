import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { DataMappingConfig, FieldMapping } from "@/types/data-mapping";
import * as XLSX from "xlsx";

// マッピング設定テーブルID
const MAPPING_TABLE_ID = "tbl9Vuq1DizM400V";

// マッピング設定を取得
async function getMappingConfig(client: any, configId: string): Promise<DataMappingConfig | null> {
  try {
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: MAPPING_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: `CurrentValue.[設定ID] = "${configId}"`,
        },
      });

      if (response.data?.items && response.data.items.length > 0) {
        const record = response.data.items[0];
        const fields = record.fields || {};

        // 有効フラグチェック
        if (fields["有効フラグ"] === false) {
          return null;
        }

        // マッピング定義をパース
        let mappings: FieldMapping[] = [];
        try {
          if (fields["マッピング定義"]) {
            const parsed = JSON.parse(fields["マッピング定義"]);
            if (Array.isArray(parsed)) {
              mappings = parsed;
            }
          }
        } catch (e) {
          console.error("[generic-upload] Failed to parse mappings:", e);
        }

        return {
          id: fields["設定ID"] || record.record_id,
          name: fields["設定名"] || "",
          description: fields["説明"] || "",
          tableId: fields["テーブルID"] || "",
          baseToken: fields["BaseToken"] || undefined,
          keyField: fields["キー項目"] || "",
          mappings,
          createdAt: fields["作成日時"] ? new Date(fields["作成日時"]).toISOString() : "",
          updatedAt: fields["更新日時"] ? new Date(fields["更新日時"]).toISOString() : "",
        };
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    return null;
  } catch (error) {
    console.error("[generic-upload] Failed to get mapping config:", error);
    return null;
  }
}

interface ProgressEvent {
  type: "progress" | "complete" | "error";
  current: number;
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
  configName?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const configId = formData.get("configId") as string;
    const useStream = formData.get("stream") === "true";

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!configId) {
      return NextResponse.json({ error: "マッピング設定IDが必要です" }, { status: 400 });
    }

    // マッピング設定を読み込み
    const config = await getMappingConfig(client, configId);

    if (!config) {
      return NextResponse.json(
        { error: `マッピング設定が見つかりません: ${configId}` },
        { status: 404 }
      );
    }

    // Excelファイルを読み込み
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // ファイル形式を確認（ZIP/xlsxは0x50 0x4B = "PK"で始まる）
    const fileSignature = uint8Array.slice(0, 4);
    console.log(`[generic-upload] File signature: ${Array.from(fileSignature).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    // より多くのオプションを指定して読み込み
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,  // 空セルも読み込む
      dense: false,      // スパース形式を使用
    });

    console.log(`[generic-upload] File: ${file.name}, Size: ${file.size}, Sheets: ${workbook.SheetNames.join(", ")}`);

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: "Excelファイルにシートがありません" }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // シートの範囲を確認
    const range = sheet["!ref"];
    console.log(`[generic-upload] Sheet: ${sheetName}, Range: ${range}`);

    // シートの全キーを確認（セル参照をカウント）
    const sheetKeys = Object.keys(sheet);
    const cellKeys = sheetKeys.filter(k => !k.startsWith("!"));
    console.log(`[generic-upload] Sheet keys count: ${sheetKeys.length}, Cell count: ${cellKeys.length}`);

    // !refが正しくない場合、セルから実際の範囲を計算し直す
    if (cellKeys.length > 0) {
      // 列名を数値に変換する関数（A=1, B=2, ..., Z=26, AA=27, ...）
      const colToNum = (col: string): number => {
        let num = 0;
        for (let i = 0; i < col.length; i++) {
          num = num * 26 + (col.charCodeAt(i) - 64);
        }
        return num;
      };

      // 数値を列名に変換する関数
      const numToCol = (num: number): string => {
        let col = "";
        while (num > 0) {
          const rem = (num - 1) % 26;
          col = String.fromCharCode(65 + rem) + col;
          num = Math.floor((num - 1) / 26);
        }
        return col;
      };

      // セル参照を解析して最大行・最大列を求める
      let maxRow = 1;
      let maxColNum = 1;
      let minRow = Infinity;
      let minColNum = Infinity;

      for (const key of cellKeys) {
        const match = key.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const colNum = colToNum(match[1]);
          const row = parseInt(match[2], 10);
          if (row > maxRow) maxRow = row;
          if (row < minRow) minRow = row;
          if (colNum > maxColNum) maxColNum = colNum;
          if (colNum < minColNum) minColNum = colNum;
        }
      }

      const calculatedRef = `${numToCol(minColNum)}${minRow}:${numToCol(maxColNum)}${maxRow}`;
      console.log(`[generic-upload] Calculated range: ${calculatedRef} (original: ${range})`);

      // !refを修正
      if (calculatedRef !== range) {
        console.log(`[generic-upload] Fixing !ref from ${range} to ${calculatedRef}`);
        sheet["!ref"] = calculatedRef;
      }
    }

    // 生データを確認（header: 1で全データを配列として取得）
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    console.log(`[generic-upload] Raw rows: ${rawData.length}`);
    if (rawData.length > 0) {
      console.log(`[generic-upload] First raw row (${rawData[0]?.length} cols): ${JSON.stringify(rawData[0]?.slice(0, 5))}`);
    }
    if (rawData.length > 1) {
      console.log(`[generic-upload] Second raw row: ${JSON.stringify(rawData[1]?.slice(0, 5))}`);
    }

    // 空行をスキップして最初のデータ行を見つける
    let headerRowIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row.length > 0 && row.some((cell: any) => cell !== undefined && cell !== null && cell !== "")) {
        headerRowIndex = i;
        break;
      }
    }
    console.log(`[generic-upload] Header row index: ${headerRowIndex}`);

    // headerRowIndexを使ってデータを再読み込み
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: headerRowIndex });

    console.log(`[generic-upload] Parsed rows: ${data.length}`);
    if (data.length > 0) {
      console.log(`[generic-upload] First row keys: ${Object.keys(data[0]).join(", ")}`);
    }

    if (data.length === 0) {
      // より詳細なエラーメッセージ
      return NextResponse.json({
        error: `データが空です（シート: ${sheetName}, 範囲: ${range || "なし"}, 生データ行数: ${rawData.length}, ヘッダー行: ${headerRowIndex + 1}）`
      }, { status: 400 });
    }

    // Base Token を決定
    const baseToken = config.baseToken || getLarkBaseToken();

    // 既存レコードを取得（キー項目をキーにマップ作成）
    const existingRecords = new Map<string, string>();
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: config.tableId,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify([config.keyField]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const keyValue = (item.fields as any)?.[config.keyField];
          if (keyValue && item.record_id) {
            existingRecords.set(String(keyValue).trim(), item.record_id);
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[generic-upload] Config: ${config.name}, Existing records: ${existingRecords.size}, Total rows: ${data.length}`);

    // デバッグ: 売上日の分布を確認（売上情報の場合）
    if (config.name === "売上情報" && data.length > 0) {
      const salesDates = data.map((row: Record<string, any>) => row["売上日"]).filter(Boolean);
      const dateDistribution = new Map<string, number>();
      salesDates.forEach((date: any) => {
        const dateStr = String(date);
        // 月を抽出（YYYY/MM/DD または YYYY-MM-DD 形式を想定）
        const match = dateStr.match(/(\d{4})[-\/](\d{1,2})/);
        if (match) {
          const monthKey = `${match[1]}/${match[2].padStart(2, '0')}`;
          dateDistribution.set(monthKey, (dateDistribution.get(monthKey) || 0) + 1);
        }
      });
      console.log(`[generic-upload] Sales date distribution: ${JSON.stringify(Object.fromEntries(dateDistribution))}`);
      console.log(`[generic-upload] Sample dates: ${salesDates.slice(0, 5).join(", ")}`);
    }

    // マッピング情報を逆引き用に変換
    const columnToFieldMap = new Map(
      config.mappings.map((m) => [m.excelColumn, { larkField: m.larkField, fieldType: m.fieldType }])
    );

    // キー項目のExcelカラム名を取得
    const keyMapping = config.mappings.find((m) => m.larkField === config.keyField);
    const keyExcelColumn = keyMapping?.excelColumn;

    if (!keyExcelColumn) {
      return NextResponse.json(
        { error: `キー項目「${config.keyField}」のマッピングが設定されていません` },
        { status: 400 }
      );
    }

    // 行データをフィールドに変換する関数
    const convertRowToFields = (row: Record<string, any>): Record<string, any> | null => {
      const fields: Record<string, any> = {};

      for (const [excelCol, mapping] of columnToFieldMap) {
        if (row[excelCol] !== undefined && row[excelCol] !== null && row[excelCol] !== "") {
          let value = row[excelCol];

          if (mapping.fieldType === "number") {
            const numValue = parseFloat(String(value));
            if (!isNaN(numValue)) {
              value = numValue;
            } else {
              continue;
            }
          } else if (mapping.fieldType === "date") {
            if (typeof value === "number") {
              const excelEpoch = new Date(1899, 11, 30).getTime();
              const timestamp = excelEpoch + value * 86400000;
              value = timestamp;
            } else if (typeof value === "string") {
              const dateValue = new Date(value);
              if (!isNaN(dateValue.getTime())) {
                value = dateValue.getTime();
              } else {
                continue;
              }
            }
          } else {
            value = String(value).trim();
            if (value === "　" || value === "") {
              continue;
            }
          }

          fields[mapping.larkField] = value;
        }
      }

      return fields;
    };

    // ストリーミングモードの場合
    if (useStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let inserted = 0;
          let updated = 0;
          const errors: string[] = [];
          let processed = 0;
          let lastProgressTime = Date.now();
          const PROGRESS_INTERVAL = 5000; // 5秒おきに進捗送信

          const sendProgress = (force = false) => {
            const now = Date.now();
            if (!force && now - lastProgressTime < PROGRESS_INTERVAL) {
              return; // 5秒経過していなければスキップ
            }
            lastProgressTime = now;
            const event: ProgressEvent = {
              type: "progress",
              current: processed,
              total: data.length,
              inserted,
              updated,
              errors: errors.slice(-5), // 最新5件のエラーのみ送信
              configName: config.name,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };

          // 初回進捗送信
          sendProgress(true);

          // 並列処理のバッチサイズ（5件同時処理）
          const concurrency = 5;

          for (let i = 0; i < data.length; i += concurrency) {
            const batch = data.slice(i, Math.min(i + concurrency, data.length));

            const promises = batch.map(async (row, batchIndex) => {
              const rowIndex = i + batchIndex;
              try {
                const keyValue = String(row[keyExcelColumn] || "").trim();
                if (!keyValue || keyValue === "　") {
                  errors.push(`行${rowIndex + 2}: キー項目が空です`);
                  return { success: false };
                }

                const fields = convertRowToFields(row);
                if (!fields) {
                  errors.push(`行${rowIndex + 2}: データ変換に失敗`);
                  return { success: false };
                }

                const recordId = existingRecords.get(keyValue);

                if (recordId) {
                  await client.bitable.appTableRecord.update({
                    path: {
                      app_token: baseToken,
                      table_id: config.tableId,
                      record_id: recordId,
                    },
                    data: { fields },
                  });
                  return { success: true, type: "updated" };
                } else {
                  // 最初の行のフィールドをログ出力
                  if (rowIndex === 0) {
                    console.log(`[generic-upload] Fields to insert: ${Object.keys(fields).join(", ")}`);
                  }
                  const createResult = await client.bitable.appTableRecord.create({
                    path: {
                      app_token: baseToken,
                      table_id: config.tableId,
                    },
                    data: { fields },
                  });
                  // 挿入結果をログ出力（最初の5件）
                  if (rowIndex < 5) {
                    console.log(`[generic-upload] Create row ${rowIndex}: code=${createResult.code}, msg=${createResult.msg}, record_id=${createResult.data?.record?.record_id}`);
                  }
                  if (createResult.code !== 0) {
                    errors.push(`行${rowIndex + 2}: 挿入失敗 - ${createResult.msg}`);
                    return { success: false };
                  }
                  return { success: true, type: "inserted" };
                }
              } catch (error: any) {
                errors.push(`行${rowIndex + 2}: ${error.message || String(error)}`);
                return { success: false };
              }
            });

            const results = await Promise.all(promises);

            for (const result of results) {
              processed++;
              if (result.success) {
                if (result.type === "inserted") inserted++;
                else if (result.type === "updated") updated++;
              }
            }

            // 5秒経過していれば進捗を送信
            sendProgress();
          }

          // 完了イベント
          console.log(`[generic-upload] Stream Result: inserted=${inserted}, updated=${updated}, errors=${errors.length}`);
          if (errors.length > 0) {
            console.log(`[generic-upload] Stream Errors: ${errors.slice(0, 10).join("; ")}`);
          }
          const completeEvent: ProgressEvent = {
            type: "complete",
            current: processed,
            total: data.length,
            inserted,
            updated,
            errors,
            configName: config.name,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // 非ストリーミングモード（従来の処理を高速化）
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // 並列処理のバッチサイズ（5件同時処理）
    const concurrency = 5;

    for (let i = 0; i < data.length; i += concurrency) {
      const batch = data.slice(i, Math.min(i + concurrency, data.length));

      const promises = batch.map(async (row, batchIndex) => {
        const rowIndex = i + batchIndex;
        try {
          const keyValue = String(row[keyExcelColumn] || "").trim();
          if (!keyValue || keyValue === "　") {
            errors.push(`行${rowIndex + 2}: キー項目「${keyExcelColumn}」が空です`);
            return;
          }

          const fields = convertRowToFields(row);
          if (!fields) return;

          const recordId = existingRecords.get(keyValue);

          if (recordId) {
            await client.bitable.appTableRecord.update({
              path: {
                app_token: baseToken,
                table_id: config.tableId,
                record_id: recordId,
              },
              data: { fields },
            });
            updated++;
          } else {
            await client.bitable.appTableRecord.create({
              path: {
                app_token: baseToken,
                table_id: config.tableId,
              },
              data: { fields },
            });
            inserted++;
          }
        } catch (error: any) {
          errors.push(`行${rowIndex + 2}: ${error.message || String(error)}`);
        }
      });

      await Promise.all(promises);
    }

    console.log(`[generic-upload] Result: inserted=${inserted}, updated=${updated}, errors=${errors.length}`);
    if (errors.length > 0) {
      console.log(`[generic-upload] Errors: ${errors.slice(0, 10).join("; ")}`);
    }

    return NextResponse.json({
      success: true,
      configName: config.name,
      totalRows: data.length,
      inserted,
      updated,
      errors,
    });
  } catch (error: any) {
    console.error("[generic-upload] Error:", error);
    return NextResponse.json(
      { error: "アップロード処理に失敗しました", details: error.message || String(error) },
      { status: 500 }
    );
  }
}
