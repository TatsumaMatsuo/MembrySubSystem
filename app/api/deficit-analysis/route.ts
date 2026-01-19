import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, listAllDepartments } from "@/lib/lark-client";

// テーブルID（売上データ）
const TABLE_ID = "tbl65w6u6J72QFoz";

// ビューID（パフォーマンス最適化用 - 赤字案件フィルタ済み）
const VIEW_ID = "vewNmCixWg"; // 赤字案件ビュー（利益 < 0）

// キャッシュ（TTL: 30分）
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
const OFFICE_REGION_MAP: Record<string, string> = {
  仙台営業所: "東日本",
  北関東営業所: "東日本",
  東京営業所: "東日本",
  名古屋営業所: "東日本",
  大阪営業所: "西日本",
  北九州営業所: "西日本",
  福岡営業所: "西日本",
  佐賀営業所: "西日本",
  八女営業所: "西日本",
  宮崎営業所: "西日本",
};

const HQ_SALES_PERSON = "山口 篤樹";
const OFFICE_NAMES = [
  "仙台営業所", "北関東営業所", "東京営業所", "名古屋営業所",
  "大阪営業所", "北九州営業所", "福岡営業所", "佐賀営業所", "八女営業所", "宮崎営業所",
  "本社",
];

// 期から日付範囲を計算
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

// テキスト値を抽出
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

// 複数選択フィールドから値を抽出
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

// 部署から営業所を抽出
function extractOfficeFromDepartment(departmentValue: any, optionMap?: Map<string, string>): string {
  let departments = extractMultiSelectValues(departmentValue);
  if (optionMap && optionMap.size > 0) {
    departments = departments.map((id) => optionMap.get(id) || id);
  }
  for (const dept of departments) {
    if (OFFICE_NAMES.includes(dept)) return dept;
    const matchedOffice = OFFICE_NAMES.find((office) => dept.includes(office) || office.includes(dept));
    if (matchedOffice) return matchedOffice;
  }
  return departments[0] || "未設定";
}

// 日付が範囲内かどうか
function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  if (!dateStr || dateStr.trim() === "" || dateStr === "　") return false;
  const cleaned = dateStr.trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return false;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const startParts = startStr.split("/");
  const endParts = endStr.split("/");
  const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
  const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
  return date >= start && date <= end;
}

// 月インデックスを取得
function getFiscalMonthIndex(dateStr: string): number {
  if (!dateStr || dateStr.trim() === "") return -1;
  const cleaned = dateStr.trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 2) return -1;
  const month = parseInt(parts[1]);
  return month >= 8 ? month - 8 : month + 4;
}

// 金額フォーマット
function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億`;
  if (amount >= 10000) return `${Math.round(amount / 10000)}万`;
  return amount.toLocaleString();
}

interface DeficitRecord {
  seiban: string;
  salesDate: string;
  customer: string;
  tantousha: string;
  office: string;
  pjCategory: string;
  industry: string;
  amount: number;
  cost: number;
  profit: number;
  profitRate: number;
}

// 回収必要売上額の計算（利益率35%で赤字を回収するために必要な売上）
const RECOVERY_PROFIT_RATE = 0.35;

interface PeriodDeficitData {
  period: number;
  dateRange: { start: string; end: string };
  totalCount: number;      // 全案件数
  deficitCount: number;    // 赤字件数
  totalLoss: number;       // 損失合計
  avgDeficitRate: number;  // 赤字率
  recoveryRequiredSales: number; // 回収必要売上額（利益率35%で計算）
  deficitAnalysis: {
    records: DeficitRecord[];
    totalCount: number;
    totalAmount: number;
    totalLoss: number;
    byPjCategory: { name: string; count: number; loss: number; avgProfitRate: number }[];
    byTantousha: { name: string; office: string; count: number; loss: number; avgProfitRate: number }[];
    byCustomer: { name: string; count: number; loss: number; avgProfitRate: number }[];
    byMonth: { month: string; monthIndex: number; count: number; loss: number }[];
    byIndustry: { name: string; count: number; loss: number; avgProfitRate: number }[];
    patterns: {
      highRiskPjCategories: string[];
      highRiskCustomers: string[];
      seasonalPattern: string | null;
      avgDeficitRate: number;
      commonFactors: string[];
    };
    recommendations: string[];
  };
}

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fromPeriod = parseInt(searchParams.get("fromPeriod") || String(getCurrentPeriod() - 2), 10);
  const toPeriod = parseInt(searchParams.get("toPeriod") || String(getCurrentPeriod()), 10);

  const cacheKey = `deficit-analysis:${fromPeriod}:${toPeriod}`;
  const cachedResult = getCachedData(cacheKey);
  if (cachedResult) {
    console.log("[deficit-analysis] Cache hit:", cacheKey);
    return NextResponse.json(cachedResult);
  }

  console.log("[deficit-analysis] Fetching data for periods:", fromPeriod, "-", toPeriod);
  const startTime = Date.now();

  try {
    const overallDateRange = {
      start: getPeriodDateRange(fromPeriod).start,
      end: getPeriodDateRange(toPeriod).end,
    };

    // 必要なフィールドのみ取得（軽量化）
    const fieldNames = [
      "製番", "売上日", "金額", "実績_原価計", "予定_原価計",
      "PJ区分", "産業分類", "得意先", "担当者", "部課"
    ];

    const dateFilter = `AND(CurrentValue.[売上日] >= "${overallDateRange.start}", CurrentValue.[売上日] <= "${overallDateRange.end}")`;

    // 部署マッピング取得とデータ取得を並列実行（パフォーマンス最適化）
    const departmentMapPromise = (async () => {
      const map = new Map<string, string>();
      try {
        const deptResponse = await listAllDepartments();
        if (deptResponse.code === 0 && deptResponse.data?.items) {
          for (const dept of deptResponse.data.items) {
            const deptId = (dept as any).open_department_id || (dept as any).department_id;
            const deptName = (dept as any).name;
            if (deptId && deptName) {
              map.set(deptId, deptName);
              map.set(String(deptId), deptName);
            }
          }
        }
      } catch (e) {
        // 部署マッピング取得失敗時は空のまま継続
      }
      return map;
    })();

    const recordsPromise = (async () => {
      let records: any[] = [];
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
            filter: dateFilter,
            field_names: JSON.stringify(fieldNames),
            view_id: VIEW_ID,
          },
        });

        if (response.data?.items) {
          records = records.concat(response.data.items);
        }
        pageToken = response.data?.page_token;
      } while (pageToken);

      return records;
    })();

    // 並列実行完了を待機
    const [departmentMap, allRecords] = await Promise.all([departmentMapPromise, recordsPromise]);

    console.log("[deficit-analysis] Fetched records:", allRecords.length, "in", Date.now() - startTime, "ms (parallel execution)");

    const results: PeriodDeficitData[] = [];

    for (let period = fromPeriod; period <= toPeriod; period++) {
      const dateRange = getPeriodDateRange(period);

      const periodRecords = allRecords.filter((record) => {
        const uriageDateStr = extractTextValue(record.fields?.売上日);
        return isDateInRange(uriageDateStr, dateRange.start, dateRange.end);
      });

      // 赤字案件の集計
      const deficitRecords: DeficitRecord[] = [];
      const deficitByPjCategory = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByTantousha = new Map<string, { office: string; count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByCustomer = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const deficitByMonth = new Map<number, { count: number; loss: number }>();
      const deficitByIndustry = new Map<string, { count: number; loss: number; totalAmount: number; totalProfit: number }>();
      const totalByPjCategory = new Map<string, number>();
      const totalByCustomer = new Map<string, number>();

      let totalCount = 0;

      periodRecords.forEach((record) => {
        const fields = record.fields || {};
        const amount = parseFloat(String(fields.金額 || 0)) || 0;
        const cost = parseFloat(String(fields.実績_原価計 || fields.予定_原価計 || 0)) || 0;
        const profit = amount - cost;
        const profitRate = amount > 0 ? (profit / amount) * 100 : 0;

        const uriageDateStr = extractTextValue(fields.売上日);
        const monthIndex = getFiscalMonthIndex(uriageDateStr);
        const tantousha = extractTextValue(fields.担当者) || "未設定";
        let eigyosho = fields.部課
          ? extractOfficeFromDepartment(fields.部課, departmentMap)
          : "未設定";
        if (tantousha === HQ_SALES_PERSON) {
          eigyosho = "本社";
        }
        const pjCategory = extractTextValue(fields.PJ区分) || "未分類";
        const industry = extractTextValue(fields.産業分類) || "未分類";
        const customer = extractTextValue(fields.得意先) || "未設定";
        const seiban = extractTextValue(fields.製番) || "";

        totalCount++;
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

      // 損失額降順にソート
      deficitRecords.sort((a, b) => a.profit - b.profit);

      // 配列化
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

      const highRiskPjCategories = byPjCategory
        .filter((pj) => {
          const totalPj = totalByPjCategory.get(pj.name) || 0;
          const deficitRate = totalPj > 0 ? (pj.count / totalPj) * 100 : 0;
          return deficitRate > avgDeficitRate && pj.count >= 2;
        })
        .slice(0, 5)
        .map((pj) => pj.name);

      const highRiskCustomers = byCustomer
        .filter((c) => c.count >= 2)
        .slice(0, 5)
        .map((c) => c.name);

      const monthlyDeficitCounts = byMonth.map((m) => m.count);
      const maxMonth = monthlyDeficitCounts.indexOf(Math.max(...monthlyDeficitCounts));
      const seasonalPattern = monthlyDeficitCounts[maxMonth] >= 3
        ? `${getFiscalMonthName(maxMonth)}に赤字案件が集中する傾向`
        : null;

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

      const recommendations: string[] = [];
      if (highRiskPjCategories.length > 0) {
        recommendations.push(`高リスクPJ区分（${highRiskPjCategories.join("、")}）の見積精度向上を検討`);
      }
      if (highRiskCustomers.length > 0) {
        recommendations.push(`リピート赤字顧客への価格交渉・取引条件見直しを推奨`);
      }
      if (byTantousha.length > 0 && byTantousha[0].count >= 3) {
        recommendations.push(`${byTantousha[0].name}氏の案件について原価管理の強化を検討`);
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

      const periodTotalLoss = deficitRecords.reduce((sum, r) => sum + Math.abs(r.profit), 0);
      const periodDeficitAmount = deficitRecords.reduce((sum, r) => sum + r.amount, 0);
      // 赤字案件分と合算して35%に戻す計算式
      // 赤字案件の売上 + 赤字を回収するための追加売上
      const recoveryRequiredSales = periodDeficitAmount + (periodTotalLoss / RECOVERY_PROFIT_RATE);

      results.push({
        period,
        dateRange,
        totalCount,
        deficitCount: deficitRecords.length,
        totalLoss: periodTotalLoss,
        avgDeficitRate,
        recoveryRequiredSales,
        deficitAnalysis: {
          records: deficitRecords.slice(0, 100),
          totalCount: deficitRecords.length,
          totalAmount: deficitRecords.reduce((sum, r) => sum + r.amount, 0),
          totalLoss: deficitRecords.reduce((sum, r) => sum + Math.abs(r.profit), 0),
          byPjCategory,
          byTantousha,
          byCustomer: byCustomer.slice(0, 20),
          byMonth,
          byIndustry: byIndustry.slice(0, 15),
          patterns: {
            highRiskPjCategories,
            highRiskCustomers,
            seasonalPattern,
            avgDeficitRate,
            commonFactors,
          },
          recommendations,
        },
      });
    }

    console.log("[deficit-analysis] Processing completed in", Date.now() - startTime, "ms");

    const responseData = {
      success: true,
      currentPeriod: getCurrentPeriod(),
      data: results,
    };

    setCachedData(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[deficit-analysis] Error:", error);
    return NextResponse.json(
      { error: "赤字案件データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
