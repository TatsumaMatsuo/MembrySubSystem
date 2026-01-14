import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// テーブルID（売上データ）
const TABLE_ID = "tbl65w6u6J72QFoz";

// シンプルなインメモリキャッシュ（TTL: 30分に延長）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

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

// 赤字案件
interface DeficitRecord {
  seiban: string;          // 製番
  salesDate: string;       // 売上日
  customer: string;        // 得意先
  tantousha: string;       // 担当者
  office: string;          // 営業所
  pjCategory: string;      // PJ区分
  industry: string;        // 産業分類
  amount: number;          // 売上金額
  cost: number;            // 原価
  profit: number;          // 粗利（マイナス）
  profitRate: number;      // 粗利率
}

// 赤字案件分析
interface DeficitAnalysis {
  // 赤字案件一覧
  records: DeficitRecord[];
  // 集計
  totalCount: number;
  totalAmount: number;
  totalLoss: number;       // 損失合計（絶対値）
  // 分析軸別集計
  byPjCategory: { name: string; count: number; loss: number; avgProfitRate: number }[];
  byTantousha: { name: string; office: string; count: number; loss: number; avgProfitRate: number }[];
  byCustomer: { name: string; count: number; loss: number; avgProfitRate: number }[];
  byMonth: { month: string; monthIndex: number; count: number; loss: number }[];
  byIndustry: { name: string; count: number; loss: number; avgProfitRate: number }[];
  // 傾向分析
  patterns: {
    highRiskPjCategories: string[];      // 赤字率が高いPJ区分
    highRiskCustomers: string[];         // 赤字頻度が高い顧客
    seasonalPattern: string | null;      // 季節性パターン
    avgDeficitRate: number;              // 全体の赤字率
    commonFactors: string[];             // 共通要因
  };
  // 対策提案
  recommendations: string[];
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
  // WEB新規 月別推移
  webNewMonthlyData: {
    month: string;
    monthIndex: number;
    webNew: number;      // Web新規売上
    webNewCount: number; // Web新規件数
    normal: number;      // 通常売上
    normalCount: number; // 通常件数
  }[];
  // 営業担当者別
  salesPersonSummary: SalesPersonSummary[];
  // 営業所別担当者リスト
  officeSalesPersons: OfficeSalesPersons[];
  // 赤字案件分析
  deficitAnalysis: DeficitAnalysis;
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
      // WEB新規 月別集計
      const webNewMonthlyMap = new Map<number, { webNew: number; webNewCount: number; normal: number; normalCount: number }>();
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

        // WEB新規 月別集計
        if (monthIndex >= 0) {
          if (!webNewMonthlyMap.has(monthIndex)) {
            webNewMonthlyMap.set(monthIndex, { webNew: 0, webNewCount: 0, normal: 0, normalCount: 0 });
          }
          const wnm = webNewMonthlyMap.get(monthIndex)!;
          const isWebNew = webNew === "Web新規" || webNew === "TEL新規";
          if (isWebNew) {
            wnm.webNew += amount;
            wnm.webNewCount++;
          } else {
            wnm.normal += amount;
            wnm.normalCount++;
          }
        }

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

      // ========== 赤字案件分析 ==========
      const deficitRecords: DeficitRecord[] = [];
      const deficitByPjCategory = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByTantousha = new Map<string, { office: string; count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByCustomer = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByMonth = new Map<number, { count: number; loss: number }>();
      const deficitByIndustry = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();

      // PJ区分ごとの全体件数（赤字率計算用）
      const totalByPjCategory = new Map<string, number>();
      const totalByCustomer = new Map<string, number>();

      // 赤字案件を抽出・集計
      periodRecords.forEach((record) => {
        const amount = parseFloat(String(record.fields.金額 || 0)) || 0;
        const cost = parseFloat(String(record.fields.実績_原価計 || record.fields.予定_原価計 || 0)) || 0;
        const profit = amount - cost;
        const profitRate = amount > 0 ? (profit / amount) * 100 : 0;

        const uriageDateStr = extractTextValue(record.fields.売上日);
        const monthIndex = getFiscalMonthIndex(uriageDateStr);
        const tantousha = extractTextValue(record.fields.担当者) || "未設定";
        let eigyosho = record.fields.部課
          ? extractOfficeFromDepartment(record.fields.部課, departmentMap)
          : "未設定";
        if (tantousha === HQ_SALES_PERSON) {
          eigyosho = "本社";
        }
        const pjCategory = extractTextValue(record.fields.PJ区分) || "未分類";
        const industry = extractTextValue(record.fields.産業分類) || "未分類";
        const customer = extractTextValue(record.fields.得意先) || "未設定";
        const seiban = extractTextValue(record.fields.製番) || "";

        // 全体件数をカウント
        totalByPjCategory.set(pjCategory, (totalByPjCategory.get(pjCategory) || 0) + 1);
        totalByCustomer.set(customer, (totalByCustomer.get(customer) || 0) + 1);

        // 赤字案件のみ集計
        if (profit < 0) {
          const loss = Math.abs(profit);

          deficitRecords.push({
            seiban,
            salesDate: uriageDateStr,
            customer,
            tantousha,
            office: eigyosho,
            pjCategory,
            industry,
            amount,
            cost,
            profit,
            profitRate,
          });

          // PJ区分別
          if (!deficitByPjCategory.has(pjCategory)) {
            deficitByPjCategory.set(pjCategory, { count: 0, loss: 0, totalAmount: 0, totalProfit: 0 });
          }
          const pjData = deficitByPjCategory.get(pjCategory)!;
          pjData.count++;
          pjData.loss += loss;
          pjData.totalAmount += amount;
          pjData.totalProfit += profit;

          // 担当者別
          if (!deficitByTantousha.has(tantousha)) {
            deficitByTantousha.set(tantousha, { office: eigyosho, count: 0, loss: 0, totalAmount: 0, totalProfit: 0 });
          }
          const tanData = deficitByTantousha.get(tantousha)!;
          tanData.count++;
          tanData.loss += loss;
          tanData.totalAmount += amount;
          tanData.totalProfit += profit;

          // 顧客別
          if (!deficitByCustomer.has(customer)) {
            deficitByCustomer.set(customer, { count: 0, loss: 0, totalAmount: 0, totalProfit: 0 });
          }
          const custData = deficitByCustomer.get(customer)!;
          custData.count++;
          custData.loss += loss;
          custData.totalAmount += amount;
          custData.totalProfit += profit;

          // 月別
          if (monthIndex >= 0) {
            if (!deficitByMonth.has(monthIndex)) {
              deficitByMonth.set(monthIndex, { count: 0, loss: 0 });
            }
            const monthData = deficitByMonth.get(monthIndex)!;
            monthData.count++;
            monthData.loss += loss;
          }

          // 産業別
          if (!deficitByIndustry.has(industry)) {
            deficitByIndustry.set(industry, { count: 0, loss: 0, totalAmount: 0, totalProfit: 0 });
          }
          const indData = deficitByIndustry.get(industry)!;
          indData.count++;
          indData.loss += loss;
          indData.totalAmount += amount;
          indData.totalProfit += profit;
        }
      });

      // 赤字案件を損失額降順にソート
      deficitRecords.sort((a, b) => a.profit - b.profit);

      // 集計配列化
      const byPjCategory = Array.from(deficitByPjCategory.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          loss: data.loss,
          avgProfitRate: data.totalAmount > 0 ? (data.totalProfit / data.totalAmount) * 100 : 0,
        }))
        .sort((a, b) => b.loss - a.loss);

      const byTantousha = Array.from(deficitByTantousha.entries())
        .map(([name, data]) => ({
          name,
          office: data.office,
          count: data.count,
          loss: data.loss,
          avgProfitRate: data.totalAmount > 0 ? (data.totalProfit / data.totalAmount) * 100 : 0,
        }))
        .sort((a, b) => b.loss - a.loss);

      const byCustomer = Array.from(deficitByCustomer.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          loss: data.loss,
          avgProfitRate: data.totalAmount > 0 ? (data.totalProfit / data.totalAmount) * 100 : 0,
        }))
        .sort((a, b) => b.loss - a.loss);

      const byMonth = Array.from({ length: 12 }, (_, i) => ({
        month: getFiscalMonthName(i),
        monthIndex: i,
        count: deficitByMonth.get(i)?.count || 0,
        loss: deficitByMonth.get(i)?.loss || 0,
      }));

      const byIndustry = Array.from(deficitByIndustry.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          loss: data.loss,
          avgProfitRate: data.totalAmount > 0 ? (data.totalProfit / data.totalAmount) * 100 : 0,
        }))
        .sort((a, b) => b.loss - a.loss);

      // 傾向分析
      const avgDeficitRate = totalCount > 0 ? (deficitRecords.length / totalCount) * 100 : 0;

      // 高リスクPJ区分（赤字率が平均より高いもの）
      const highRiskPjCategories = byPjCategory
        .filter((pj) => {
          const totalPj = totalByPjCategory.get(pj.name) || 0;
          const deficitRate = totalPj > 0 ? (pj.count / totalPj) * 100 : 0;
          return deficitRate > avgDeficitRate && pj.count >= 2;
        })
        .slice(0, 5)
        .map((pj) => pj.name);

      // 高リスク顧客（赤字が複数回発生）
      const highRiskCustomers = byCustomer
        .filter((c) => c.count >= 2)
        .slice(0, 5)
        .map((c) => c.name);

      // 季節性パターン検出
      const monthlyDeficitCounts = byMonth.map((m) => m.count);
      const maxMonth = monthlyDeficitCounts.indexOf(Math.max(...monthlyDeficitCounts));
      const seasonalPattern = monthlyDeficitCounts[maxMonth] >= 3
        ? `${getFiscalMonthName(maxMonth)}に赤字案件が集中する傾向`
        : null;

      // 共通要因の特定
      const commonFactors: string[] = [];
      if (byPjCategory.length > 0 && byPjCategory[0].count >= 3) {
        commonFactors.push(`PJ区分「${byPjCategory[0].name}」での赤字が多発`);
      }
      if (byCustomer.length > 0 && byCustomer[0].count >= 3) {
        commonFactors.push(`顧客「${byCustomer[0].name}」での赤字が多発`);
      }
      if (avgDeficitRate > 5) {
        commonFactors.push(`赤字率${avgDeficitRate.toFixed(1)}%は業界平均より高い水準`);
      }

      // 対策提案
      const recommendations: string[] = [];
      if (highRiskPjCategories.length > 0) {
        recommendations.push(`高リスクPJ区分（${highRiskPjCategories.join("、")}）の見積精度向上を検討`);
      }
      if (highRiskCustomers.length > 0) {
        recommendations.push(`リピート赤字顧客への価格交渉・取引条件見直しを推奨`);
      }
      if (byTantousha.length > 0) {
        const topDeficitPerson = byTantousha[0];
        if (topDeficitPerson.count >= 3) {
          recommendations.push(`${topDeficitPerson.name}氏の案件について原価管理の強化を検討`);
        }
      }
      if (seasonalPattern) {
        recommendations.push(`${seasonalPattern}のため、該当時期の受注判断を慎重に`);
      }
      if (deficitRecords.length > 0) {
        const avgLoss = deficitRecords.reduce((sum, r) => sum + Math.abs(r.profit), 0) / deficitRecords.length;
        if (avgLoss > 500000) {
          recommendations.push(`平均赤字額${formatAmount(avgLoss)}と高額のため、大型案件の原価精査を強化`);
        }
      }
      if (recommendations.length === 0) {
        recommendations.push("現状の赤字率は許容範囲内です。継続的なモニタリングを推奨");
      }

      // 金額フォーマット関数（ローカル）
      function formatAmount(amount: number): string {
        if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億`;
        if (amount >= 10000) return `${Math.round(amount / 10000)}万`;
        return amount.toLocaleString();
      }

      // WEB新規 月別推移データ配列化
      const webNewMonthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: getFiscalMonthName(i),
        monthIndex: i,
        webNew: webNewMonthlyMap.get(i)?.webNew || 0,
        webNewCount: webNewMonthlyMap.get(i)?.webNewCount || 0,
        normal: webNewMonthlyMap.get(i)?.normal || 0,
        normalCount: webNewMonthlyMap.get(i)?.normalCount || 0,
      }));

      const deficitAnalysis: DeficitAnalysis = {
        records: deficitRecords.slice(0, 100), // 上位100件のみ
        totalCount: deficitRecords.length,
        totalAmount: deficitRecords.reduce((sum, r) => sum + r.amount, 0),
        totalLoss: deficitRecords.reduce((sum, r) => sum + Math.abs(r.profit), 0),
        byPjCategory,
        byTantousha,
        byCustomer: byCustomer.slice(0, 20), // 上位20件
        byMonth,
        byIndustry: byIndustry.slice(0, 15), // 上位15件
        patterns: {
          highRiskPjCategories,
          highRiskCustomers,
          seasonalPattern,
          avgDeficitRate,
          commonFactors,
        },
        recommendations,
      };

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
        webNewMonthlyData,
        salesPersonSummary,
        officeSalesPersons,
        deficitAnalysis,
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
