import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface SalesOverviewData {
  period: number;
  totalAmount: number;
  totalCount: number;
  totalProfit: number;
  profitRate: number;
  budget: number;
  achievementRate: number;
  avgUnitPrice: number;
  regionSummary: {
    region: string;
    amount: number;
    count: number;
    profit: number;
    profitRate: number;
  }[];
  officeSummary: {
    office: string;
    amount: number;
    count: number;
    profit: number;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
    count: number;
  }[];
  companyKPI: {
    salesTarget: number;
    costOfSalesRate: number;
    operatingIncomeRate: number;
  } | null;
}

function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}億円`;
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万円`;
  }
  return `${value.toLocaleString()}円`;
}

interface SalesAreaData {
  period: number;
  area: string;
  totalAmount: number;
  totalCount: number;
  totalProfit: number;
  profitRate: number;
  yearlyBudget: number;
  achievementRate: number;
  avgUnitPrice: number;
  targetProfitRate: number;
  comparison: {
    currentAmount: number;
    prevAmount: number;
    currentCount: number;
    prevCount: number;
    currentProfit: number;
    prevProfit: number;
  };
  officeSummary: {
    office: string;
    amount: number;
    count: number;
    profit: number;
    profitRate: number;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
    profit: number;
  }[];
}

interface SalesOfficeData {
  period: number;
  selectedOffice: string;
  selectedOfficeData: {
    office: string;
    amount: number;
    profit: number;
    profitRate: number;
    count: number;
    avgUnitPrice: number;
    yearlyBudget: number;
    achievementRate: number;
    ytdBudgetAmount: number;
    ytdAchievementRate: number;
    yoyAmountChange: number;
    yoyProfitChange: number;
    salesPersons: {
      name: string;
      amount: number;
      profit: number;
      profitRate: number;
      count: number;
    }[];
    quarterlyData: {
      quarter: string;
      amount: number;
      profit: number;
    }[];
  } | null;
  officeSummary: {
    office: string;
    amount: number;
    profit: number;
    profitRate: number;
    count: number;
  }[];
  companyKPI: {
    salesTarget: number;
    costOfSalesRate: number;
  } | null;
}

interface SalesPersonData {
  period: number;
  selectedPerson: string;
  selectedOffice: string;
  selectedPersonData: {
    name: string;
    office: string;
    amount: number;
    profit: number;
    profitRate: number;
    count: number;
    avgUnitPrice: number;
    yearlyBudget: number;
    achievementRate: number;
    ytdBudgetAmount: number;
    ytdAchievementRate: number;
    yoyAmountChange: number;
    yoyProfitChange: number;
    targetProfitRate: number;
    quarterlyData: {
      quarter: string;
      amount: number;
      profit: number;
    }[];
  } | null;
  salesPersonSummary: {
    name: string;
    office: string;
    amount: number;
    profit: number;
    profitRate: number;
    count: number;
  }[];
  companyKPI: {
    salesTarget: number;
    costOfSalesRate: number;
  } | null;
}

interface DeficitAnalysisData {
  period: number;
  totalCount: number;
  totalLoss: number;
  avgLoss: number;
  deficitRate: number;
  highRiskPjCategories: string[];
  highRiskCustomers: string[];
  commonFactors: string[];
  seasonalPattern: string | null;
  byPjCategory: {
    name: string;
    count: number;
    loss: number;
    avgProfitRate: number;
  }[];
  byTantousha: {
    name: string;
    office: string;
    count: number;
    loss: number;
  }[];
  byCustomer: {
    name: string;
    count: number;
    loss: number;
  }[];
  monthlyTrend: {
    month: string;
    count: number;
    loss: number;
  }[];
  recommendations: string[];
  yearlyTrend: {
    period: number;
    count: number;
    loss: number;
  }[];
}

function buildSalesOfficePrompt(data: SalesOfficeData): string {
  const topOffices = [...data.officeSummary].sort((a, b) => b.amount - a.amount).slice(0, 5);

  if (data.selectedOfficeData) {
    const od = data.selectedOfficeData;
    const topPersons = od.salesPersons.slice(0, 3);

    return `あなたは製造業の売上分析専門家です。以下の営業所別売上データを分析し、営業所長向けの分析レポートを日本語で作成してください。

## 第${data.period}期 ${od.office} 売上データ

### 営業所実績
- 売上金額: ${formatCurrency(od.amount)}
- 受注件数: ${od.count}件
- 粗利: ${formatCurrency(od.profit)}
- 粗利率: ${od.profitRate.toFixed(1)}%
- 平均単価: ${formatCurrency(od.avgUnitPrice)}

### 予算対比
- 年間予算: ${formatCurrency(od.yearlyBudget)}
- 達成率: ${od.achievementRate.toFixed(1)}%
- 累計予算達成率: ${od.ytdAchievementRate.toFixed(1)}%

### 前年比較
- 売上前年比: ${od.yoyAmountChange >= 0 ? '+' : ''}${od.yoyAmountChange.toFixed(1)}%
- 粗利前年比: ${od.yoyProfitChange >= 0 ? '+' : ''}${od.yoyProfitChange.toFixed(1)}%

### 担当者別実績（上位）
${topPersons.map((p, i) => `${i + 1}. ${p.name}: ${formatCurrency(p.amount)}（${p.count}件, 粗利率${p.profitRate.toFixed(1)}%）`).join('\n')}

### 四半期推移
${od.quarterlyData.map(q => `- ${q.quarter}: ${formatCurrency(q.amount)}（粗利: ${formatCurrency(q.profit)}）`).join('\n')}

## 出力形式
以下の観点から250文字程度で${od.office}の分析を記述してください：

1. **予算達成状況**: 現在の進捗と課題
2. **収益性**: 粗利率の評価と改善点
3. **担当者分析**: 好調・不調の担当者と特徴
4. **アクションポイント**: 具体的な改善提案

文章形式で自然に記述し、数値を含めて説明してください。`;
  }

  return `あなたは製造業の売上分析専門家です。以下の営業所別売上データを分析し、営業部長向けの分析レポートを日本語で作成してください。

## 第${data.period}期 営業所別売上データ

### 営業所別ランキング
${topOffices.map((o, i) => `${i + 1}. ${o.office}: ${formatCurrency(o.amount)}（${o.count}件, 粗利率${o.profitRate.toFixed(1)}%）`).join('\n')}

${data.companyKPI ? `### 全社KPI
- 目標売上: ${formatCurrency(data.companyKPI.salesTarget)}
- 目標売上原価率: ${data.companyKPI.costOfSalesRate}%` : ''}

## 出力形式
以下の観点から250文字程度で営業所全体の分析を記述してください：

1. **営業所別パフォーマンス**: 好調・不調の営業所とその特徴
2. **収益性分析**: 営業所間の粗利率差と要因推測
3. **改善提案**: 営業所間のベストプラクティス共有ポイント

文章形式で自然に記述し、数値を含めて説明してください。`;
}

function buildSalesPersonPrompt(data: SalesPersonData): string {
  const topPersons = [...data.salesPersonSummary].sort((a, b) => b.amount - a.amount).slice(0, 5);

  if (data.selectedPersonData) {
    const pd = data.selectedPersonData;

    return `あなたは製造業の売上分析専門家です。以下の担当者別売上データを分析し、個人向けの分析レポートを日本語で作成してください。

## 第${data.period}期 ${pd.name}（${pd.office}）売上データ

### 個人実績
- 売上金額: ${formatCurrency(pd.amount)}
- 受注件数: ${pd.count}件
- 粗利: ${formatCurrency(pd.profit)}
- 粗利率: ${pd.profitRate.toFixed(1)}%（目標: ${pd.targetProfitRate.toFixed(1)}%）
- 平均単価: ${formatCurrency(pd.avgUnitPrice)}

### 予算対比
- 年間予算: ${formatCurrency(pd.yearlyBudget)}
- 達成率: ${pd.achievementRate.toFixed(1)}%
- 累計予算達成率: ${pd.ytdAchievementRate.toFixed(1)}%

### 前年比較
- 売上前年比: ${pd.yoyAmountChange >= 0 ? '+' : ''}${pd.yoyAmountChange.toFixed(1)}%
- 粗利前年比: ${pd.yoyProfitChange >= 0 ? '+' : ''}${pd.yoyProfitChange.toFixed(1)}%

### 四半期推移
${pd.quarterlyData.map(q => `- ${q.quarter}: ${formatCurrency(q.amount)}（粗利: ${formatCurrency(q.profit)}）`).join('\n')}

## 出力形式
以下の観点から250文字程度で${pd.name}の分析を記述してください：

1. **予算達成状況**: 現在の進捗と年度末見込み
2. **収益性**: 粗利率の目標対比と改善点
3. **強み・改善点**: 四半期推移から見える特徴
4. **具体的アドバイス**: 個人として取り組むべきこと

励ましを含めた建設的なトーンで記述してください。`;
  }

  return `あなたは製造業の売上分析専門家です。以下の担当者別売上データを分析し、営業マネージャー向けの分析レポートを日本語で作成してください。

## 第${data.period}期 担当者別売上データ
${data.selectedOffice !== "全営業所" ? `（${data.selectedOffice}所属）` : ""}

### 担当者別ランキング
${topPersons.map((p, i) => `${i + 1}. ${p.name}（${p.office}）: ${formatCurrency(p.amount)}（${p.count}件, 粗利率${p.profitRate.toFixed(1)}%）`).join('\n')}

${data.companyKPI ? `### 全社KPI
- 目標売上: ${formatCurrency(data.companyKPI.salesTarget)}
- 目標売上原価率: ${data.companyKPI.costOfSalesRate}%` : ''}

## 出力形式
以下の観点から250文字程度で担当者全体の分析を記述してください：

1. **パフォーマンス分析**: 好調・不調の担当者とその特徴
2. **収益性分析**: 担当者間の粗利率差と要因推測
3. **育成ポイント**: チームとして取り組むべき改善点

文章形式で自然に記述し、数値を含めて説明してください。`;
}

function buildSalesAreaPrompt(data: SalesAreaData): string {
  const topOffices = [...data.officeSummary].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const yoyGrowth = data.comparison.prevAmount > 0 ? ((data.totalAmount / data.comparison.prevAmount) - 1) * 100 : 0;
  const profitYoyGrowth = data.comparison.prevProfit > 0 ? ((data.totalProfit / data.comparison.prevProfit) - 1) * 100 : 0;

  return `あなたは製造業の売上分析専門家です。以下の${data.area}エリアの売上データを分析し、エリアマネージャー向けの分析レポートを日本語で作成してください。

## 第${data.period}期 ${data.area}エリア 売上データ

### エリア実績
- 売上金額: ${formatCurrency(data.totalAmount)}
- 受注件数: ${data.totalCount}件
- 粗利: ${formatCurrency(data.totalProfit)}
- 粗利率: ${data.profitRate.toFixed(1)}%（目標: ${data.targetProfitRate.toFixed(1)}%）
- 平均単価: ${formatCurrency(data.avgUnitPrice)}

### 予算対比
- 年度予算: ${formatCurrency(data.yearlyBudget)}
- 達成率: ${data.achievementRate.toFixed(1)}%

### 前年比較
- 売上前年比: ${yoyGrowth >= 0 ? '+' : ''}${yoyGrowth.toFixed(1)}%
- 粗利前年比: ${profitYoyGrowth >= 0 ? '+' : ''}${profitYoyGrowth.toFixed(1)}%
- 件数前年比: ${data.comparison.prevCount > 0 ? ((data.totalCount / data.comparison.prevCount - 1) * 100).toFixed(1) : 'N/A'}%

### 営業所別実績（上位）
${topOffices.map((o, i) => `${i + 1}. ${o.office}: ${formatCurrency(o.amount)}（${o.count}件, 粗利率${o.profitRate.toFixed(1)}%）`).join('\n')}

### 月次推移（実績がある月）
${data.monthlyTrend.map(m => `- ${m.month}: ${formatCurrency(m.amount)}（粗利: ${formatCurrency(m.profit)}）`).join('\n')}

## 出力形式
以下の観点から250文字程度で${data.area}エリアの分析を記述してください：

1. **予算達成状況**: 現在の進捗評価と年度末見込み
2. **収益性**: 粗利率の目標対比、前年比較
3. **営業所別特徴**: 好調・不調の営業所と要因推測
4. **改善提案**: 具体的なアクションポイント

文章形式で自然に記述し、数値を含めて説明してください。`;
}

function buildDeficitAnalysisPrompt(data: DeficitAnalysisData): string {
  const topCategories = data.byPjCategory.slice(0, 3);
  const topTantousha = data.byTantousha.slice(0, 3);
  const topCustomers = data.byCustomer.slice(0, 3);

  // 年度別トレンドの分析
  const yearlyTrendText = data.yearlyTrend.length > 1
    ? data.yearlyTrend.map((y, i) => {
        const prevYear = i > 0 ? data.yearlyTrend[i - 1] : null;
        const countChange = prevYear && prevYear.count > 0 ? ((y.count - prevYear.count) / prevYear.count * 100).toFixed(1) : null;
        const lossChange = prevYear && prevYear.loss > 0 ? ((y.loss - prevYear.loss) / prevYear.loss * 100).toFixed(1) : null;
        return `- 第${y.period}期: ${y.count}件 / ${formatCurrency(y.loss)}${countChange ? ` (前年比: 件数${countChange}%, 金額${lossChange}%)` : ''}`;
      }).join('\n')
    : '年度別データなし';

  return `あなたは製造業の収益改善コンサルタントです。以下の赤字案件データを分析し、経営者・営業マネージャー向けの改善レポートを日本語で作成してください。

## 重要：製造業特有の赤字要因について
この会社は産業機械・設備メーカーです。赤字案件の根本原因を分析する際は、以下の製造業特有の要因を必ず考慮してください：

### 技術的要因
- **設計不具合**: 設計段階でのミス、仕様の見落とし、技術的な見積もり誤差
- **製造不具合による再作成**: 加工ミス、組立エラー、品質不良による作り直し
- **検査体制の不備**: 検査工程の抜け、検査基準の曖昧さ、出荷前検査の不足
- **仕様変更対応**: 顧客からの追加要求や仕様変更への対応コスト
- **試作・調整コスト**: 新規案件での予想外の調整工数

### 営業・見積要因
- **見積精度不足**: 原価見積もりの甘さ、工数見積もりの誤差
- **価格競争による受注**: 無理な値引きでの受注
- **顧客との認識齟齬**: 仕様・納期・品質基準の認識のずれ

### 外注・外部要因
- **外注製作の管理不足**: 外注先の品質管理不備、納期遅延、コミュニケーション不足
- **外注先の技術力不足**: 外注先の加工精度・技術レベルの問題
- **材料費高騰**: 受注時と製造時の原材料価格差
- **外注費増加**: 協力会社への発注コスト増

## 第${data.period}期 赤字案件データ

### 赤字案件概要
- 赤字案件数: ${data.totalCount}件
- 赤字総額: ${formatCurrency(data.totalLoss)}
- 平均赤字額: ${formatCurrency(data.avgLoss)}
- 全案件に対する赤字率: ${data.deficitRate.toFixed(1)}%

### 年度別推移（3期比較）
${yearlyTrendText}

### PJ区分別 赤字ワースト
${topCategories.map((c, i) => `${i + 1}. ${c.name}: ${c.count}件 / ${formatCurrency(c.loss)}（平均粗利率: ${c.avgProfitRate.toFixed(1)}%）`).join('\n')}

### 担当者別 赤字ワースト
${topTantousha.map((t, i) => `${i + 1}. ${t.name}（${t.office}）: ${t.count}件 / ${formatCurrency(t.loss)}`).join('\n')}

### 顧客別 赤字ワースト
${topCustomers.map((c, i) => `${i + 1}. ${c.name}: ${c.count}件 / ${formatCurrency(c.loss)}`).join('\n')}

### 高リスクPJ区分
${data.highRiskPjCategories.length > 0 ? data.highRiskPjCategories.join(', ') : 'なし'}

### 赤字リピート顧客
${data.highRiskCustomers.length > 0 ? data.highRiskCustomers.join(', ') : 'なし'}

### 共通要因（システム分析結果）
${data.commonFactors.length > 0 ? data.commonFactors.map(f => `- ${f}`).join('\n') : '特定なし'}

${data.seasonalPattern ? `### 季節性パターン\n${data.seasonalPattern}` : ''}

### 月次推移
${data.monthlyTrend.filter(m => m.count > 0).map(m => `- ${m.month}: ${m.count}件 / ${formatCurrency(m.loss)}`).join('\n')}

## 出力形式
以下の観点から500文字程度で赤字案件の分析と改善提案を記述してください：

1. **現状評価**: 赤字案件の深刻度、年度推移からの傾向

2. **根本原因分析**: PJ区分・担当者・顧客の傾向から推測される原因
   - 設計不具合や製造不具合の可能性を検討
   - 見積精度や営業プロセスの問題を検討
   - 特定の顧客・案件タイプでの繰り返しパターンを分析

3. **優先対策**: 最も効果的な改善策（具体的に）
   - 設計レビュー強化、製造品質向上の観点を含める
   - 検査体制の強化（工程内検査、出荷前検査の徹底）
   - 外注製作の管理体制強化（外注先の選定・評価・品質管理）
   - 見積プロセスの改善策を提案

4. **予防策**: 今後の赤字発生を防ぐための仕組み提案
   - 受注前のリスク評価チェックリスト
   - 設計・製造段階での早期警告システム
   - 検査基準の明確化と検査記録の徹底
   - 外注先の定期評価制度と品質監査
   - 原価管理の強化策

5. **アクションプラン**: 今すぐ取り組むべき3つのアクション

建設的かつ具体的なトーンで記述してください。数値を根拠として示し、実行可能な提案を行ってください。
設計不具合や製造品質問題の可能性がある場合は、具体的な改善策を提案してください。`;
}

function buildSalesOverviewPrompt(data: SalesOverviewData): string {
  const topRegion = [...data.regionSummary].sort((a, b) => b.amount - a.amount)[0];
  const topOffices = [...data.officeSummary].sort((a, b) => b.amount - a.amount).slice(0, 3);

  // 月別トレンドの分析
  const monthlyAmounts = data.monthlyTrend.map(m => m.amount);
  const hasDataMonths = monthlyAmounts.filter(a => a > 0).length;
  const avgMonthlyAmount = hasDataMonths > 0 ? monthlyAmounts.reduce((a, b) => a + b, 0) / hasDataMonths : 0;

  return `あなたは製造業の売上分析専門家です。以下の売上データを分析し、経営者向けの分析レポートを日本語で作成してください。

## 第${data.period}期 売上データ

### 全体実績
- 売上金額: ${formatCurrency(data.totalAmount)}
- 受注件数: ${data.totalCount}件
- 粗利: ${formatCurrency(data.totalProfit)}
- 粗利率: ${data.profitRate.toFixed(1)}%
- 平均単価: ${formatCurrency(data.avgUnitPrice)}

### 予算対比
- 年度予算: ${formatCurrency(data.budget)}
- 達成率: ${data.achievementRate.toFixed(1)}%
${data.companyKPI ? `- 全社目標売上: ${formatCurrency(data.companyKPI.salesTarget)}
- 目標売上原価率: ${data.companyKPI.costOfSalesRate}%
- 目標営業利益率: ${data.companyKPI.operatingIncomeRate}%` : ''}

### 地域別構成
${data.regionSummary.map(r => `- ${r.region}: ${formatCurrency(r.amount)}（${r.count}件, 粗利率${r.profitRate.toFixed(1)}%）`).join('\n')}

### 上位営業所
${topOffices.map((o, i) => `${i + 1}. ${o.office}: ${formatCurrency(o.amount)}（${o.count}件）`).join('\n')}

### 月次推移（実績がある月）
${data.monthlyTrend.filter(m => m.amount > 0).map(m => `- ${m.month}: ${formatCurrency(m.amount)}（${m.count}件）`).join('\n')}
- 月平均売上: ${formatCurrency(avgMonthlyAmount)}

## 出力形式
以下の観点から300文字程度で分析を記述してください：

1. **売上・予算達成状況**: 現在の進捗と年度末見込み
2. **収益性分析**: 粗利率の評価、地域・営業所別の特徴
3. **トレンド分析**: 月次推移から見える傾向
4. **注目ポイント**: 強み・課題・改善機会

箇条書きではなく、文章形式で自然に記述してください。具体的な数値を含めて説明してください。`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { success: false, error: "type と data が必要です" },
        { status: 400 }
      );
    }

    let prompt: string;

    switch (type) {
      case "sales-overview":
        prompt = buildSalesOverviewPrompt(data as SalesOverviewData);
        break;
      case "sales-area":
        prompt = buildSalesAreaPrompt(data as SalesAreaData);
        break;
      case "sales-office":
        prompt = buildSalesOfficePrompt(data as SalesOfficeData);
        break;
      case "sales-person":
        prompt = buildSalesPersonPrompt(data as SalesPersonData);
        break;
      case "deficit-analysis":
        prompt = buildDeficitAnalysisPrompt(data as DeficitAnalysisData);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `未対応の分析タイプ: ${type}` },
          { status: 400 }
        );
    }

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const analysisText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      type,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: "AI分析の生成に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
