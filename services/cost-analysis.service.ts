import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import type { CostAnalysisData, CostCategory } from "@/types";

// テーブルID（製番原価データ）
const TABLE_ID = "tbl7lMDstBVYxQKd";

// 科目の定義
const COST_CATEGORIES = [
  "材料費",
  "労務費",
  "経費",
  "外注費",
] as const;

interface CostRecord {
  fields: {
    製番?: string;
    受注金額?: string | number;
    売上金額?: string | number;
    材料費?: string | number;
    外注費?: string | number;
    労務費?: string | number;
    経費?: string | number;
    原価合計?: string | number;
    予定_材料費?: string | number;
    予定_外注費?: string | number;
    予定_労務費?: string | number;
    予定_経費?: string | number;
    予定_原価合計?: string | number;
    [key: string]: any;
  };
}

// 数値を安全にパース
function parseNumber(value: any): number {
  if (value === undefined || value === null || value === "" || value === "　") {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = parseFloat(String(value).replace(/[,，]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// ダミーの科目別データを作成
function createDummyCategories(): CostCategory[] {
  const data = [
    { category: "材料費", planned: 3000000, actual: 3200000 },
    { category: "労務費", planned: 1500000, actual: 1600000 },
    { category: "経費", planned: 500000, actual: 550000 },
    { category: "外注費", planned: 0, actual: 0 },
  ];

  const totalActual = data.reduce((sum, d) => sum + d.actual, 0);

  return data.map(d => ({
    category: d.category,
    planned_cost: d.planned,
    actual_cost: d.actual,
    difference: d.actual - d.planned,
    cost_ratio: Math.round((d.actual / totalActual) * 100 * 10) / 10,
  }));
}

// ダミーデータを作成（テスト用）
function createDummyData(seiban: string): CostAnalysisData {
  const salesAmount = 10000000;
  const categories = createDummyCategories();
  const totalPlannedCost = categories.reduce((sum, c) => sum + c.planned_cost, 0);
  const totalActualCost = categories.reduce((sum, c) => sum + c.actual_cost, 0);

  return {
    seiban,
    summary: {
      sales_amount: salesAmount,
      total_planned_cost: totalPlannedCost,
      total_actual_cost: totalActualCost,
      planned_profit: salesAmount - totalPlannedCost,
      actual_profit: salesAmount - totalActualCost,
      planned_profit_rate: Math.round(((salesAmount - totalPlannedCost) / salesAmount) * 100 * 10) / 10,
      actual_profit_rate: Math.round(((salesAmount - totalActualCost) / salesAmount) * 100 * 10) / 10,
    },
    categories,
  };
}

/**
 * 製番で原価分析データを取得
 */
export async function getCostAnalysisBySeiban(seiban: string): Promise<CostAnalysisData | null> {
  const client = getLarkClient();
  if (!client) {
    console.error("Lark client not initialized");
    return null;
  }

  try {
    const response = await client.bitable.appTableRecord.list({
      path: {
        app_token: getLarkBaseToken(),
        table_id: TABLE_ID,
      },
      params: {
        filter: `CurrentValue.[製番] = "${seiban}"`,
        page_size: 100,
      },
    });

    const records = (response.data?.items || []) as CostRecord[];

    if (records.length === 0) {
      // データがない場合はダミーデータを返す
      return createDummyData(seiban);
    }

    const record = records[0];
    const fields = record.fields;

    const salesAmount = parseNumber(fields.売上金額) || parseNumber(fields.受注金額);

    const categories: CostCategory[] = [];
    let totalPlannedCost = 0;
    let totalActualCost = 0;

    for (const category of COST_CATEGORIES) {
      const plannedKey = `予定_${category}`;
      const actualKey = category;

      const plannedCost = parseNumber(fields[plannedKey]);
      const actualCost = parseNumber(fields[actualKey]);

      categories.push({
        category,
        planned_cost: plannedCost,
        actual_cost: actualCost,
        difference: actualCost - plannedCost,
        cost_ratio: 0,
      });
      totalPlannedCost += plannedCost;
      totalActualCost += actualCost;
    }

    if (categories.length === 0) {
      const plannedCost = parseNumber(fields.予定_原価合計);
      const actualCost = parseNumber(fields.原価合計);

      if (plannedCost > 0 || actualCost > 0) {
        categories.push({
          category: "総原価",
          planned_cost: plannedCost,
          actual_cost: actualCost,
          difference: actualCost - plannedCost,
          cost_ratio: 100,
        });
        totalPlannedCost = plannedCost;
        totalActualCost = actualCost;
      }
    }

    if (totalActualCost > 0) {
      categories.forEach(cat => {
        cat.cost_ratio = Math.round((cat.actual_cost / totalActualCost) * 100 * 10) / 10;
      });
    }

    const plannedProfit = salesAmount - totalPlannedCost;
    const actualProfit = salesAmount - totalActualCost;
    const plannedProfitRate = salesAmount > 0 ? Math.round((plannedProfit / salesAmount) * 100 * 10) / 10 : 0;
    const actualProfitRate = salesAmount > 0 ? Math.round((actualProfit / salesAmount) * 100 * 10) / 10 : 0;

    return {
      seiban,
      summary: {
        sales_amount: salesAmount,
        total_planned_cost: totalPlannedCost,
        total_actual_cost: totalActualCost,
        planned_profit: plannedProfit,
        actual_profit: actualProfit,
        planned_profit_rate: plannedProfitRate,
        actual_profit_rate: actualProfitRate,
      },
      categories: categories.length > 0 ? categories : createDummyCategories(),
    };
  } catch (error) {
    console.error("Cost analysis error:", error);
    return null;
  }
}
