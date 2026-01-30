import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// AWS Amplify SSRでのタイムアウト延長（最大60秒）
export const maxDuration = 60;

// テーブルID（案件一覧）
const TABLE_ID = "tbl1ICzfUixpGqDy";

// 売上情報テーブル（売上済チェック用）
const SALES_TABLE_ID = "tbl65w6u6J72QFoz";

// 受注残ビューID（売上済フラグ=0, 削除フラグ=0 でフィルター済み）
const BACKLOG_VIEW_ID = "vewCU8LrsT"; // 月部門担当者別受注残

// シンプルなインメモリキャッシュ（TTL: 15分に延長）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

// 必要なフィールドのみ取得（パフォーマンス最適化）
// ビューでフィルター済みなのでフラグは不要
const REQUIRED_FIELDS = [
  "製番",
  "受注金額",
  "売上見込日",
  "担当者",
  "部門",
];

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// 営業所と地域のマッピング
const OFFICE_REGION_MAP: Record<string, "east" | "west" | "hq"> = {
  仙台営業所: "east",
  北関東営業所: "east",
  東京営業所: "east",
  名古屋営業所: "east",
  大阪営業所: "west",
  北九州営業所: "west",
  福岡営業所: "west",
  佐賀営業所: "west",
  八女営業所: "west",
  宮崎営業所: "west",
};

const HQ_SALES_PERSON = "山口 篤樹";

const OFFICE_NAMES = [
  "仙台営業所", "北関東営業所", "東京営業所", "名古屋営業所",
  "大阪営業所", "北九州営業所", "福岡営業所", "佐賀営業所", "八女営業所", "宮崎営業所",
  "本社",
];

// 期から日付範囲を計算（期初は8月）
function getPeriodDateRange(period: number): { start: string; end: string } {
  const startYear = period + 1975;
  const endYear = startYear + 1;
  return {
    start: `${startYear}/08/01`,
    end: `${endYear}/07/31`,
  };
}

// 現在の期を計算
function getCurrentPeriod(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? year - 1975 : year - 1976;
}

// 月名を取得（8月始まり）
function getFiscalMonthName(monthIndex: number): string {
  const months = ["8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"];
  return months[monthIndex];
}

// テキスト型の日付文字列をDateオブジェクトに変換
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return null;
  const cleaned = dateStr.trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

// 日付文字列から期内の月インデックスを取得（8月=0, 9月=1, ..., 7月=11）
function getFiscalMonthIndex(dateStr: string): number {
  const date = parseDate(dateStr);
  if (!date) return -1;
  const month = date.getMonth() + 1; // 1-12
  return month >= 8 ? month - 8 : month + 4;
}

// フィールドからテキスト値を抽出
function extractTextValue(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.text) return first.text;
    if (typeof first === "object" && first?.name) return first.name;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.text) return value.text;
  if (typeof value === "object" && value?.name) return value.name;
  return String(value);
}

// 複数選択フィールドから全ての値を抽出
function extractMultiSelectValues(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value.trim()];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item?.text) return item.text;
      if (typeof item === "object" && item?.name) return item.name;
      return String(item);
    }).filter(Boolean);
  }
  if (typeof value === "object" && value?.text) return [value.text];
  if (typeof value === "object" && value?.name) return [value.name];
  return [];
}

// 部署フィールドから営業所を抽出
function extractOfficeFromDepartment(
  departmentValue: any,
  optionMap?: Map<string, string>
): string {
  let departments = extractMultiSelectValues(departmentValue);

  if (optionMap && optionMap.size > 0) {
    departments = departments.map((id) => optionMap.get(id) || id);
  }

  for (const dept of departments) {
    if (OFFICE_NAMES.includes(dept)) {
      return dept;
    }
    const matchedOffice = OFFICE_NAMES.find((office) => dept.includes(office) || office.includes(dept));
    if (matchedOffice) {
      return matchedOffice;
    }
  }
  return departments[0] || "未設定";
}

// 地域を判定
function getRegion(tantousha: string, eigyosho: string): "east" | "west" | "hq" {
  if (tantousha === HQ_SALES_PERSON) return "hq";
  const region = OFFICE_REGION_MAP[eigyosho];
  if (region) return region;
  return "hq";
}

// 売上済みの製番セットを取得
async function getSoldSeibanSet(
  client: any,
  baseToken: string,
  dateRange: { start: string; end: string }
): Promise<Set<string>> {
  const soldSeibans = new Set<string>();
  let pageToken: string | undefined;

  // 売上日で期間フィルタ
  const dateFilter = `AND(CurrentValue.[売上日] >= "${dateRange.start}", CurrentValue.[売上日] <= "${dateRange.end}")`;

  do {
    const response = await client.bitable.appTableRecord.list({
      path: {
        app_token: baseToken,
        table_id: SALES_TABLE_ID,
      },
      params: {
        page_size: 500,
        page_token: pageToken,
        filter: dateFilter,
        field_names: JSON.stringify(["製番", "売上日"]),
      },
    });

    if (response.data?.items) {
      for (const item of response.data.items) {
        const seiban = extractTextValue((item.fields as any)?.製番);
        if (seiban) {
          soldSeibans.add(seiban);
        }
      }
    }
    pageToken = response.data?.page_token;
  } while (pageToken);

  return soldSeibans;
}

// 最新売上済月を取得（例：2025年12月まで売上済み → "202512"）
// 最適化: 降順ソートで最新1件のみ取得（全スキャンを回避）
async function getLatestSoldMonth(client: any, baseToken: string): Promise<string> {
  const startTime = Date.now();

  // 売上日の降順で1件だけ取得
  const response = await client.bitable.appTableRecord.list({
    path: {
      app_token: baseToken,
      table_id: SALES_TABLE_ID,
    },
    params: {
      page_size: 1,
      sort: JSON.stringify([{ field_name: "売上日", desc: true }]),
      field_names: JSON.stringify(["売上日"]),
    },
  });

  let latestMonth = "";
  if (response.data?.items && response.data.items.length > 0) {
    const uriageDate = extractTextValue((response.data.items[0].fields as any)?.売上日);
    if (uriageDate) {
      const date = parseDate(uriageDate);
      if (date) {
        latestMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[order-backlog] Found latest sold month: ${latestMonth} in ${elapsed}ms`);
  return latestMonth;
}

interface MonthlyBacklogData {
  month: string;
  monthIndex: number;
  count: number;
  amount: number;
}

interface SalesPersonBacklog {
  name: string;
  office: string;
  count: number;
  amount: number;
  monthlyData: MonthlyBacklogData[];
}

interface OfficeBacklog {
  name: string;
  count: number;
  amount: number;
  monthlyData: MonthlyBacklogData[];
}

interface RegionBacklog {
  region: string;
  regionKey: "east" | "west" | "hq";
  count: number;
  amount: number;
}

interface BacklogSummary {
  period: number;
  dateRange: { start: string; end: string };
  latestSoldMonth: string;
  cutoffDate: string;
  totalCount: number;
  totalAmount: number;
  monthlyData: MonthlyBacklogData[];
  salesPersonSummary: SalesPersonBacklog[];
  officeSummary: OfficeBacklog[];
  regionSummary: RegionBacklog[];
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") || String(getCurrentPeriod()), 10);
  const noCache = searchParams.get("noCache") === "true";

  const cacheKey = `order-backlog-summary:${period}`;
  if (!noCache) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
  }

  try {
    const baseToken = getLarkBaseToken();
    const dateRange = getPeriodDateRange(period);

    // 部署マッピング取得
    const departmentMap = new Map<string, string>();
    try {
      const deptResponse = await listAllDepartments();
      if (deptResponse.code === 0 && deptResponse.data?.items) {
        for (const dept of deptResponse.data.items) {
          const deptId = (dept as any).open_department_id || (dept as any).department_id;
          const deptName = (dept as any).name;
          if (deptId && deptName) {
            departmentMap.set(deptId, deptName);
            departmentMap.set(String(deptId), deptName);
          }
        }
      }
    } catch (e) {
      // 部署マッピング取得失敗時は空のまま継続
    }

    // 売上済みの最新月を取得
    const latestSoldMonth = await getLatestSoldMonth(client, baseToken);
    console.log(`[order-backlog] Latest sold month: ${latestSoldMonth}`);

    // カットオフ日を計算（最新売上済月の翌月1日）
    let cutoffDate = "";
    if (latestSoldMonth) {
      const year = parseInt(latestSoldMonth.substring(0, 4), 10);
      const month = parseInt(latestSoldMonth.substring(4, 6), 10);
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      cutoffDate = `${nextYear}/${String(nextMonth).padStart(2, "0")}/01`;
    }
    console.log(`[order-backlog] Cutoff date: ${cutoffDate}`);

    // 案件一覧から受注残データを取得（ビュー使用で高速化）
    // ビューには売上済フラグ=0, 削除フラグ=0 のフィルターが設定済み
    let allRecords: any[] = [];
    let pageToken: string | undefined;

    const fetchStartTime = Date.now();
    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          field_names: JSON.stringify(REQUIRED_FIELDS),
          view_id: BACKLOG_VIEW_ID, // ビューを使用（フィルター済み）
        },
      });

      if (response.data?.items) {
        allRecords.push(...response.data.items);
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    const fetchElapsed = Date.now() - fetchStartTime;
    console.log(`[order-backlog] Records fetched from view: ${allRecords.length} in ${fetchElapsed}ms`);

    // 売上見込日でフィルタ（ビューではフラグのみフィルター済み）
    const backlogRecords = allRecords.filter((record) => {
      const fields = record.fields as any;

      // 売上見込日がカットオフ日以降であること
      const mikomiDate = extractTextValue(fields?.["売上見込日"]);
      if (!mikomiDate || !cutoffDate) return false;

      const mikomi = parseDate(mikomiDate);
      const cutoff = parseDate(cutoffDate);
      if (!mikomi || !cutoff) return false;

      // 売上見込日が期間内であること
      const periodEnd = parseDate(dateRange.end);
      if (periodEnd && mikomi > periodEnd) return false;

      return mikomi >= cutoff;
    });

    console.log(`[order-backlog] Backlog records after date filter: ${backlogRecords.length}`);

    // 集計
    const monthlyMap = new Map<number, { count: number; amount: number }>();
    const salesPersonMap = new Map<string, {
      office: string;
      count: number;
      amount: number;
      monthlyData: Map<number, { count: number; amount: number }>;
    }>();
    const officeMap = new Map<string, {
      count: number;
      amount: number;
      monthlyData: Map<number, { count: number; amount: number }>;
    }>();
    const regionMap = new Map<string, { count: number; amount: number }>();

    let totalCount = 0;
    let totalAmount = 0;

    for (const record of backlogRecords) {
      const fields = record.fields as any;
      const amount = parseFloat(String(fields?.["受注金額"] || 0)) || 0;
      const mikomiDate = extractTextValue(fields?.["売上見込日"]);
      const monthIndex = getFiscalMonthIndex(mikomiDate);

      const tantousha = extractTextValue(fields?.["担当者"]) || "未設定";
      let eigyosho = fields?.["部門"]
        ? extractOfficeFromDepartment(fields?.["部門"], departmentMap)
        : "未設定";
      if (tantousha === HQ_SALES_PERSON) {
        eigyosho = "本社";
      }

      const regionKey = getRegion(tantousha, eigyosho);
      const regionName = regionKey === "east" ? "東日本" : regionKey === "west" ? "西日本" : "本社";

      totalCount++;
      totalAmount += amount;

      // 月次集計
      if (monthIndex >= 0) {
        if (!monthlyMap.has(monthIndex)) {
          monthlyMap.set(monthIndex, { count: 0, amount: 0 });
        }
        const m = monthlyMap.get(monthIndex)!;
        m.count++;
        m.amount += amount;
      }

      // 担当者別集計
      if (!salesPersonMap.has(tantousha)) {
        salesPersonMap.set(tantousha, {
          office: eigyosho,
          count: 0,
          amount: 0,
          monthlyData: new Map(),
        });
      }
      const sp = salesPersonMap.get(tantousha)!;
      sp.count++;
      sp.amount += amount;
      if (monthIndex >= 0) {
        if (!sp.monthlyData.has(monthIndex)) {
          sp.monthlyData.set(monthIndex, { count: 0, amount: 0 });
        }
        const spm = sp.monthlyData.get(monthIndex)!;
        spm.count++;
        spm.amount += amount;
      }

      // 営業所別集計
      if (!officeMap.has(eigyosho)) {
        officeMap.set(eigyosho, {
          count: 0,
          amount: 0,
          monthlyData: new Map(),
        });
      }
      const o = officeMap.get(eigyosho)!;
      o.count++;
      o.amount += amount;
      if (monthIndex >= 0) {
        if (!o.monthlyData.has(monthIndex)) {
          o.monthlyData.set(monthIndex, { count: 0, amount: 0 });
        }
        const om = o.monthlyData.get(monthIndex)!;
        om.count++;
        om.amount += amount;
      }

      // 地域別集計
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { count: 0, amount: 0 });
      }
      const r = regionMap.get(regionName)!;
      r.count++;
      r.amount += amount;
    }

    // 結果を配列に変換
    const monthlyData: MonthlyBacklogData[] = Array.from({ length: 12 }, (_, i) => ({
      month: getFiscalMonthName(i),
      monthIndex: i,
      count: monthlyMap.get(i)?.count || 0,
      amount: monthlyMap.get(i)?.amount || 0,
    }));

    const salesPersonSummary: SalesPersonBacklog[] = Array.from(salesPersonMap.entries())
      .map(([name, data]) => ({
        name,
        office: data.office,
        count: data.count,
        amount: data.amount,
        monthlyData: Array.from({ length: 12 }, (_, i) => ({
          month: getFiscalMonthName(i),
          monthIndex: i,
          count: data.monthlyData.get(i)?.count || 0,
          amount: data.monthlyData.get(i)?.amount || 0,
        })),
      }))
      .sort((a, b) => b.amount - a.amount);

    const officeSummary: OfficeBacklog[] = Array.from(officeMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        amount: data.amount,
        monthlyData: Array.from({ length: 12 }, (_, i) => ({
          month: getFiscalMonthName(i),
          monthIndex: i,
          count: data.monthlyData.get(i)?.count || 0,
          amount: data.monthlyData.get(i)?.amount || 0,
        })),
      }))
      .sort((a, b) => b.amount - a.amount);

    const regionOrder = ["東日本", "西日本", "本社"];
    const regionSummary: RegionBacklog[] = regionOrder.map((name) => {
      const data = regionMap.get(name);
      const regionKey = name === "東日本" ? "east" : name === "西日本" ? "west" : "hq";
      return {
        region: name,
        regionKey: regionKey as "east" | "west" | "hq",
        count: data?.count || 0,
        amount: data?.amount || 0,
      };
    });

    const result: BacklogSummary = {
      period,
      dateRange,
      latestSoldMonth,
      cutoffDate,
      totalCount,
      totalAmount,
      monthlyData,
      salesPersonSummary,
      officeSummary,
      regionSummary,
    };

    const responseData = {
      success: true,
      data: result,
    };

    setCachedData(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[order-backlog] Error:", error);
    return NextResponse.json(
      { error: "受注残データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
