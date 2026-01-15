import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";
import { authOptions } from "@/lib/auth-options";
import { getBaseRecords } from "@/lib/lark-client";
import { getLarkTables, getBaseTokenForTable, QUIZ_ANSWER_HISTORY_FIELDS } from "@/lib/lark-tables";
import { QuizRankingEntry, QuizRankingResponse } from "@/types";

// 期の計算（8月始まり）
function getCurrentFiscalPeriod(today: Date = new Date()): number {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 8 ? year - 1975 : year - 1976;
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = (session.user as any).employeeId || session.user.email || session.user.name || "";
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period = periodParam ? parseInt(periodParam, 10) : getCurrentFiscalPeriod();

    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("QUIZ_ANSWER_HISTORY");

    // 指定期間の全回答履歴を取得
    const historyResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.fiscal_period}] = ${period}`,
      baseToken,
    });

    // ユーザーごとに集計
    const userStats = new Map<string, {
      user_name: string;
      total_points: number;
      correct_count: number;
      answer_count: number;
    }>();

    (historyResponse.data?.items || []).forEach((item: any) => {
      const email = extractTextValue(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.user_email]);
      const name = extractTextValue(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.user_name]) || email;
      const points = Number(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.points]) || 0;
      const isCorrect = !!item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.is_correct];

      if (!userStats.has(email)) {
        userStats.set(email, {
          user_name: name,
          total_points: 0,
          correct_count: 0,
          answer_count: 0,
        });
      }

      const stats = userStats.get(email)!;
      stats.total_points += points;
      stats.answer_count += 1;
      if (isCorrect) stats.correct_count += 1;
    });

    // ランキング作成
    const rankings: QuizRankingEntry[] = Array.from(userStats.entries())
      .map(([email, stats]) => ({
        rank: 0,
        user_name: stats.user_name,
        user_email: email,
        total_points: stats.total_points,
        correct_count: stats.correct_count,
        answer_count: stats.answer_count,
        correct_rate: stats.answer_count > 0 ? Math.round((stats.correct_count / stats.answer_count) * 100) : 0,
      }))
      .sort((a, b) => {
        // ポイント降順、同点なら正解率降順
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return b.correct_rate - a.correct_rate;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    // 自分の順位
    const myEntry = rankings.find(r => r.user_email === userId);
    const myRank = myEntry?.rank || null;

    const response: QuizRankingResponse = {
      period,
      periodLabel: `第${period}期`,
      rankings: rankings.slice(0, 50), // 上位50名まで
      myRank,
      totalParticipants: rankings.length,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[quiz/ranking] Error:", error);
    return NextResponse.json(
      { error: "ランキングの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
