import { NextRequest, NextResponse } from "next/server";
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  getLarkBaseToken,
  getTableFields,
} from "@/lib/lark-client";
import { getLarkTables, SALES_KPI_FIELDS } from "@/lib/lark-tables";

// 営業部KPIデータの型定義
export interface SalesKPIData {
  recordId?: string;
  period: number;
  periodStart: string;
  periodEnd: string;
  // 1. 売上目標
  salesTarget: number;
  monthlySalesTarget: number;
  // 2. 粗利目標
  grossProfitTarget: number;
  grossProfitRate: number;
  // 3. テント倉庫売上
  tentWarehouseUnits: number;
  // 4. 膜構造建築物売上
  membraneBuildingSales: number;
  // 5. 畜舎案件売上
  livestockFacilitySales: number;
  // 6. 海洋事業製品売上
  marineSales: number;
  // 7. レンタルテント売上
  rentalTentSales: number;
  // 8. WEB新規問い合わせ
  webInquiriesYearly: number;
  webInquiriesMonthly: number;
  webOrderAmount: number;
  // 9. セールスフォースAランク顧客
  aRankCustomerTarget: number;
  aRankPerSalesRep: number;
  aRankCondition: string;
  // 10. 品質目標
  claimLimitYearly: number;
  // 備考
  notes: string;
}

// Larkレコードから内部形式に変換
function parseRecord(record: any): SalesKPIData {
  const fields = record.fields;
  return {
    recordId: record.record_id,
    period: parseInt(String(fields[SALES_KPI_FIELDS.period] || 0), 10),
    periodStart: String(fields[SALES_KPI_FIELDS.period_start] || ""),
    periodEnd: String(fields[SALES_KPI_FIELDS.period_end] || ""),
    // 1. 売上目標
    salesTarget: parseFloat(String(fields[SALES_KPI_FIELDS.sales_target] || 0)) || 0,
    monthlySalesTarget: parseFloat(String(fields[SALES_KPI_FIELDS.monthly_sales_target] || 0)) || 0,
    // 2. 粗利目標
    grossProfitTarget: parseFloat(String(fields[SALES_KPI_FIELDS.gross_profit_target] || 0)) || 0,
    grossProfitRate: parseFloat(String(fields[SALES_KPI_FIELDS.gross_profit_rate] || 0)) || 0,
    // 3. テント倉庫売上
    tentWarehouseUnits: parseInt(String(fields[SALES_KPI_FIELDS.tent_warehouse_units] || 0), 10),
    // 4. 膜構造建築物売上
    membraneBuildingSales: parseFloat(String(fields[SALES_KPI_FIELDS.membrane_building_sales] || 0)) || 0,
    // 5. 畜舎案件売上
    livestockFacilitySales: parseFloat(String(fields[SALES_KPI_FIELDS.livestock_facility_sales] || 0)) || 0,
    // 6. 海洋事業製品売上
    marineSales: parseFloat(String(fields[SALES_KPI_FIELDS.marine_sales] || 0)) || 0,
    // 7. レンタルテント売上
    rentalTentSales: parseFloat(String(fields[SALES_KPI_FIELDS.rental_tent_sales] || 0)) || 0,
    // 8. WEB新規問い合わせ
    webInquiriesYearly: parseInt(String(fields[SALES_KPI_FIELDS.web_inquiries_yearly] || 0), 10),
    webInquiriesMonthly: parseInt(String(fields[SALES_KPI_FIELDS.web_inquiries_monthly] || 0), 10),
    webOrderAmount: parseFloat(String(fields[SALES_KPI_FIELDS.web_order_amount] || 0)) || 0,
    // 9. セールスフォースAランク顧客
    aRankCustomerTarget: parseInt(String(fields[SALES_KPI_FIELDS.a_rank_customer_target] || 0), 10),
    aRankPerSalesRep: parseInt(String(fields[SALES_KPI_FIELDS.a_rank_per_sales_rep] || 0), 10),
    aRankCondition: String(fields[SALES_KPI_FIELDS.a_rank_condition] || ""),
    // 10. 品質目標
    claimLimitYearly: parseInt(String(fields[SALES_KPI_FIELDS.claim_limit_yearly] || 0), 10),
    // 備考
    notes: String(fields[SALES_KPI_FIELDS.notes] || ""),
  };
}

// 日付文字列をLarkタイムスタンプに変換
function toTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.getTime();
}

// 内部形式からLarkフィールドに変換
function toLarkFields(data: SalesKPIData): Record<string, any> {
  return {
    [SALES_KPI_FIELDS.period]: data.period,
    [SALES_KPI_FIELDS.period_start]: toTimestamp(data.periodStart),
    [SALES_KPI_FIELDS.period_end]: toTimestamp(data.periodEnd),
    // 1. 売上目標
    [SALES_KPI_FIELDS.sales_target]: data.salesTarget,
    [SALES_KPI_FIELDS.monthly_sales_target]: data.monthlySalesTarget,
    // 2. 粗利目標
    [SALES_KPI_FIELDS.gross_profit_target]: data.grossProfitTarget,
    [SALES_KPI_FIELDS.gross_profit_rate]: data.grossProfitRate,
    // 3. テント倉庫売上
    [SALES_KPI_FIELDS.tent_warehouse_units]: data.tentWarehouseUnits,
    // 4. 膜構造建築物売上
    [SALES_KPI_FIELDS.membrane_building_sales]: data.membraneBuildingSales,
    // 5. 畜舎案件売上
    [SALES_KPI_FIELDS.livestock_facility_sales]: data.livestockFacilitySales,
    // 6. 海洋事業製品売上
    [SALES_KPI_FIELDS.marine_sales]: data.marineSales,
    // 7. レンタルテント売上
    [SALES_KPI_FIELDS.rental_tent_sales]: data.rentalTentSales,
    // 8. WEB新規問い合わせ
    [SALES_KPI_FIELDS.web_inquiries_yearly]: data.webInquiriesYearly,
    [SALES_KPI_FIELDS.web_inquiries_monthly]: data.webInquiriesMonthly,
    [SALES_KPI_FIELDS.web_order_amount]: data.webOrderAmount,
    // 9. セールスフォースAランク顧客
    [SALES_KPI_FIELDS.a_rank_customer_target]: data.aRankCustomerTarget,
    [SALES_KPI_FIELDS.a_rank_per_sales_rep]: data.aRankPerSalesRep,
    [SALES_KPI_FIELDS.a_rank_condition]: data.aRankCondition,
    // 10. 品質目標
    [SALES_KPI_FIELDS.claim_limit_yearly]: data.claimLimitYearly,
    // 備考
    [SALES_KPI_FIELDS.notes]: data.notes,
  };
}

// GET: 営業部KPIデータ取得
export async function GET(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.SALES_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_SALES_KPI が設定されていません" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const mode = searchParams.get("mode");

  // フィールド一覧取得モード
  if (mode === "fields") {
    try {
      const response = await getTableFields(tableId, getLarkBaseToken());
      const fieldNames = response.data?.items?.map((f: any) => f.field_name) || [];
      return NextResponse.json({ success: true, fields: fieldNames });
    } catch (error) {
      return NextResponse.json({ success: false, error: String(error) });
    }
  }

  try {
    const filter = period ? `CurrentValue.[${SALES_KPI_FIELDS.period}] = ${period}` : undefined;

    const response = await getBaseRecords(tableId, {
      filter,
      pageSize: 100,
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0) {
      const items = response.data?.items || [];
      const records = items.map(parseRecord);
      // 期の降順でソート
      records.sort((a, b) => b.period - a.period);

      return NextResponse.json({
        success: true,
        data: period ? records[0] || null : records,
      });
    } else {
      console.error("[sales-kpi] Error fetching data:", response);
      return NextResponse.json(
        { success: false, error: "データの取得に失敗しました", detail: response },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[sales-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得中にエラーが発生しました", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST: 営業部KPIデータ作成
export async function POST(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.SALES_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_SALES_KPI が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const data: SalesKPIData = body;

    // 同じ期のレコードが存在するか確認
    const existingResponse = await getBaseRecords(tableId, {
      filter: `CurrentValue.[${SALES_KPI_FIELDS.period}] = ${data.period}`,
      pageSize: 1,
      baseToken: getLarkBaseToken(),
    });

    if (existingResponse.code === 0 && (existingResponse.data?.items?.length ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: `第${data.period}期の営業部KPIは既に登録されています` },
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
      console.error("[sales-kpi] Error creating record:", response);
      return NextResponse.json(
        { success: false, error: "データの作成に失敗しました", detail: response },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[sales-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの作成中にエラーが発生しました", detail: String(error) },
      { status: 500 }
    );
  }
}

// PUT: 営業部KPIデータ更新
export async function PUT(request: NextRequest) {
  const tables = getLarkTables();
  const tableId = tables.SALES_KPI;

  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "LARK_TABLE_SALES_KPI が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { recordId, ...data }: SalesKPIData & { recordId: string } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "recordId が必要です" },
        { status: 400 }
      );
    }

    const fields = toLarkFields(data as SalesKPIData);
    const response = await updateBaseRecord(tableId, recordId, fields, {
      baseToken: getLarkBaseToken(),
    });

    if (response.code === 0) {
      return NextResponse.json({ success: true });
    } else {
      console.error("[sales-kpi] Error updating record:", response);
      return NextResponse.json(
        { success: false, error: "データの更新に失敗しました" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[sales-kpi] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
