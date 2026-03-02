import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

// tenant_access_tokenを直接取得
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

// バッチ削除（最大500件）
async function batchDeleteRecords(tenantToken: string, appToken: string, tableId: string, recordIds: string[]): Promise<number> {
  if (recordIds.length === 0) return 0;
  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  let deleted = 0;
  for (let i = 0; i < recordIds.length; i += 500) {
    const batch = recordIds.slice(i, i + 500);
    const res = await fetch(`${larkDomain}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch }),
    });
    const text = await res.text();
    try { const r = JSON.parse(text); if (r.code === 0) deleted += batch.length; else console.error("[snapshot] batch_delete error:", r.msg); }
    catch { console.error("[snapshot] batch_delete invalid response:", text.substring(0, 200)); }
  }
  return deleted;
}

// バッチ作成（最大500件）
async function batchCreateRecords(tenantToken: string, appToken: string, tableId: string, recordFields: Array<Record<string, any>>): Promise<{ saved: number; errors: string[] }> {
  if (recordFields.length === 0) return { saved: 0, errors: [] };
  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  let saved = 0;
  const errors: string[] = [];
  for (let i = 0; i < recordFields.length; i += 500) {
    const batch = recordFields.slice(i, i + 500);
    const res = await fetch(`${larkDomain}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch.map((fields) => ({ fields })) }),
    });
    const text = await res.text();
    try {
      const r = JSON.parse(text);
      if (r.code === 0) saved += r.data?.records?.length || batch.length;
      else errors.push(`batch_create error: code=${r.code}, msg=${r.msg}`);
    } catch { errors.push(`batch_create invalid response: ${text.substring(0, 200)}`); }
  }
  return { saved, errors };
}

// テーブルID
const ANKEN_TABLE_ID = "tbl1ICzfUixpGqDy"; // 案件一覧
const SNAPSHOT_TABLE_ID = process.env.LARK_TABLE_ORDER_SNAPSHOT || ""; // 月次受注残スナップショット

// フィールド名
const URIAGE_FLAG_FIELD = "売上済フラグ";
const SAKUJO_FLAG_FIELD = "削除フラグ";
const TANTOUSHA_FIELD = "担当者";
const JUCHU_DATE_FIELD = "受注日";

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

// 当月の1日のタイムスタンプ（ミリ秒）を取得
// この日付以降の受注日を持つレコードを除外するために使用
function getCurrentMonthStartTimestamp(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

// 日付値から Date を取得（Lark Base のタイムスタンプ対応）
function parseLarkDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    // ミリ秒タイムスタンプ
    if (value > 1000000000000) return new Date(value);
    // 秒タイムスタンプ
    if (value > 1000000000) return new Date(value * 1000);
    return null;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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

    // 当月1日のタイムスタンプ: これ以降の受注日を持つレコードは除外
    // 理由: 20日～月末に入る新規受注を含めると前月末時点の受注残にならない
    const currentMonthStart = getCurrentMonthStartTimestamp();
    console.log(`[monthly-order-snapshot] Excluding orders with 受注日 >= ${new Date(currentMonthStart).toISOString()}`);

    // 1. 案件一覧から全レコードを取得し、受注残をカウント
    //    条件: 売上済フラグ=false AND 削除フラグ=false AND 受注日 < 当月1日
    const tantoushaCountMap = new Map<string, number>();
    let totalRecords = 0;
    let excludedCurrentMonth = 0;
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
          field_names: JSON.stringify([URIAGE_FLAG_FIELD, SAKUJO_FLAG_FIELD, TANTOUSHA_FIELD, JUCHU_DATE_FIELD]),
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;
          const uriageFlag = fields?.[URIAGE_FLAG_FIELD];
          const sakujoFlag = fields?.[SAKUJO_FLAG_FIELD];

          // 売上済フラグがtrue以外 かつ 削除フラグがtrue以外 = 受注残候補
          if (uriageFlag !== true && sakujoFlag !== true) {
            // 当月受注日のレコードを除外（前月末時点の受注残を求めるため）
            const juchuDate = parseLarkDate(fields?.[JUCHU_DATE_FIELD]);
            if (juchuDate && juchuDate.getTime() >= currentMonthStart) {
              excludedCurrentMonth++;
              continue;
            }

            totalRecords++;
            const tantousha = extractUserName(fields?.[TANTOUSHA_FIELD]) || "未設定";
            tantoushaCountMap.set(tantousha, (tantoushaCountMap.get(tantousha) || 0) + 1);
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[monthly-order-snapshot] Found ${totalRecords} backlog records (excluded ${excludedCurrentMonth} current month orders) for ${tantoushaCountMap.size} tantousha`);

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
      const tenantToken = await getTenantAccessToken();

      // 既存の同月データを確認・一括削除（やり直し対応）
      console.log(`[monthly-order-snapshot] Checking existing records for ${targetMonth}...`);
      let existingRecordIds: string[] = [];
      let checkPageToken: string | undefined;

      do {
        const checkResponse = await client.bitable.appTableRecord.list({
          path: { app_token: baseToken, table_id: SNAPSHOT_TABLE_ID },
          params: {
            page_size: 500,
            page_token: checkPageToken,
            filter: `CurrentValue.[年月] = "${targetMonth}"`,
          },
        });
        if (checkResponse.data?.items) {
          existingRecordIds.push(...checkResponse.data.items.map((i) => i.record_id!));
        }
        checkPageToken = checkResponse.data?.page_token;
      } while (checkPageToken);

      if (existingRecordIds.length > 0) {
        console.log(`[monthly-order-snapshot] Batch deleting ${existingRecordIds.length} existing records`);
        const deleteCount = await batchDeleteRecords(tenantToken, baseToken, SNAPSHOT_TABLE_ID, existingRecordIds);
        console.log(`[monthly-order-snapshot] Deleted ${deleteCount}/${existingRecordIds.length} records`);
      }

      // 新規レコードを一括作成
      const createdAt = Date.now();
      const recordFields = snapshots.map((s) => ({
        "年月": targetMonth,
        "担当者": s.tantousha,
        "受注残件数": s.count,
        "作成日時": createdAt,
      }));

      console.log(`[monthly-order-snapshot] Batch creating ${recordFields.length} records`);
      const createResult = await batchCreateRecords(tenantToken, baseToken, SNAPSHOT_TABLE_ID, recordFields);
      savedCount = createResult.saved;
      errors.push(...createResult.errors);
    }

    const duration = Date.now() - startTime;
    console.log(`[monthly-order-snapshot] Completed in ${duration}ms. Saved: ${savedCount}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      targetMonth,
      dryRun,
      summary: {
        totalBacklogRecords: totalRecords,
        excludedCurrentMonthOrders: excludedCurrentMonth,
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
          // 受注残件数を数値に変換（Lark Baseからの値が配列やオブジェクトの場合があるため）
          let countValue = fields?.["受注残件数"];
          if (Array.isArray(countValue)) {
            countValue = countValue[0];
          }
          if (typeof countValue === "object" && countValue !== null) {
            countValue = countValue.value || countValue.text || 0;
          }
          const count = typeof countValue === "number" ? countValue : parseInt(String(countValue), 10) || 0;

          allSnapshots.push({
            yearMonth: fields?.["年月"] || "",
            tantousha: fields?.["担当者"] || "",
            count,
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
