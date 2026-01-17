import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

// テーブルID
const ANKEN_TABLE_ID = "tbl1ICzfUixpGqDy"; // 案件一覧
const URIAGE_TABLE_ID = "tbl65w6u6J72QFoz"; // 売上情報

// フィールド名
const SEIBAN_FIELD = "製番";
const URIAGE_FLAG_FIELD = "売上済フラグ";

export async function POST(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const baseToken = getLarkBaseToken();
  const { searchParams } = new URL(request.url);
  const batchLimit = parseInt(searchParams.get("limit") || "200", 10); // デフォルト200件ずつ

  try {
    console.log(`[sync-sales-flag] Starting sync process (limit: ${batchLimit})...`);

    // 1. 売上情報テーブルから全ての製番を取得
    const uriageSeibanSet = new Set<string>();
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: URIAGE_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify([SEIBAN_FIELD]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const seiban = (item.fields as any)?.[SEIBAN_FIELD];
          if (seiban) {
            // 製番が配列の場合（リンクフィールドなど）
            if (Array.isArray(seiban)) {
              seiban.forEach((s: any) => {
                const val = typeof s === "object" ? s.text || s.value : s;
                if (val) uriageSeibanSet.add(String(val).trim());
              });
            } else if (typeof seiban === "object" && seiban.text) {
              uriageSeibanSet.add(String(seiban.text).trim());
            } else {
              uriageSeibanSet.add(String(seiban).trim());
            }
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[sync-sales-flag] Found ${uriageSeibanSet.size} unique seiban in sales table`);

    // 2. 案件一覧テーブルから全レコードを取得し、一致するものを更新
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    pageToken = undefined;

    // 案件一覧から製番と売上済フラグを取得
    const ankenRecords: { recordId: string; seiban: string; currentFlag: boolean }[] = [];

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: ANKEN_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify([SEIBAN_FIELD, URIAGE_FLAG_FIELD]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const seiban = (item.fields as any)?.[SEIBAN_FIELD];
          const currentFlag = (item.fields as any)?.[URIAGE_FLAG_FIELD];

          if (seiban && item.record_id) {
            let seibanStr: string;
            if (Array.isArray(seiban)) {
              const first = seiban[0];
              seibanStr = typeof first === "object" ? first.text || first.value || "" : String(first);
            } else if (typeof seiban === "object" && seiban.text) {
              seibanStr = seiban.text;
            } else {
              seibanStr = String(seiban);
            }

            ankenRecords.push({
              recordId: item.record_id,
              seiban: seibanStr.trim(),
              currentFlag: currentFlag === true,
            });
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[sync-sales-flag] Found ${ankenRecords.length} records in anken table`);

    // 3. 売上情報に存在する製番の案件一覧レコードを更新
    const allRecordsToUpdate = ankenRecords.filter(
      (r) => uriageSeibanSet.has(r.seiban) && !r.currentFlag
    );

    // バッチ制限を適用
    const recordsToUpdate = allRecordsToUpdate.slice(0, batchLimit);
    const remainingCount = allRecordsToUpdate.length - recordsToUpdate.length;

    console.log(`[sync-sales-flag] ${recordsToUpdate.length} records to update (${remainingCount} remaining)`);

    // バッチ更新（5件ずつ並列処理）
    const concurrency = 5;
    for (let i = 0; i < recordsToUpdate.length; i += concurrency) {
      const batch = recordsToUpdate.slice(i, i + concurrency);

      const promises = batch.map(async (record) => {
        try {
          await client.bitable.appTableRecord.update({
            path: {
              app_token: baseToken,
              table_id: ANKEN_TABLE_ID,
              record_id: record.recordId,
            },
            data: {
              fields: {
                [URIAGE_FLAG_FIELD]: true,
              },
            },
          });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: `${record.seiban}: ${error.message}` };
        }
      });

      const results = await Promise.all(promises);
      for (const result of results) {
        if (result.success) {
          updatedCount++;
        } else {
          errorCount++;
          if (result.error) errors.push(result.error);
        }
      }

      // 進捗ログ
      if ((i + concurrency) % 50 === 0 || i + concurrency >= recordsToUpdate.length) {
        console.log(`[sync-sales-flag] Progress: ${Math.min(i + concurrency, recordsToUpdate.length)}/${recordsToUpdate.length}`);
      }
    }

    // 既にフラグが立っているレコード数
    skippedCount = ankenRecords.filter(
      (r) => uriageSeibanSet.has(r.seiban) && r.currentFlag
    ).length;

    console.log(`[sync-sales-flag] Completed: updated=${updatedCount}, skipped=${skippedCount}, errors=${errorCount}, remaining=${remainingCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalSalesRecords: uriageSeibanSet.size,
        totalAnkenRecords: ankenRecords.length,
        matchedRecords: allRecordsToUpdate.length + skippedCount,
        updatedCount,
        skippedCount,
        errorCount,
        remainingCount,
      },
      hasMore: remainingCount > 0,
      errors: errors.slice(0, 20),
    });
  } catch (error: any) {
    console.error("[sync-sales-flag] Error:", error);
    return NextResponse.json(
      { error: "売上済フラグの同期に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// GETで現在の状態を確認
export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const baseToken = getLarkBaseToken();

  try {
    // 売上情報の製番数を取得
    let uriageCount = 0;
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: URIAGE_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
        },
      });

      uriageCount += response.data?.items?.length || 0;
      pageToken = response.data?.page_token;
    } while (pageToken);

    // 案件一覧の売上済フラグの状態を取得
    let ankenTotal = 0;
    let flaggedCount = 0;
    pageToken = undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: ANKEN_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify([URIAGE_FLAG_FIELD]),
        },
      });

      if (response.data?.items) {
        ankenTotal += response.data.items.length;
        for (const item of response.data.items) {
          if ((item.fields as any)?.[URIAGE_FLAG_FIELD] === true) {
            flaggedCount++;
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    return NextResponse.json({
      success: true,
      status: {
        salesRecords: uriageCount,
        ankenRecords: ankenTotal,
        flaggedRecords: flaggedCount,
        unflaggedRecords: ankenTotal - flaggedCount,
      },
    });
  } catch (error: any) {
    console.error("[sync-sales-flag] Error:", error);
    return NextResponse.json(
      { error: "状態の取得に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
