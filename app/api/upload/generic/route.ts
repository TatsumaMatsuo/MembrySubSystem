import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { DataMappingConfig, FieldMapping } from "@/types/data-mapping";
import * as XLSX from "xlsx";

// AWS Amplify SSRでのタイムアウト延長（最大60秒）
export const maxDuration = 60;

// マッピング設定テーブルID
const MAPPING_TABLE_ID = "tbl9Vuq1DizM400V";

// tenant_access_tokenを直接取得（バッチAPI用）
async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c";
  const appSecret = process.env.LARK_APP_SECRET || "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE";
  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  const response = await fetch(`${larkDomain}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(`Failed to get tenant_access_token: ${result.msg}`);
  return result.tenant_access_token;
}

// バッチ作成（最大500件ずつ）
async function batchCreateRecords(
  tenantToken: string, appToken: string, tableId: string,
  recordFields: Array<Record<string, any>>
): Promise<{ created: number; errors: string[] }> {
  if (recordFields.length === 0) return { created: 0, errors: [] };
  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  let created = 0;
  const errors: string[] = [];
  for (let i = 0; i < recordFields.length; i += 500) {
    const batch = recordFields.slice(i, i + 500);
    const res = await fetch(
      `${larkDomain}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: batch.map((fields) => ({ fields })) }),
      }
    );
    const text = await res.text();
    try {
      const r = JSON.parse(text);
      if (r.code === 0) created += r.data?.records?.length || batch.length;
      else errors.push(`batch_create error: code=${r.code}, msg=${r.msg}`);
    } catch {
      errors.push(`batch_create invalid response: ${text.substring(0, 200)}`);
    }
  }
  return { created, errors };
}

// バッチ更新（最大500件ずつ）
async function batchUpdateRecords(
  tenantToken: string, appToken: string, tableId: string,
  records: Array<{ record_id: string; fields: Record<string, any> }>
): Promise<{ updated: number; errors: string[] }> {
  if (records.length === 0) return { updated: 0, errors: [] };
  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  let updated = 0;
  const errors: string[] = [];
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const res = await fetch(
      `${larkDomain}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: batch.map((r) => ({ record_id: r.record_id, fields: r.fields })) }),
      }
    );
    const text = await res.text();
    try {
      const r = JSON.parse(text);
      if (r.code === 0) updated += r.data?.records?.length || batch.length;
      else errors.push(`batch_update error: code=${r.code}, msg=${r.msg}`);
    } catch {
      errors.push(`batch_update invalid response: ${text.substring(0, 200)}`);
    }
  }
  return { updated, errors };
}

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
  type: "progress" | "complete" | "error" | "init";
  current: number;
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
  configName?: string;
  message?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  // --- 軽量な前処理（タイムアウト前に完了する部分） ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "フォームデータの読み取りに失敗しました" }, { status: 400 });
  }

  const file = formData.get("file") as File;
  const configId = formData.get("configId") as string;

  if (!file) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }
  if (!configId) {
    return NextResponse.json({ error: "マッピング設定IDが必要です" }, { status: 400 });
  }

  // マッピング設定を読み込み（軽量クエリなので即完了）
  const config = await getMappingConfig(client, configId);
  if (!config) {
    return NextResponse.json(
      { error: `マッピング設定が見つかりません: ${configId}` },
      { status: 404 }
    );
  }

  // Excelファイルを読み込み（メモリ内処理なので高速）
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: true,
    cellStyles: true,
    sheetStubs: true,
    dense: false,
  });

  console.log(`[generic-upload] File: ${file.name}, Size: ${file.size}, Sheets: ${workbook.SheetNames.join(", ")}`);

  if (workbook.SheetNames.length === 0) {
    return NextResponse.json({ error: "Excelファイルにシートがありません" }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const range = sheet["!ref"];

  // !refが正しくない場合、セルから実際の範囲を計算し直す
  const sheetKeys = Object.keys(sheet);
  const cellKeys = sheetKeys.filter(k => !k.startsWith("!"));
  if (cellKeys.length > 0) {
    const colToNum = (col: string): number => {
      let num = 0;
      for (let i = 0; i < col.length; i++) {
        num = num * 26 + (col.charCodeAt(i) - 64);
      }
      return num;
    };
    const numToCol = (num: number): string => {
      let col = "";
      while (num > 0) {
        const rem = (num - 1) % 26;
        col = String.fromCharCode(65 + rem) + col;
        num = Math.floor((num - 1) / 26);
      }
      return col;
    };
    let maxRow = 1, maxColNum = 1, minRow = Infinity, minColNum = Infinity;
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
    if (calculatedRef !== range) {
      console.log(`[generic-upload] Fixing !ref from ${range} to ${calculatedRef}`);
      sheet["!ref"] = calculatedRef;
    }
  }

  // 空行をスキップして最初のデータ行を見つける
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  let headerRowIndex = 0;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.length > 0 && row.some((cell: any) => cell !== undefined && cell !== null && cell !== "")) {
      headerRowIndex = i;
      break;
    }
  }

  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: headerRowIndex });
  console.log(`[generic-upload] Parsed rows: ${data.length}`);

  if (data.length === 0) {
    return NextResponse.json({
      error: `データが空です（シート: ${sheetName}, 範囲: ${range || "なし"}, 生データ行数: ${rawData.length}, ヘッダー行: ${headerRowIndex + 1}）`
    }, { status: 400 });
  }

  // マッピング情報を逆引き用に変換
  const columnToFieldMap = new Map(
    config.mappings.map((m) => [m.excelColumn, { larkField: m.larkField, fieldType: m.fieldType }])
  );
  const keyMapping = config.mappings.find((m) => m.larkField === config.keyField);
  const keyExcelColumn = keyMapping?.excelColumn;

  if (!keyExcelColumn) {
    return NextResponse.json(
      { error: `キー項目「${config.keyField}」のマッピングが設定されていません` },
      { status: 400 }
    );
  }

  const baseToken = config.baseToken || getLarkBaseToken();

  // 行データをフィールドに変換する関数
  const convertRowToFields = (row: Record<string, any>): Record<string, any> | null => {
    const fields: Record<string, any> = {};
    for (const [excelCol, mapping] of columnToFieldMap) {
      if (row[excelCol] !== undefined && row[excelCol] !== null && row[excelCol] !== "") {
        let value = row[excelCol];
        if (mapping.fieldType === "number") {
          const numValue = parseFloat(String(value));
          if (!isNaN(numValue)) value = numValue;
          else continue;
        } else if (mapping.fieldType === "date") {
          if (typeof value === "number") {
            const excelEpoch = new Date(1899, 11, 30).getTime();
            value = excelEpoch + value * 86400000;
          } else if (typeof value === "string") {
            const dateValue = new Date(value);
            if (!isNaN(dateValue.getTime())) value = dateValue.getTime();
            else continue;
          }
        } else {
          value = String(value).trim();
          if (value === "　" || value === "") continue;
        }
        fields[mapping.larkField] = value;
      }
    }
    return fields;
  };

  // --- SSEストリームを即座に開始（504回避のため、重い処理の前にレスポンスを返す） ---
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // 初回イベントを即座に送信（接続確立、ゲートウェイタイムアウト回避）
        sendEvent({
          type: "init",
          current: 0,
          total: data.length,
          inserted: 0,
          updated: 0,
          errors: [],
          configName: config.name,
          message: "既存レコードを確認中...",
        });

        // テナントトークンを取得（バッチAPI用）
        const tenantToken = await getTenantAccessToken();

        // 既存レコードを取得（キー項目をキーにマップ作成）
        const existingRecords = new Map<string, string>();
        let pageToken: string | undefined;
        let fetchedPages = 0;

        do {
          const response = await client.bitable.appTableRecord.list({
            path: { app_token: baseToken, table_id: config.tableId },
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
          fetchedPages++;

          // 10ページごとにキープアライブ送信
          if (fetchedPages % 10 === 0) {
            sendEvent({
              type: "progress",
              current: 0,
              total: data.length,
              inserted: 0,
              updated: 0,
              errors: [],
              configName: config.name,
              message: `既存レコード確認中... (${existingRecords.size}件)`,
            });
          }
        } while (pageToken);

        console.log(`[generic-upload] Config: ${config.name}, Existing records: ${existingRecords.size}, Total rows: ${data.length}`);

        // データを新規 / 更新に分類
        const toCreate: Array<Record<string, any>> = [];
        const toUpdate: Array<{ record_id: string; fields: Record<string, any> }> = [];
        const conversionErrors: string[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const keyValue = String(row[keyExcelColumn] || "").trim();
          if (!keyValue || keyValue === "　") {
            conversionErrors.push(`行${i + 2}: キー項目が空です`);
            continue;
          }
          const fields = convertRowToFields(row);
          if (!fields) {
            conversionErrors.push(`行${i + 2}: データ変換に失敗`);
            continue;
          }
          const recordId = existingRecords.get(keyValue);
          if (recordId) {
            toUpdate.push({ record_id: recordId, fields });
          } else {
            toCreate.push(fields);
          }
        }

        console.log(`[generic-upload] To create: ${toCreate.length}, To update: ${toUpdate.length}, Conversion errors: ${conversionErrors.length}`);

        // 処理開始の進捗を送信
        sendEvent({
          type: "progress",
          current: 0,
          total: data.length,
          inserted: 0,
          updated: 0,
          errors: conversionErrors.slice(-5),
          configName: config.name,
          message: `新規${toCreate.length}件 / 更新${toUpdate.length}件を処理中...`,
        });

        let inserted = 0;
        let updated = 0;
        const allErrors = [...conversionErrors];

        // バッチ新規作成（500件ずつ）
        if (toCreate.length > 0) {
          for (let i = 0; i < toCreate.length; i += 500) {
            const batch = toCreate.slice(i, i + 500);
            const result = await batchCreateRecords(tenantToken, baseToken, config.tableId, batch);
            inserted += result.created;
            allErrors.push(...result.errors);

            sendEvent({
              type: "progress",
              current: conversionErrors.length + inserted + updated,
              total: data.length,
              inserted,
              updated,
              errors: allErrors.slice(-5),
              configName: config.name,
            });
          }
        }

        // バッチ更新（500件ずつ）
        if (toUpdate.length > 0) {
          for (let i = 0; i < toUpdate.length; i += 500) {
            const batch = toUpdate.slice(i, i + 500);
            const result = await batchUpdateRecords(tenantToken, baseToken, config.tableId, batch);
            updated += result.updated;
            allErrors.push(...result.errors);

            sendEvent({
              type: "progress",
              current: conversionErrors.length + inserted + updated,
              total: data.length,
              inserted,
              updated,
              errors: allErrors.slice(-5),
              configName: config.name,
            });
          }
        }

        // 完了イベント
        console.log(`[generic-upload] Result: inserted=${inserted}, updated=${updated}, errors=${allErrors.length}`);
        if (allErrors.length > 0) {
          console.log(`[generic-upload] Errors: ${allErrors.slice(0, 10).join("; ")}`);
        }

        sendEvent({
          type: "complete",
          current: data.length,
          total: data.length,
          inserted,
          updated,
          errors: allErrors,
          configName: config.name,
        });
      } catch (error: any) {
        console.error("[generic-upload] Stream error:", error);
        sendEvent({
          type: "error",
          current: 0,
          total: data.length,
          inserted: 0,
          updated: 0,
          errors: [error.message || String(error)],
          configName: config.name,
        });
      } finally {
        controller.close();
      }
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
