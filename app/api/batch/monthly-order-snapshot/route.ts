import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

// テーブルID
const ANKEN_TABLE_ID = "tbl1ICzfUixpGqDy"; // 案件一覧
const SNAPSHOT_TABLE_ID = process.env.LARK_TABLE_ORDER_SNAPSHOT || ""; // 月次受注残スナップショット

// フィールド名
const URIAGE_FLAG_FIELD = "売上済フラグ";
const SAKUJO_FLAG_FIELD = "削除フラグ";
const TANTOUSHA_FIELD = "担当者";

// ユーザーオブジェクトから名前を抽出
function extractUserName(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.name) return first.name;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.name) return value.name;
  return "";
}

// 前月のYYYYMM形式を取得
function getPreviousMonthYYYYMM(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
}

// 現在のYYYYMM形式を取得
function getCurrentMonthYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const baseToken = getLarkBaseToken();

  // スナップショットテーブルIDのチェック
  if (!SNAPSHOT_TABLE_ID) {
    return NextResponse.json(
      { error: "LARK_TABLE_ORDER_SNAPSHOT environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetMonth = body.targetMonth || getPreviousMonthYYYYMM();
    const dryRun = body.dryRun === true;

    console.log(`[monthly-order-snapshot] Starting snapshot for ${targetMonth} (dryRun: ${dryRun})`);
    const startTime = Date.now();

    // 1. 案件一覧から全レコードを取得し、売上済フラグ=falseのものをカウント
    const tantoushaCountMap = new Map<string, number>();
    let totalRecords = 0;
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: ANKEN_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify([URIAGE_FLAG_FIELD, SAKUJO_FLAG_FIELD, TANTOUSHA_FIELD]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;
          const uriageFlag = fields?.[URIAGE_FLAG_FIELD];
          const sakujoFlag = fields?.[SAKUJO_FLAG_FIELD];

          // 売上済フラグがtrue以外 かつ 削除フラグがtrue以外 のレコードをカウント = 受注残
          if (uriageFlag !== true && sakujoFlag !== true) {
            totalRecords++;
            const tantousha = extractUserName(fields?.[TANTOUSHA_FIELD]) || "未設定";
            tantoushaCountMap.set(tantousha, (tantoushaCountMap.get(tantousha) || 0) + 1);
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[monthly-order-snapshot] Found ${totalRecords} backlog records for ${tantoushaCountMap.size} tantousha`);

    // 2. スナップショットを作成
    const snapshots: { tantousha: string; count: number }[] = [];
    for (const [tantousha, count] of tantoushaCountMap.entries()) {
      snapshots.push({ tantousha, count });
    }

    // 担当者名でソート
    snapshots.sort((a, b) => a.tantousha.localeCompare(b.tantousha, "ja"));

    // 3. Lark Baseに保存（dryRunでなければ）
    let savedCount = 0;
    const errors: string[] = [];

    if (!dryRun) {
      // 既存の同月データを確認（重複防止）
      let existingRecords: string[] = [];
      let checkPageToken: string | undefined;

      do {
        const checkResponse = await client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: SNAPSHOT_TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: checkPageToken,
            field_names: JSON.stringify(["年月"]),
            filter: JSON.stringify({
              conjunction: "and",
              conditions: [
                {
                  field_name: "年月",
                  operator: "is",
                  value: [targetMonth],
                },
              ],
            }),
          },
        });

        if (checkResponse.data?.items) {
          existingRecords.push(...checkResponse.data.items.map((i) => i.record_id!));
        }
        checkPageToken = checkResponse.data?.page_token;
      } while (checkPageToken);

      // 既存データがあれば削除
      if (existingRecords.length > 0) {
        console.log(`[monthly-order-snapshot] Deleting ${existingRecords.length} existing records for ${targetMonth}`);
        for (const recordId of existingRecords) {
          try {
            await client.bitable.appTableRecord.delete({
              path: {
                app_token: baseToken,
                table_id: SNAPSHOT_TABLE_ID,
                record_id: recordId,
              },
            });
          } catch (e: any) {
            console.error(`[monthly-order-snapshot] Failed to delete record ${recordId}:`, e.message);
          }
        }
      }

      // 新規レコードを作成
      const now = new Date();
      const createdAt = now.getTime(); // Lark Baseの日時フィールドはミリ秒タイムスタンプを期待

      console.log(`[monthly-order-snapshot] Creating ${snapshots.length} records to table: ${SNAPSHOT_TABLE_ID}`);

      for (const snapshot of snapshots) {
        try {
          const createResponse = await client.bitable.appTableRecord.create({
            path: {
              app_token: baseToken,
              table_id: SNAPSHOT_TABLE_ID,
            },
            data: {
              fields: {
                "年月": targetMonth,
                "担当者": snapshot.tantousha,
                "受注残件数": snapshot.count,
                "作成日時": createdAt,
              },
            },
          });
          console.log(`[monthly-order-snapshot] Created record for ${snapshot.tantousha}:`, createResponse.code, createResponse.msg);

          // Lark APIはエラー時も例外を投げず、codeフィールドにエラーコードを返す（成功は0）
          if (createResponse.code !== 0) {
            const errorDetail = `${snapshot.tantousha}: code=${createResponse.code}, msg=${createResponse.msg}`;
            console.error(`[monthly-order-snapshot] API error:`, errorDetail);
            errors.push(errorDetail);
          } else {
            savedCount++;
          }
        } catch (e: any) {
          console.error(`[monthly-order-snapshot] Failed to create record for ${snapshot.tantousha}:`, e);
          errors.push(`${snapshot.tantousha}: ${e.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[monthly-order-snapshot] Completed in ${duration}ms. Saved: ${savedCount}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      targetMonth,
      dryRun,
      summary: {
        totalBacklogRecords: totalRecords,
        uniqueTantousha: snapshots.length,
        savedRecords: savedCount,
        errorCount: errors.length,
      },
      snapshots: snapshots.slice(0, 50),
      duration: `${duration}ms`,
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error("[monthly-order-snapshot] Error:", error);
    return NextResponse.json(
      { error: "月次スナップショット作成に失敗しました", details: error.message },
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
  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get("months") || "6", 10);

  if (!SNAPSHOT_TABLE_ID) {
    return NextResponse.json(
      { error: "LARK_TABLE_ORDER_SNAPSHOT environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    // 過去N ヶ月分のスナップショットを取得
    const allSnapshots: {
      yearMonth: string;
      tantousha: string;
      count: number;
      createdAt: string;
    }[] = [];

    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: SNAPSHOT_TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;
          allSnapshots.push({
            yearMonth: fields?.["年月"] || "",
            tantousha: fields?.["担当者"] || "",
            count: fields?.["受注残件数"] || 0,
            createdAt: fields?.["作成日時"] || "",
          });
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    // 年月でグループ化
    const byMonth = new Map<string, { total: number; tantoushaCount: number }>();
    for (const snap of allSnapshots) {
      if (!byMonth.has(snap.yearMonth)) {
        byMonth.set(snap.yearMonth, { total: 0, tantoushaCount: 0 });
      }
      const m = byMonth.get(snap.yearMonth)!;
      m.total += snap.count;
      m.tantoushaCount++;
    }

    // 最新N ヶ月分を抽出
    const sortedMonths = Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, months)
      .map(([yearMonth, data]) => ({
        yearMonth,
        totalBacklog: data.total,
        tantoushaCount: data.tantoushaCount,
      }));

    return NextResponse.json({
      success: true,
      currentMonth: getCurrentMonthYYYYMM(),
      previousMonth: getPreviousMonthYYYYMM(),
      snapshotTableConfigured: !!SNAPSHOT_TABLE_ID,
      monthlyData: sortedMonths,
      totalRecords: allSnapshots.length,
    });
  } catch (error: any) {
    console.error("[monthly-order-snapshot] Error:", error);
    return NextResponse.json(
      { error: "スナップショット情報の取得に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
