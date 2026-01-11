import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import type { CostAnalysisData, CostCategory } from "@/types";

export const dynamic = 'force-dynamic';

// テーブルID（製番原価データ）
const TABLE_ID = "tbl7lMDstBVYxQKd";

// 科目の定義（Larkテーブルの実際のフィールドに合わせる）
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
    // 実績原価科目（接尾辞なし）
    材料費?: string | number;
    外注費?: string | number;
    労務費?: string | number;
    経費?: string | number;
    原価合計?: string | number;
    // 予定原価科目（予定_プレフィックス）
    予定_材料費?: string | number;
    予定_外注費?: string | number;
    予定_労務費?: string | number;
    予定_経費?: string | number;
    予定_原価合計?: string | number;
    // 予算原価科目（予算_プレフィックス）
    予算_材料費?: string | number;
    予算_外注費?: string | number;
    予算_労務費?: string | number;
    予算_経費?: string | number;
    予算_原価合計?: string | number;
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

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const seiban = searchParams.get("seiban");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番が指定されていません" },
      { status: 400 }
    );
  }

  try {
    // 製番でフィルタリングしてデータ取得
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
      // データがない場合はダミーデータを返す（開発用）
      const dummyData: CostAnalysisData = createDummyData(seiban);
      return NextResponse.json({
        success: true,
        data: dummyData,
        isDummy: true,
      });
    }

    // 最初のレコードを使用（製番は通常1件）
    const record = records[0];
    const fields = record.fields;

    // 売上金額を取得
    const salesAmount = parseNumber(fields.売上金額) || parseNumber(fields.受注金額);

    // 科目別原価を集計
    const categories: CostCategory[] = [];
    let totalPlannedCost = 0;
    let totalActualCost = 0;

    // 各科目の原価を集計（Larkフィールド名: 実績=科目名, 予定=予定_科目名）
    // 0円でも全科目を表示する
    for (const category of COST_CATEGORIES) {
      const plannedKey = `予定_${category}`;
      const actualKey = category; // 実績は科目名そのまま

      const plannedCost = parseNumber(fields[plannedKey]);
      const actualCost = parseNumber(fields[actualKey]);

      categories.push({
        category,
        planned_cost: plannedCost,
        actual_cost: actualCost,
        difference: actualCost - plannedCost,
        cost_ratio: 0, // 後で計算
      });
      totalPlannedCost += plannedCost;
      totalActualCost += actualCost;
    }

    // フィールドが見つからない場合は原価合計フィールドをチェック
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

    // 原価比率を計算
    if (totalActualCost > 0) {
      categories.forEach(cat => {
        cat.cost_ratio = Math.round((cat.actual_cost / totalActualCost) * 100 * 10) / 10;
      });
    }

    // サマリーを計算
    const plannedProfit = salesAmount - totalPlannedCost;
    const actualProfit = salesAmount - totalActualCost;
    const plannedProfitRate = salesAmount > 0 ? Math.round((plannedProfit / salesAmount) * 100 * 10) / 10 : 0;
    const actualProfitRate = salesAmount > 0 ? Math.round((actualProfit / salesAmount) * 100 * 10) / 10 : 0;

    const costAnalysisData: CostAnalysisData = {
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

    return NextResponse.json({
      success: true,
      data: costAnalysisData,
    });
  } catch (error) {
    console.error("Cost analysis error:", error);
    return NextResponse.json(
      { success: false, error: "原価分析データの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
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
