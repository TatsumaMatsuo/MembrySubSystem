import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// テーブルID（売上データ）
const TABLE_ID = "tbl65w6u6J72QFoz";

// ビューID（パフォーマンス最適化用）
// 各ビューは特定の集計に最適化されている
const VIEWS = {
  main: "vewJWLOWQP",        // 月PJ区分別売上情報（全フィールド含む）
  tantousha: "vewg0CcfI9",  // 月部門担当者別売上情報
  pjCategory: "vewJWLOWQP", // 月PJ区分別売上情報
  prefecture: "vewpwttyOA", // 月納入先県別売上情報
  webNew: "vewIuwNIss",     // 月WEB新規別売上情報
  industry: "vew8nAL6zi",   // 月産業分類別売上情報
};

// 受注残ビューID（受注残チェック時に使用）
const BACKLOG_VIEWS = {
  tantousha: "vewCU8LrsT",   // 月部門担当者別受注残
  pjCategory: "vew9RC2kW6",  // 月PJ区分受注残
  prefecture: "vewFLIPWLu",  // 月納入先県別受注残
  webNew: "vewdepfeQU",      // 月WEB新規別受注残
  industry: "vewcceNSvU",    // 月産業分類別受注残
};

// 受注残データ用テーブルID（案件一覧テーブル）
const BACKLOG_TABLE_ID = "tbl1ICzfUixpGqDy";

// シンプルなインメモリキャッシュ（TTL: 30分に延長）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

// リトライ可能なLark APIエラーコード
const RETRYABLE_ERROR_CODES = [
  1254607, // Data not ready, please try again later
  1254609, // Busy, please try again later
];

// リトライ付きでLark API呼び出しを実行
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Lark APIのエラーレスポンスをチェック（response.codeまたはresponse.data.codeをチェック）
      const resultData = result as any;
      const errorCode = resultData?.code || resultData?.data?.code;
      if (errorCode && RETRYABLE_ERROR_CODES.includes(errorCode)) {
        console.log(`[sales-dashboard] Lark API returned error ${errorCode}, will retry...`);
        throw { code: errorCode, msg: resultData?.msg || resultData?.data?.msg };
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const errorCode = error?.code || error?.data?.code;
      if (RETRYABLE_ERROR_CODES.includes(errorCode) && attempt < maxRetries) {
        console.log(`[sales-dashboard] Retrying after error ${errorCode} (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

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

// 売上見込月（YYYY/MM形式）から期内の月インデックスを取得
function getFiscalMonthIndexFromYM(ymStr: string): number {
  if (!ymStr) return -1;
  const parts = ymStr.split("/");
  if (parts.length < 2) return -1;
  const month = parseInt(parts[1], 10);
  if (isNaN(month)) return -1;
  return month >= 8 ? month - 8 : month + 4;
}

// 受注残データを取得する関数（order-backlog-summaryと同様の方式）
// ビューではなくテーブルから直接取得し、売上済フラグ・削除フラグでフィルター
async function fetchBacklogData(
  client: any,
  baseToken: string,
  dateRange: { start: string; end: string },
  latestSalesMonthIndex: number
): Promise<Map<number, { count: number; amount: number }>> {
  const backlogMap = new Map<number, { count: number; amount: number }>();
  let pageToken: string | undefined;

  // 必要なフィールドのみ取得
  const BACKLOG_FIELDS = ["製番", "受注金額", "売上見込日", "売上済フラグ", "削除フラグ"];

  // 期間の開始・終了日をDateオブジェクトに変換
  const startDate = parseDate(dateRange.start);
  const endDate = parseDate(dateRange.end);

  // 最終売上月の翌月1日をカットオフ日とする（受注残はこれ以降のみ対象）
  let cutoffDate: Date | null = null;
  if (latestSalesMonthIndex >= 0) {
    // latestSalesMonthIndex: 0=8月, 1=9月, ..., 11=7月
    // 実際の月: 8月=0 -> 8, 9月=1 -> 9, ..., 12月=4 -> 12, 1月=5 -> 1, ..., 7月=11 -> 7
    const actualMonth = latestSalesMonthIndex < 5 ? latestSalesMonthIndex + 8 : latestSalesMonthIndex - 4;
    const year = startDate ? (actualMonth >= 8 ? startDate.getFullYear() : startDate.getFullYear() + 1) : new Date().getFullYear();
    const nextMonth = actualMonth === 12 ? 1 : actualMonth + 1;
    const nextYear = actualMonth === 12 ? year + 1 : year;
    cutoffDate = new Date(nextYear, nextMonth - 1, 1);
  }

  console.log(`[sales-dashboard] Fetching backlog: range=${dateRange.start}~${dateRange.end}, cutoff=${cutoffDate?.toISOString().substring(0, 10) || "none"}`);

  try {
    do {
      const currentPageToken = pageToken;
      const response = await withRetry(async () => {
        return client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: BACKLOG_TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: currentPageToken,
            field_names: JSON.stringify(BACKLOG_FIELDS),
          },
        });
      });

      if (response.data?.items) {
        // 最初のレコードのフィールド内容をデバッグ出力
        if (response.data.items.length > 0 && !currentPageToken) {
          const firstFields = response.data.items[0].fields as any;
          console.log(`[sales-dashboard] Backlog total items: ${response.data.items.length}`);
          console.log(`[sales-dashboard] Backlog first record fields:`, Object.keys(firstFields || {}));
        }

        for (const item of response.data.items) {
          const fields = item.fields as any;

          // 売上済フラグがtrueならスキップ
          if (fields?.["売上済フラグ"] === true) continue;

          // 削除フラグがtrueならスキップ
          if (fields?.["削除フラグ"] === true) continue;

          // 売上見込日を取得
          const mikomiDate = extractTextValue(fields?.["売上見込日"]);
          if (!mikomiDate) continue;

          const mikomiDateObj = parseDate(mikomiDate);
          if (!mikomiDateObj) continue;

          // カットオフ日以降のみ対象（売上済月の翌月以降）
          if (cutoffDate && mikomiDateObj < cutoffDate) continue;

          // 期間終了日以前のみ対象
          if (endDate && mikomiDateObj > endDate) continue;

          const amount = parseFloat(String(fields?.["受注金額"] || 0)) || 0;

          // 売上見込日から月インデックスを取得（文字列を渡す）
          const monthIndex = getFiscalMonthIndex(mikomiDate);
          if (monthIndex >= 0) {
            if (!backlogMap.has(monthIndex)) {
              backlogMap.set(monthIndex, { count: 0, amount: 0 });
            }
            const m = backlogMap.get(monthIndex)!;
            m.count++;
            m.amount += amount;
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);
  } catch (error) {
    console.error(`[sales-dashboard] Backlog fetch error:`, error);
    // エラー時は空のマップを返す（売上データのみで継続）
  }

  console.log(`[sales-dashboard] Backlog result: ${backlogMap.size} months with data`);
  backlogMap.forEach((data, monthIdx) => {
    console.log(`[sales-dashboard] Backlog month ${getFiscalMonthName(monthIdx)}: count=${data.count}, amount=${Math.round(data.amount).toLocaleString()}円`);
  });
  return backlogMap;
}

// 受注残の詳細レコードを取得する関数（テーブル表示用）
async function fetchBacklogRecords(
  client: any,
  baseToken: string,
  dateRange: { start: string; end: string },
  latestSalesMonthIndex: number,
  departmentMap: Map<string, string>
): Promise<BacklogSummary> {
  const records: BacklogRecord[] = [];
  let pageToken: string | undefined;

  // 詳細表示に必要なフィールド
  const BACKLOG_DETAIL_FIELDS = [
    "製番", "受注金額", "売上見込日", "売上済フラグ", "削除フラグ",
    "担当者", "部門", "PJ区分", "産業分類", "得意先"
  ];

  // 期間の開始・終了日をDateオブジェクトに変換
  const startDate = parseDate(dateRange.start);
  const endDate = parseDate(dateRange.end);

  // 最終売上月の翌月1日をカットオフ日とする
  let cutoffDate: Date | null = null;
  if (latestSalesMonthIndex >= 0) {
    const actualMonth = latestSalesMonthIndex < 5 ? latestSalesMonthIndex + 8 : latestSalesMonthIndex - 4;
    const year = startDate ? (actualMonth >= 8 ? startDate.getFullYear() : startDate.getFullYear() + 1) : new Date().getFullYear();
    const nextMonth = actualMonth === 12 ? 1 : actualMonth + 1;
    const nextYear = actualMonth === 12 ? year + 1 : year;
    cutoffDate = new Date(nextYear, nextMonth - 1, 1);
  }

  // 集計用マップ
  const monthlyMap = new Map<number, { count: number; amount: number }>();
  const officeMap = new Map<string, { count: number; amount: number }>();
  const tantoushMap = new Map<string, { office: string; count: number; amount: number }>();
  const pjCategoryMap = new Map<string, { count: number; amount: number }>();
  const industryMap = new Map<string, { count: number; amount: number }>();

  try {
    do {
      const currentPageToken = pageToken;
      const response = await withRetry(async () => {
        return client.bitable.appTableRecord.list({
          path: {
            app_token: baseToken,
            table_id: BACKLOG_TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: currentPageToken,
            field_names: JSON.stringify(BACKLOG_DETAIL_FIELDS),
          },
        });
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;

          // 売上済フラグがtrueならスキップ
          if (fields?.["売上済フラグ"] === true) continue;

          // 削除フラグがtrueならスキップ
          if (fields?.["削除フラグ"] === true) continue;

          // 売上見込日を取得
          const mikomiDate = extractTextValue(fields?.["売上見込日"]);
          if (!mikomiDate) continue;

          const mikomiDateObj = parseDate(mikomiDate);
          if (!mikomiDateObj) continue;

          // カットオフ日以降のみ対象
          if (cutoffDate && mikomiDateObj < cutoffDate) continue;

          // 期間終了日以前のみ対象
          if (endDate && mikomiDateObj > endDate) continue;

          const seiban = extractTextValue(fields?.["製番"]) || "";
          const amount = parseFloat(String(fields?.["受注金額"] || 0)) || 0;
          const tantousha = extractTextValue(fields?.["担当者"]) || "未設定";
          let office = fields?.["部門"]
            ? extractOfficeFromDepartment(fields?.["部門"], departmentMap)
            : "未設定";
          if (tantousha === HQ_SALES_PERSON) {
            office = "本社";
          }
          const pjCategory = extractTextValue(fields?.["PJ区分"]) || "未分類";
          const industry = extractTextValue(fields?.["産業分類"]) || "未分類";
          const customer = extractTextValue(fields?.["得意先"]) || "";
          const monthIndex = getFiscalMonthIndex(mikomiDate);

          // レコード追加
          records.push({
            seiban,
            expectedMonth: getFiscalMonthName(monthIndex),
            expectedMonthIndex: monthIndex,
            office,
            tantousha,
            amount,
            pjCategory,
            industry,
            customer,
          });

          // 月別集計
          if (monthIndex >= 0) {
            if (!monthlyMap.has(monthIndex)) {
              monthlyMap.set(monthIndex, { count: 0, amount: 0 });
            }
            const m = monthlyMap.get(monthIndex)!;
            m.count++;
            m.amount += amount;
          }

          // 営業所別集計
          if (!officeMap.has(office)) {
            officeMap.set(office, { count: 0, amount: 0 });
          }
          const o = officeMap.get(office)!;
          o.count++;
          o.amount += amount;

          // 担当者別集計
          if (!tantoushMap.has(tantousha)) {
            tantoushMap.set(tantousha, { office, count: 0, amount: 0 });
          }
          const t = tantoushMap.get(tantousha)!;
          t.count++;
          t.amount += amount;

          // PJ区分別集計
          if (!pjCategoryMap.has(pjCategory)) {
            pjCategoryMap.set(pjCategory, { count: 0, amount: 0 });
          }
          const pj = pjCategoryMap.get(pjCategory)!;
          pj.count++;
          pj.amount += amount;

          // 産業分類別集計
          if (!industryMap.has(industry)) {
            industryMap.set(industry, { count: 0, amount: 0 });
          }
          const ind = industryMap.get(industry)!;
          ind.count++;
          ind.amount += amount;
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);
  } catch (error) {
    console.error(`[sales-dashboard] Backlog records fetch error:`, error);
  }

  console.log(`[sales-dashboard] Backlog records fetched: ${records.length} records`);

  // 結果を配列に変換
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: getFiscalMonthName(i),
    monthIndex: i,
    count: monthlyMap.get(i)?.count || 0,
    amount: monthlyMap.get(i)?.amount || 0,
  }));

  const byOffice = Array.from(officeMap.entries())
    .map(([name, data]) => ({ name, count: data.count, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  const byTantousha = Array.from(tantoushMap.entries())
    .map(([name, data]) => ({ name, office: data.office, count: data.count, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  const byPjCategory = Array.from(pjCategoryMap.entries())
    .map(([name, data]) => ({ name, count: data.count, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  const byIndustry = Array.from(industryMap.entries())
    .map(([name, data]) => ({ name, count: data.count, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    records: records.sort((a, b) => a.expectedMonthIndex - b.expectedMonthIndex || b.amount - a.amount),
    byMonth,
    byOffice,
    byTantousha,
    byPjCategory,
    byIndustry,
  };
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
  backlogCount?: number;   // 受注残件数
  backlogAmount?: number;  // 受注残金額
  isBacklog?: boolean;     // 受注残データかどうか
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

// 受注残レコード（詳細表示用）
interface BacklogRecord {
  seiban: string;           // 製番
  expectedMonth: string;    // 売上見込月
  expectedMonthIndex: number; // 売上見込月インデックス
  office: string;           // 営業所
  tantousha: string;        // 担当者
  amount: number;           // 受注金額
  pjCategory: string;       // PJ区分
  industry: string;         // 産業分類
  customer: string;         // 得意先
}

// 受注残集計サマリー
interface BacklogSummary {
  // 全レコード
  records: BacklogRecord[];
  // 月別集計
  byMonth: { month: string; monthIndex: number; count: number; amount: number }[];
  // 営業所別集計
  byOffice: { name: string; count: number; amount: number }[];
  // 担当者別集計
  byTantousha: { name: string; office: string; count: number; amount: number }[];
  // PJ区分別集計
  byPjCategory: { name: string; count: number; amount: number }[];
  // 産業分類別集計
  byIndustry: { name: string; count: number; amount: number }[];
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
  // 受注残関連
  lastSalesMonthIndex?: number;    // 最終売上月インデックス
  lastSalesMonth?: string;         // 最終売上月名
  includeBacklog?: boolean;        // 受注残データ含む
  totalBacklogCount?: number;      // 受注残合計件数
  totalBacklogAmount?: number;     // 受注残合計金額
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
  // 受注残詳細（includeBacklog時のみ）
  backlogSummary?: BacklogSummary;
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fromPeriod = parseInt(searchParams.get("fromPeriod") || String(getCurrentPeriod() - 2), 10);
  const toPeriod = parseInt(searchParams.get("toPeriod") || String(getCurrentPeriod()), 10);
  const noCache = searchParams.get("noCache") === "true";
  const includeBacklog = searchParams.get("includeBacklog") === "true";

  const cacheKey = `sales-dashboard:${fromPeriod}:${toPeriod}:${includeBacklog ? "backlog" : "sales"}`;
  if (!noCache) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
  } else {
    // キャッシュクリア
    cache.delete(cacheKey);
    console.log(`[sales-dashboard] Cache cleared for ${cacheKey}`);
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

    // 必要なフィールドのみを取得してパフォーマンスを改善
    const requiredFields = [
      "製番", "売上日", "金額", "実績_原価計", "予定_原価計",
      "PJ区分", "産業分類", "納入先県名", "Web新規（TEL含む）",
      "得意先", "担当者", "部課"
    ];

    console.log(`[sales-dashboard] Fetching records with filter: ${dateFilter}`);
    const startFetchTime = Date.now();

    do {
      const currentPageToken = pageToken;
      const response = await withRetry(async () => {
        return client.bitable.appTableRecord.list({
          path: {
            app_token: getLarkBaseToken(),
            table_id: TABLE_ID,
          },
          params: {
            page_size: 500,
            page_token: currentPageToken,
            filter: dateFilter,
            field_names: JSON.stringify(requiredFields),
            view_id: VIEWS.main, // ビューIDを使用してパフォーマンス改善
          },
        });
      });

      if (response.data?.items) {
        allRecords.push(...(response.data.items as SalesRecord[]));
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    console.log(`[sales-dashboard] Fetched ${allRecords.length} records in ${Date.now() - startFetchTime}ms`);

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
          // WEB新規は値が「1」のものが対象
          const isWebNew = webNew === "1";
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

      // 売上最終月を特定（売上がある最後の月のインデックス）
      let lastSalesMonthIndex = -1;
      for (let i = 11; i >= 0; i--) {
        if (monthlyMap.has(i) && monthlyMap.get(i)!.count > 0) {
          lastSalesMonthIndex = i;
          break;
        }
      }

      // 受注残データを取得（includeBacklogがtrueの場合）
      let backlogMap = new Map<number, { count: number; amount: number }>();
      let backlogSummary: BacklogSummary | undefined = undefined;
      console.log(`[sales-dashboard] includeBacklog=${includeBacklog}, lastSalesMonthIndex=${lastSalesMonthIndex >= 0 ? getFiscalMonthName(lastSalesMonthIndex) : "none"}`);
      if (includeBacklog) {
        try {
          // 集計用データと詳細レコードを並列取得
          const [backlogMapResult, backlogSummaryResult] = await Promise.all([
            fetchBacklogData(client, getLarkBaseToken(), dateRange, lastSalesMonthIndex),
            fetchBacklogRecords(client, getLarkBaseToken(), dateRange, lastSalesMonthIndex, departmentMap),
          ]);
          backlogMap = backlogMapResult;
          backlogSummary = backlogSummaryResult;
        } catch (backlogError) {
          console.error(`[sales-dashboard] Backlog fetch failed, continuing with sales data only:`, backlogError);
          // エラー時は空のマップのまま継続（売上データのみ表示）
        }
      }

      // 月次データ配列化（受注残データを統合）
      // 最終売上月より後の月は、売上 + 受注残の合計をamountに含める
      const monthlyData: MonthlyData[] = Array.from({ length: 12 }, (_, i) => {
        const salesData = monthlyMap.get(i);
        const backlogData = backlogMap.get(i);
        // 最終売上月より後の月を受注残月とする
        const isBacklogMonth = includeBacklog && lastSalesMonthIndex >= 0 && i > lastSalesMonthIndex;

        // 売上額（受注残月の場合は売上+受注残の合計）
        const salesAmount = salesData?.amount || 0;
        const backlogAmount = isBacklogMonth ? (backlogData?.amount || 0) : 0;
        const combinedAmount = salesAmount + backlogAmount;
        const combinedCount = (salesData?.count || 0) + (isBacklogMonth ? (backlogData?.count || 0) : 0);

        // デバッグログ
        if (includeBacklog && isBacklogMonth) {
          console.log(`[sales-dashboard] Month ${getFiscalMonthName(i)}: sales=${salesAmount}, backlog=${backlogAmount}, combined=${combinedAmount}`);
        }

        return {
          month: getFiscalMonthName(i),
          monthIndex: i,
          count: combinedCount,
          amount: combinedAmount,  // 売上 + 受注残の合計
          cost: salesData?.cost || 0,
          profit: salesData?.profit || 0,
          // 受注残の内訳も保持
          backlogCount: isBacklogMonth ? (backlogData?.count || 0) : undefined,
          backlogAmount: isBacklogMonth ? backlogAmount : undefined,
          isBacklog: isBacklogMonth,
        };
      });

      // 月別件数をログ出力
      const monthlyCountLog = monthlyData.map(m =>
        m.isBacklog
          ? `${m.month}:${m.count}(+${m.backlogCount || 0}残)`
          : `${m.month}:${m.count}`
      ).join(", ");
      console.log(`[sales-dashboard] Period ${period} monthly counts: ${monthlyCountLog}`);

      // 累計データ作成（受注残込み）
      let cumCount = 0;
      let cumAmount = 0;
      let cumCost = 0;
      let cumProfit = 0;
      let cumBacklogCount = 0;
      let cumBacklogAmount = 0;
      const cumulativeData: MonthlyData[] = monthlyData.map((m) => {
        cumCount += m.count;
        cumAmount += m.amount;
        cumCost += m.cost;
        cumProfit += m.profit;
        if (m.isBacklog && m.backlogCount) {
          cumBacklogCount += m.backlogCount;
          cumBacklogAmount += m.backlogAmount || 0;
        }
        return {
          month: m.month,
          monthIndex: m.monthIndex,
          count: cumCount,
          amount: cumAmount,
          cost: cumCost,
          profit: cumProfit,
          backlogCount: m.isBacklog ? cumBacklogCount : undefined,
          backlogAmount: m.isBacklog ? cumBacklogAmount : undefined,
          isBacklog: m.isBacklog,
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

      // WEB新規 月別推移データ配列化
      const webNewMonthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: getFiscalMonthName(i),
        monthIndex: i,
        webNew: webNewMonthlyMap.get(i)?.webNew || 0,
        webNewCount: webNewMonthlyMap.get(i)?.webNewCount || 0,
        normal: webNewMonthlyMap.get(i)?.normal || 0,
        normalCount: webNewMonthlyMap.get(i)?.normalCount || 0,
      }));

      // 赤字分析は別メニューに移行済み - 空のデフォルト値を設定
      const deficitAnalysis: DeficitAnalysis = {
        records: [],
        totalCount: 0,
        totalAmount: 0,
        totalLoss: 0,
        byPjCategory: [],
        byTantousha: [],
        byCustomer: [],
        byMonth: [],
        byIndustry: [],
        patterns: {
          highRiskPjCategories: [],
          highRiskCustomers: [],
          seasonalPattern: null,
          avgDeficitRate: 0,
          commonFactors: [],
        },
        recommendations: [],
      };

      // 受注残合計を計算
      const totalBacklogCount = monthlyData.reduce((sum, m) => sum + (m.backlogCount || 0), 0);
      const totalBacklogAmount = monthlyData.reduce((sum, m) => sum + (m.backlogAmount || 0), 0);

      // 売上＋受注残の合計（includeBacklog時）
      const combinedTotalCount = includeBacklog ? totalCount + totalBacklogCount : totalCount;
      const combinedTotalAmount = includeBacklog ? totalAmount + totalBacklogAmount : totalAmount;

      results.push({
        period,
        dateRange,
        totalCount: combinedTotalCount,
        totalAmount: combinedTotalAmount,
        totalCost,
        totalProfit,
        lastSalesMonthIndex: includeBacklog ? lastSalesMonthIndex : undefined,
        lastSalesMonth: includeBacklog && lastSalesMonthIndex >= 0 ? getFiscalMonthName(lastSalesMonthIndex) : undefined,
        includeBacklog,
        totalBacklogCount: includeBacklog ? totalBacklogCount : undefined,
        totalBacklogAmount: includeBacklog ? totalBacklogAmount : undefined,
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
        backlogSummary: includeBacklog ? backlogSummary : undefined,
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
