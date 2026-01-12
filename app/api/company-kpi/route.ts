import { NextRequest, NextResponse } from "next/server";
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  getLarkBaseToken,
} from "@/lib/lark-client";
import { getLarkTables, COMPANY_KPI_FIELDS } from "@/lib/lark-tables";

// KPIデータの型定義
export interface CompanyKPIData {
  recordId?: string;
  period: number;
  // 売上目標
  salesTarget: number;
  monthlySalesTarget: number;
  // 損益計算書ベース
  costOfSales: number;
  costOfSalesRate: number;
  sgaExpenses: number;
  sgaRate: number;
  operatingIncome: number;
  operatingIncomeRate: number;
  // 限界利益ベース
  variableCost: number;
  variableCostRate: number;
  marginalProfit: number;
  marginalProfitRate: number;
  fixedCost: number;
  fixedCostRate: number;
  ordinaryIncome: number;
  ordinaryIncomeRate: number;
  // 製造・外注
  manufacturingCostRate: number;
  executionBudgetRate: number;
  outsourcingRate: number;
  // その他計画
  headcountPlan: number;
  capitalInvestment: number;
  advertisingBudget: number;
  // 備考
  notes: string;
}

// Larkレコードから内部形式に変換
function parseRecord(record: any): CompanyKPIData {
  const fields = record.fields;
  return {
    recordId: record.record_id,
    period: parseInt(String(fields[COMPANY_KPI_FIELDS.period] || 0), 10),
    // 売上目標
    salesTarget: parseFloat(String(fields[COMPANY_KPI_FIELDS.sales_target] || 0)) || 0,
    monthlySalesTarget: parseFloat(String(fields[COMPANY_KPI_FIELDS.monthly_sales_target] || 0)) || 0,
    // 損益計算書ベース
    costOfSales: parseFloat(String(fields[COMPANY_KPI_FIELDS.cost_of_sales] || 0)) || 0,
    costOfSalesRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.cost_of_sales_rate] || 0)) || 0,
    sgaExpenses: parseFloat(String(fields[COMPANY_KPI_FIELDS.sga_expenses] || 0)) || 0,
    sgaRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.sga_rate] || 0)) || 0,
    operatingIncome: parseFloat(String(fields[COMPANY_KPI_FIELDS.operating_income] || 0)) || 0,
    operatingIncomeRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.operating_income_rate] || 0)) || 0,
    // 限界利益ベース
    variableCost: parseFloat(String(fields[COMPANY_KPI_FIELDS.variable_cost] || 0)) || 0,
    variableCostRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.variable_cost_rate] || 0)) || 0,
    marginalProfit: parseFloat(String(fields[COMPANY_KPI_FIELDS.marginal_profit] || 0)) || 0,
    marginalProfitRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.marginal_profit_rate] || 0)) || 0,
    fixedCost: parseFloat(String(fields[COMPANY_KPI_FIELDS.fixed_cost] || 0)) || 0,
    fixedCostRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.fixed_cost_rate] || 0)) || 0,
    ordinaryIncome: parseFloat(String(fields[COMPANY_KPI_FIELDS.ordinary_income] || 0)) || 0,
    ordinaryIncomeRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.ordinary_income_rate] || 0)) || 0,
    // 製造・外注
    manufacturingCostRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.manufacturing_cost_rate] || 0)) || 0,
    executionBudgetRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.execution_budget_rate] || 0)) || 0,
    outsourcingRate: parseFloat(String(fields[COMPANY_KPI_FIELDS.outsourcing_rate] || 0)) || 0,
    // その他計画
    headcountPlan: parseInt(String(fields[COMPANY_KPI_FIELDS.headcount_plan] || 0), 10),
    capitalInvestment: parseFloat(String(fields[COMPANY_KPI_FIELDS.capital_investment] || 0)) || 0,
    advertisingBudget: parseFloat(String(fields[COMPANY_KPI_FIELDS.advertising_budget] || 0)) || 0,
    // 備考
    notes: String(fields[COMPANY_KPI_FIELDS.notes] || ""),
  };
}

// 内部形式からLarkフィールドに変換
function toLarkFields(data: CompanyKPIData): Record<string, any> {
  return {
    [COMPANY_KPI_FIELDS.period]: data.period,
    // 売上目標
    [COMPANY_KPI_FIELDS.sales_target]: data.salesTarget,
    [COMPANY_KPI_FIELDS.monthly_sales_target]: data.monthlySalesTarget,
    // 損益計算書ベース
    [COMPANY_KPI_FIELDS.cost_of_sales]: data.costOfSales,
    [COMPANY_KPI_FIELDS.cost_of_sales_rate]: data.costOfSalesRate,
    [COMPANY_KPI_FIELDS.sga_expenses]: data.sgaExpenses,
    [COMPANY_KPI_FIELDS.sga_rate]: data.sgaRate,
    [COMPANY_KPI_FIELDS.operating_income]: data.operatingIncome,
    [COMPANY_KPI_FIELDS.operating_income_rate]: data.operatingIncomeRate,
    // 限界利益ベース
    [COMPANY_KPI_FIELDS.variable_cost]: data.variableCost,
    [COMPANY_KPI_FIELDS.variable_cost_rate]: data.variableCostRate,
    [COMPANY_KPI_FIELDS.marginal_profit]: data.marginalProfit,
    [COMPANY_KPI_FIELDS.marginal_profit_rate]: data.marginalProfitRate,
    [COMPANY_KPI_FIELDS.fixed_cost]: data.fixedCost,
    [COMPANY_KPI_FIELDS.fixed_cost_rate]: data.fixedCostRate,
    [COMPANY_KPI_FIELDS.ordinary_income]: data.ordinaryIncome,
    [COMPANY_KPI_FIELDS.ordinary_income_rate]: data.ordinaryIncomeRate,
    // 製造・外注
    [COMPANY_KPI_FIELDS.manufacturing_cost_rate]: data.manufacturingCostRate,
    [COMPANY_KPI_FIELDS.execution_budget_rate]: data.executionBudgetRate,
    [COMPANY_KPI_FIELDS.outsourcing_rate]: data.outsourcingRate,
    // その他計画
    [COMPANY_KPI_FIELDS.headcount_plan]: data.headcountPlan,
    [COMPANY_KPI_FIELDS.capital_investment]: data.capitalInvestment,
    [COMPANY_KPI_FIELDS.advertising_budget]: data.advertisingBudget,
    // 備考
    [COMPANY_KPI_FIELDS.notes]: data.notes,
  };
}

// GET: KPIデータ取得
export async function GET(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.COMPANY_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_COMPANY_KPI が設定されていません" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  try {
    const filter = period ? `CurrentValue.[${COMPANY_KPI_FIELDS.period}] = ${period}` : undefined;

    const response = await getBaseRecords(tableId, {
      filter,
      pageSize: 100,
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0 && response.data?.items) {
      const records = response.data.items.map(parseRecord);
      // 期の降順でソート
      records.sort((a, b) => b.period - a.period);

      return NextResponse.json({
        success: true,
        data: period ? records[0] || null : records,
      });
    } else {
      console.error("[company-kpi] Error fetching data:", response);
      return NextResponse.json(
        { success: false, error: "データの取得に失敗しました" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[company-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// POST: KPIデータ作成
export async function POST(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.COMPANY_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_COMPANY_KPI が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const data: CompanyKPIData = body;

    // 同じ期のレコードが存在するか確認
    const existingResponse = await getBaseRecords(tableId, {
      filter: `CurrentValue.[${COMPANY_KPI_FIELDS.period}] = ${data.period}`,
      pageSize: 1,
      baseToken: getLarkBaseToken(),
    });

    if (existingResponse.code === 0 && (existingResponse.data?.items?.length ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: `第${data.period}期のKPIは既に登録されています` },
        { status: 400 }
      );
    }

    const fields = toLarkFields(data);
    const response = await createBaseRecord(tableId, fields, {
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0) {
      return NextResponse.json({
        success: true,
        data: { recordId: response.data?.record?.record_id },
      });
    } else {
      console.error("[company-kpi] Error creating record:", response);
      return NextResponse.json(
        { success: false, error: "データの作成に失敗しました" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[company-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの作成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// PUT: KPIデータ更新
export async function PUT(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.COMPANY_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_COMPANY_KPI が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { recordId, ...data }: CompanyKPIData & { recordId: string } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "recordId が必要です" },
        { status: 400 }
      );
    }

    const fields = toLarkFields(data as CompanyKPIData);
    const response = await updateBaseRecord(tableId, recordId, fields, {
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0) {
      return NextResponse.json({ success: true });
    } else {
      console.error("[company-kpi] Error updating record:", response);
      return NextResponse.json(
        { success: false, error: "データの更新に失敗しました" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[company-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
