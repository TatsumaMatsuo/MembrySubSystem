import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// テーブルID（売上データ）
const TABLE_ID = "tbl65w6u6J72QFoz";

// シンプルなインメモリキャッシュ（TTL: 5分）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

// 山口篤樹は本社扱い（データ内の名前はスペースあり）
const HQ_SALES_PERSON = "山口 篤樹";

// 期から日付範囲を計算（期初は8月）
// 50期 = 2025/08/01 〜 2026/07/31
function getPeriodDateRange(period: number): { start: string; end: string } {
  const startYear = period + 1975;
  const endYear = startYear + 1;
  return {
    start: `${startYear}/08/01`,
    end: `${endYear}/07/31`,
  };
}

// 現在の期を計算
// 50期 = 2025/08/01 〜 2026/07/31
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
// 形式: "YYYY/MM/DD" または "YYYY-MM-DD"
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

// 日付が範囲内かどうかを判定
function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  const date = parseDate(dateStr);
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

// 日付文字列から期内の月インデックスを取得
function getFiscalMonthIndex(dateStr: string): number {
  const date = parseDate(dateStr);
  if (!date) return -1;
  const month = date.getMonth() + 1; // 1-12
  return month >= 8 ? month - 8 : month + 4;
}

// 四半期を取得（Q1: 8-10月, Q2: 11-1月, Q3: 2-4月, Q4: 5-7月）
function getQuarter(monthIndex: number): number {
  if (monthIndex <= 2) return 1;
  if (monthIndex <= 5) return 2;
  if (monthIndex <= 8) return 3;
  return 4;
}

// フィールドからテキスト値を抽出
function extractTextValue(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "object" && first?.text) return first.text;
    if (typeof first === "string") return first;
  }
  if (typeof value === "object" && value?.text) return value.text;
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
      return String(item);
    }).filter(Boolean);
  }
  if (typeof value === "object" && value?.text) return [value.text];
  return [];
}

// 営業所名のリスト（部署フィールドから営業所を判定するため）
const OFFICE_NAMES = [
  "仙台営業所", "北関東営業所", "東京営業所", "名古屋営業所",
  "大阪営業所", "北九州営業所", "福岡営業所", "佐賀営業所", "八女営業所", "宮崎営業所",
  "本社",
];

// 部署フィールドから営業所を抽出（複数選択対応）
// optionMapがあればオプションIDをテキストに変換
function extractOfficeFromDepartment(
  departmentValue: any,
  optionMap?: Map<string, string>
): string {
  let departments = extractMultiSelectValues(departmentValue);

  // オプションIDをテキストに変換
  if (optionMap && optionMap.size > 0) {
    departments = departments.map((id) => optionMap.get(id) || id);
  }

  // 営業所名に一致するものを探す
  for (const dept of departments) {
    // 完全一致
    if (OFFICE_NAMES.includes(dept)) {
      return dept;
    }
    // 部分一致（「〇〇営業所」を含む場合）
    const matchedOffice = OFFICE_NAMES.find((office) => dept.includes(office) || office.includes(dept));
    if (matchedOffice) {
      return matchedOffice;
    }
  }
  // 営業所が見つからない場合は最初の部署を返す
  return departments[0] || "未設定";
}

// 担当者の営業所を判定
function getOfficeFromTantousha(tantousha: string, allRecords: any[]): string {
  // 担当者名から営業所を推定（レコードの営業所フィールドがあれば使用）
  // ここでは担当者名をそのまま返す（後でマスタと照合）
  return tantousha;
}

// 地域を判定
function getRegion(tantousha: string, eigyosho: string): "east" | "west" | "hq" {
  if (tantousha === HQ_SALES_PERSON) return "hq";
  const region = OFFICE_REGION_MAP[eigyosho];
  if (region) return region;
  // 営業所不明の場合は担当者名で判定
  return "hq";
}

interface SalesRecord {
  fields: {
    製番?: string;
    売上日?: string;
    出荷日?: string;
    金額?: string | number;
    実績_原価計?: string | number;
    予定_原価計?: string | number;
    PJ区分?: any;
    産業分類?: any;
    納入先県名?: any;
    "Web新規（TEL含む）"?: any;
    得意先?: string;
    担当者?: any;
    部課?: any;  // 営業所判定に使用
    [key: string]: any;
  };
}

interface DimensionSummary {
  name: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface MonthlyData {
  month: string;
  monthIndex: number;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface QuarterlyData {
  quarter: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
}

interface RegionSummary {
  region: string;
  regionKey: "east" | "west" | "hq";
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
  offices: DimensionSummary[];
}

// 営業担当者サマリー（月次データ付き）
interface SalesPersonSummary {
  name: string;
  office: string;
  count: number;
  amount: number;
  cost: number;      // 原価
  profit: number;    // 粗利
  monthlyData: MonthlyData[];
}

// 営業所別担当者マップ
interface OfficeSalesPersons {
  office: string;
  salesPersons: string[];
}

interface PeriodDashboard {
  period: number;
  dateRange: { start: string; end: string };
  // 全体サマリー
  totalCount: number;
  totalAmount: number;
  totalCost: number;     // 原価合計
  totalProfit: number;   // 粗利合計
  // 月次データ
  monthlyData: MonthlyData[];
  // 四半期データ
  quarterlyData: QuarterlyData[];
  // 累計データ（月ごとの累計）
  cumulativeData: MonthlyData[];
  // 地域別
  regionSummary: RegionSummary[];
  // 営業所別
  officeSummary: DimensionSummary[];
  // PJ区分別
  pjCategorySummary: DimensionSummary[];
  // 産業分類別
  industrySummary: DimensionSummary[];
  // 県別
  prefectureSummary: DimensionSummary[];
  // WEB新規別
  webNewSummary: DimensionSummary[];
  // 営業担当者別
  salesPersonSummary: SalesPersonSummary[];
  // 営業所別担当者リスト
  officeSalesPersons: OfficeSalesPersons[];
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fromPeriod = parseInt(searchParams.get("fromPeriod") || String(getCurrentPeriod() - 2), 10);
  const toPeriod = parseInt(searchParams.get("toPeriod") || String(getCurrentPeriod()), 10);

  const cacheKey = `sales-dashboard:${fromPeriod}:${toPeriod}`;
  const cachedResult = getCachedData(cacheKey);
  if (cachedResult) {
    return NextResponse.json(cachedResult);
  }

  try {
    // Lark組織構造から部署IDと部署名のマッピングを取得
    const departmentMap = new Map<string, string>();
    try {
      const deptResponse = await listAllDepartments();
      if (deptResponse.code === 0 && deptResponse.data?.items) {
        for (const dept of deptResponse.data.items) {
          // open_department_id または department_id をキーとして使用
          const deptId = (dept as any).open_department_id || (dept as any).department_id;
          const deptName = (dept as any).name;
          if (deptId && deptName) {
            departmentMap.set(deptId, deptName);
            // 数値IDの場合も対応（文字列化）
            departmentMap.set(String(deptId), deptName);
          }
        }
      }
    } catch (e) {
      // 部署マッピング取得失敗時は空のまま継続
    }

    const overallDateRange = {
      start: getPeriodDateRange(fromPeriod).start,
      end: getPeriodDateRange(toPeriod).end,
    };

    let allRecords: SalesRecord[] = [];
    let pageToken: string | undefined;
    const dateFilter = `AND(CurrentValue.[売上日] >= "${overallDateRange.start}", CurrentValue.[売上日] <= "${overallDateRange.end}")`;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: TABLE_ID,
        },
        params: {
          page_size: 500,
          page_token: pageToken,
          filter: dateFilter,
        },
      });

      if (response.data?.items) {
        allRecords = allRecords.concat(response.data.items as SalesRecord[]);
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    const results: PeriodDashboard[] = [];

    for (let period = fromPeriod; period <= toPeriod; period++) {
      const dateRange = getPeriodDateRange(period);

      const periodRecords = allRecords.filter((record) => {
        const uriageDateStr = extractTextValue(record.fields.売上日);
        return isDateInRange(uriageDateStr, dateRange.start, dateRange.end);
      });

      // 集計用マップ（cost: 原価, profit: 粗利を追加）
      type SummaryData = { count: number; amount: number; cost: number; profit: number };
      const monthlyMap = new Map<number, SummaryData>();
      const quarterlyMap = new Map<number, SummaryData>();
      const regionMap = new Map<string, SummaryData & { offices: Map<string, SummaryData> }>();
      const officeMap = new Map<string, SummaryData>();
      const pjCategoryMap = new Map<string, SummaryData>();
      const industryMap = new Map<string, SummaryData>();
      const prefectureMap = new Map<string, SummaryData>();
      const webNewMap = new Map<string, SummaryData>();
      // 営業担当者別集計
      const salesPersonMap = new Map<string, {
        office: string;
        count: number;
        amount: number;
        cost: number;
        profit: number;
        monthlyData: Map<number, SummaryData>;
      }>();
      // 営業所→担当者マップ
      const officeSalesPersonsMap = new Map<string, Set<string>>();

      let totalCount = 0;
      let totalAmount = 0;
      let totalCost = 0;
      let totalProfit = 0;

      periodRecords.forEach((record) => {
        const amount = parseFloat(String(record.fields.金額 || 0)) || 0;
        // 原価は実績_原価計を優先、なければ予定_原価計を使用
        const cost = parseFloat(String(record.fields.実績_原価計 || record.fields.予定_原価計 || 0)) || 0;
        // 粗利 = 売上 - 原価
        const profit = amount - cost;

        const uriageDateStr = extractTextValue(record.fields.売上日);
        const monthIndex = getFiscalMonthIndex(uriageDateStr);
        const quarter = getQuarter(monthIndex);

        const tantousha = extractTextValue(record.fields.担当者) || "未設定";
        // 部課フィールドから営業所を判定
        // 山口篤樹は佐賀営業所所属だが、集計上は本社扱い
        let eigyosho = record.fields.部課
          ? extractOfficeFromDepartment(record.fields.部課, departmentMap)
          : "未設定";
        if (tantousha === HQ_SALES_PERSON) {
          eigyosho = "本社";
        }
        const pjCategory = extractTextValue(record.fields.PJ区分) || "未分類";
        const industry = extractTextValue(record.fields.産業分類) || "未分類";
        const prefecture = extractTextValue(record.fields.納入先県名) || "未設定";
        const webNew = extractTextValue(record.fields["Web新規（TEL含む）"]) || "通常";

        const regionKey = getRegion(tantousha, eigyosho);
        const regionName = regionKey === "east" ? "東日本" : regionKey === "west" ? "西日本" : "本社";

        totalCount++;
        totalAmount += amount;
        totalCost += cost;
        totalProfit += profit;

        // 月次集計
        if (monthIndex >= 0) {
          if (!monthlyMap.has(monthIndex)) {
            monthlyMap.set(monthIndex, { count: 0, amount: 0, cost: 0, profit: 0 });
          }
          const m = monthlyMap.get(monthIndex)!;
          m.count++;
          m.amount += amount;
          m.cost += cost;
          m.profit += profit;
        }

        // 四半期集計
        if (!quarterlyMap.has(quarter)) {
          quarterlyMap.set(quarter, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const q = quarterlyMap.get(quarter)!;
        q.count++;
        q.amount += amount;
        q.cost += cost;
        q.profit += profit;

        // 地域別集計
        if (!regionMap.has(regionName)) {
          regionMap.set(regionName, { count: 0, amount: 0, cost: 0, profit: 0, offices: new Map() });
        }
        const r = regionMap.get(regionName)!;
        r.count++;
        r.amount += amount;
        r.cost += cost;
        r.profit += profit;

        // 営業所別（地域内）
        const officeKey = eigyosho || tantousha;
        if (!r.offices.has(officeKey)) {
          r.offices.set(officeKey, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const ro = r.offices.get(officeKey)!;
        ro.count++;
        ro.amount += amount;
        ro.cost += cost;
        ro.profit += profit;

        // 営業所別（全体）
        if (!officeMap.has(officeKey)) {
          officeMap.set(officeKey, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const o = officeMap.get(officeKey)!;
        o.count++;
        o.amount += amount;
        o.cost += cost;
        o.profit += profit;

        // PJ区分別
        if (!pjCategoryMap.has(pjCategory)) {
          pjCategoryMap.set(pjCategory, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const pj = pjCategoryMap.get(pjCategory)!;
        pj.count++;
        pj.amount += amount;
        pj.cost += cost;
        pj.profit += profit;

        // 産業分類別
        if (!industryMap.has(industry)) {
          industryMap.set(industry, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const ind = industryMap.get(industry)!;
        ind.count++;
        ind.amount += amount;
        ind.cost += cost;
        ind.profit += profit;

        // 県別
        if (!prefectureMap.has(prefecture)) {
          prefectureMap.set(prefecture, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const pref = prefectureMap.get(prefecture)!;
        pref.count++;
        pref.amount += amount;
        pref.cost += cost;
        pref.profit += profit;

        // WEB新規別
        if (!webNewMap.has(webNew)) {
          webNewMap.set(webNew, { count: 0, amount: 0, cost: 0, profit: 0 });
        }
        const wn = webNewMap.get(webNew)!;
        wn.count++;
        wn.amount += amount;
        wn.cost += cost;
        wn.profit += profit;

        // 営業担当者別集計
        if (!salesPersonMap.has(tantousha)) {
          salesPersonMap.set(tantousha, {
            office: eigyosho,
            count: 0,
            amount: 0,
            cost: 0,
            profit: 0,
            monthlyData: new Map(),
          });
        }
        const sp = salesPersonMap.get(tantousha)!;
        sp.count++;
        sp.amount += amount;
        sp.cost += cost;
        sp.profit += profit;
        if (monthIndex >= 0) {
          if (!sp.monthlyData.has(monthIndex)) {
            sp.monthlyData.set(monthIndex, { count: 0, amount: 0, cost: 0, profit: 0 });
          }
          const spm = sp.monthlyData.get(monthIndex)!;
          spm.count++;
          spm.amount += amount;
          spm.cost += cost;
          spm.profit += profit;
        }

        // 営業所→担当者マップ
        if (!officeSalesPersonsMap.has(eigyosho)) {
          officeSalesPersonsMap.set(eigyosho, new Set());
        }
        officeSalesPersonsMap.get(eigyosho)!.add(tantousha);
      });

      // 月次データ配列化
      const monthlyData: MonthlyData[] = Array.from({ length: 12 }, (_, i) => ({
        month: getFiscalMonthName(i),
        monthIndex: i,
        count: monthlyMap.get(i)?.count || 0,
        amount: monthlyMap.get(i)?.amount || 0,
        cost: monthlyMap.get(i)?.cost || 0,
        profit: monthlyMap.get(i)?.profit || 0,
      }));

      // 累計データ作成
      let cumCount = 0;
      let cumAmount = 0;
      let cumCost = 0;
      let cumProfit = 0;
      const cumulativeData: MonthlyData[] = monthlyData.map((m) => {
        cumCount += m.count;
        cumAmount += m.amount;
        cumCost += m.cost;
        cumProfit += m.profit;
        return {
          month: m.month,
          monthIndex: m.monthIndex,
          count: cumCount,
          amount: cumAmount,
          cost: cumCost,
          profit: cumProfit,
        };
      });

      // 四半期データ配列化
      const quarterlyData: QuarterlyData[] = [1, 2, 3, 4].map((q) => ({
        quarter: `Q${q}`,
        count: quarterlyMap.get(q)?.count || 0,
        amount: quarterlyMap.get(q)?.amount || 0,
        cost: quarterlyMap.get(q)?.cost || 0,
        profit: quarterlyMap.get(q)?.profit || 0,
      }));

      // 地域別サマリー
      const regionOrder = ["東日本", "西日本", "本社"];
      const regionSummary: RegionSummary[] = regionOrder.map((name) => {
        const data = regionMap.get(name);
        const regionKey = name === "東日本" ? "east" : name === "西日本" ? "west" : "hq";
        return {
          region: name,
          regionKey: regionKey as "east" | "west" | "hq",
          count: data?.count || 0,
          amount: data?.amount || 0,
          cost: data?.cost || 0,
          profit: data?.profit || 0,
          offices: data?.offices
            ? Array.from(data.offices.entries())
                .map(([n, d]) => ({ name: n, count: d.count, amount: d.amount, cost: d.cost, profit: d.profit }))
                .sort((a, b) => b.amount - a.amount)
            : [],
        };
      });

      // 各ディメンション配列化（金額降順）
      type SummaryMapData = { count: number; amount: number; cost: number; profit: number };
      const toSummaryArray = (map: Map<string, SummaryMapData>): DimensionSummary[] =>
        Array.from(map.entries())
          .map(([name, data]) => ({ name, count: data.count, amount: data.amount, cost: data.cost, profit: data.profit }))
          .sort((a, b) => b.amount - a.amount);

      // 営業担当者別サマリー配列化
      const salesPersonSummary: SalesPersonSummary[] = Array.from(salesPersonMap.entries())
        .map(([name, data]) => ({
          name,
          office: data.office,
          count: data.count,
          amount: data.amount,
          cost: data.cost,
          profit: data.profit,
          monthlyData: Array.from({ length: 12 }, (_, i) => ({
            month: getFiscalMonthName(i),
            monthIndex: i,
            count: data.monthlyData.get(i)?.count || 0,
            amount: data.monthlyData.get(i)?.amount || 0,
            cost: data.monthlyData.get(i)?.cost || 0,
            profit: data.monthlyData.get(i)?.profit || 0,
          })),
        }))
        .sort((a, b) => b.amount - a.amount);

      // 営業所別担当者リスト配列化
      const officeSalesPersons: OfficeSalesPersons[] = Array.from(officeSalesPersonsMap.entries())
        .map(([office, persons]) => ({
          office,
          salesPersons: Array.from(persons).sort(),
        }))
        .sort((a, b) => a.office.localeCompare(b.office));

      results.push({
        period,
        dateRange,
        totalCount,
        totalAmount,
        totalCost,
        totalProfit,
        monthlyData,
        quarterlyData,
        cumulativeData,
        regionSummary,
        officeSummary: toSummaryArray(officeMap),
        pjCategorySummary: toSummaryArray(pjCategoryMap),
        industrySummary: toSummaryArray(industryMap),
        prefectureSummary: toSummaryArray(prefectureMap),
        webNewSummary: toSummaryArray(webNewMap),
        salesPersonSummary,
        officeSalesPersons,
      });
    }

    const responseData = {
      success: true,
      currentPeriod: getCurrentPeriod(),
      data: results,
    };

    setCachedData(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Sales dashboard error:", error);
    return NextResponse.json(
      { error: "売上ダッシュボードデータの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
