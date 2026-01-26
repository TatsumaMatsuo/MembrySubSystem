import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCostAnalysisBySeiban } from "@/services/cost-analysis.service";
import { getCustomerRequestsBySeiban } from "@/services/customer-requests.service";
import { getQualityIssuesBySeiban } from "@/services/quality-issues.service";
import { getBaiyakuBySeiban } from "@/services/baiyaku.service";
import { generateGanttChartData } from "@/services/gantt.service";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seiban = searchParams.get("seiban");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番が指定されていません" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("[ai-cost-analysis] API Key check:", {
    hasKey: !!apiKey,
    keyLength: apiKey?.length,
    keyPrefix: apiKey?.substring(0, 10)
  });

  if (!apiKey) {
    console.error("[ai-cost-analysis] ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { success: false, error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    // 各データを並列取得（サービスを直接呼び出し）
    const [costAnalysis, customerRequests, qualityIssues, baiyaku] = await Promise.all([
      getCostAnalysisBySeiban(seiban),
      getCustomerRequestsBySeiban(seiban),
      getQualityIssuesBySeiban(seiban),
      getBaiyakuBySeiban(seiban),
    ]);

    // ガントチャートデータを生成
    const ganttData = baiyaku ? generateGanttChartData(baiyaku) : null;

    // プロンプト用のデータを整形
    const contextData = {
      製番: seiban,
      原価分析: costAnalysis ? {
        売上金額: costAnalysis.summary?.sales_amount,
        予定原価合計: costAnalysis.summary?.total_planned_cost,
        実績原価合計: costAnalysis.summary?.total_actual_cost,
        予定利益: costAnalysis.summary?.planned_profit,
        実績利益: costAnalysis.summary?.actual_profit,
        予定利益率: costAnalysis.summary?.planned_profit_rate,
        実績利益率: costAnalysis.summary?.actual_profit_rate,
        科目別原価: costAnalysis.categories?.map((c: any) => ({
          科目: c.category,
          予定: c.planned_cost,
          実績: c.actual_cost,
          差異: c.difference,
        })),
      } : null,
      顧客要求事項変更履歴: customerRequests?.map((r: any) => ({
        申請日: r.shinsei_date ? new Date(r.shinsei_date).toLocaleDateString('ja-JP') : '不明',
        区分: r.youkyuu_kubun,
        内容: r.honbun,
      })) || [],
      不具合情報: qualityIssues?.map((q: any) => ({
        発生日: q.hassei_date ? new Date(q.hassei_date).toLocaleDateString('ja-JP') : '不明',
        発見部署: q.hakken_busho,
        起因部署: q.kiin_busho,
        タイトル: q.fuguai_title,
        内容: q.fuguai_honbun,
      })) || [],
      工程進捗: ganttData?.tasks?.map((t: any) => ({
        工程: t.name,
        部署: t.department,
        進捗率: t.progress,
        開始日: new Date(t.start_date).toLocaleDateString('ja-JP'),
        終了日: new Date(t.end_date).toLocaleDateString('ja-JP'),
      })) || [],
    };

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `あなたは製造業の原価管理専門家です。以下のプロジェクトデータを分析し、経営者向けの総評を日本語で作成してください。

## 分析データ
${JSON.stringify(contextData, null, 2)}

## 出力形式
以下の形式で簡潔に総評を作成してください（200文字程度）：

1. **収益状況**: 利益率の評価と原価超過/削減の主要因
2. **リスク要因**: 顧客要求変更や不具合が原価に与えた影響
3. **工程状況**: 進捗遅延が原価に与える潜在的影響
4. **総合評価**: 1文で総括

箇条書きではなく、文章形式で自然に記述してください。`,
        },
      ],
    });

    const analysisText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return NextResponse.json({
      success: true,
      data: {
        seiban,
        analysis: analysisText,
        generatedAt: new Date().toISOString(),
        dataAvailability: {
          costAnalysis: !!costAnalysis,
          customerRequests: (customerRequests?.length || 0) > 0,
          qualityIssues: (qualityIssues?.length || 0) > 0,
          ganttData: !!ganttData,
        },
      },
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: "AI分析の生成に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
