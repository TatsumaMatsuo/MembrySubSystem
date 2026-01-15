import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";
import { authOptions } from "@/lib/auth-options";
import { getBaseRecords } from "@/lib/lark-client";
import { getLarkTables, getBaseTokenForTable, QUIZ_MASTER_FIELDS, QUIZ_ANSWER_HISTORY_FIELDS } from "@/lib/lark-tables";
import { QuizMaster, QuizAnswerHistory, TodayQuizResponse, QuizChoice } from "@/types";

// 期の計算（8月始まり）
function getCurrentFiscalPeriod(today: Date = new Date()): number {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  // 8月以降は year - 1975、1-7月は year - 1976
  return month >= 8 ? year - 1975 : year - 1976;
}

// 今日の日付（YYYY-MM-DD）
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 今日の開始・終了タイムスタンプ（ミリ秒）
function getTodayTimestampRange(): { start: number; end: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1; // 23:59:59.999
  return { start, end };
}

// 日替わりクイズの決定
function getTodayQuizIndex(quizCount: number): number {
  const baseDate = new Date("2024-01-01");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceBase = Math.floor((today.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceBase % quizCount;
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザー識別子として employeeId > email > name の優先順位で使用
    const userId = (session.user as any).employeeId || session.user.email || session.user.name || "";
    const userName = (session.user as any).employeeName || session.user.name || userId;

    if (!userId) {
      return NextResponse.json({ error: "ユーザー情報が取得できません" }, { status: 401 });
    }
    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("QUIZ_MASTER");
    const todayStr = getTodayDateString();
    const currentPeriod = getCurrentFiscalPeriod();

    console.log("[quiz] Config:", {
      tableId: tables.QUIZ_MASTER,
      baseToken: baseToken ? baseToken.substring(0, 10) + "..." : "EMPTY",
    });

    // クイズマスタ取得（一旦フィルタなしで全件取得してデバッグ）
    const quizResponse = await getBaseRecords(tables.QUIZ_MASTER, {
      baseToken,
    });
    console.log("[quiz] Quiz master response:", {
      code: quizResponse.code,
      msg: quizResponse.msg,
      total: quizResponse.data?.total,
      items: quizResponse.data?.items?.length || 0,
    });

    const quizzes: QuizMaster[] = (quizResponse.data?.items || []).map((item: any) => ({
      record_id: item.record_id,
      quiz_id: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.quiz_id]),
      question: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.question]),
      choice_a: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.choice_a]),
      choice_b: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.choice_b]),
      choice_c: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.choice_c]),
      correct_answer: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.correct_answer]) as QuizChoice,
      explanation: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.explanation]),
      category: extractTextValue(item.fields?.[QUIZ_MASTER_FIELDS.category]) as any,
      is_active: !!item.fields?.[QUIZ_MASTER_FIELDS.is_active],
    }));

    if (quizzes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          quiz: null,
          alreadyAnswered: false,
          userStats: { totalPoints: 0, rank: 0, totalParticipants: 0 },
        } as TodayQuizResponse,
      });
    }

    // ユーザーの全回答履歴を取得
    const allUserHistoryResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.user_email}] = "${userId}"`,
      baseToken,
    });

    // 今日の回答履歴をJavaScriptでフィルタリング
    const { start: todayStart, end: todayEnd } = getTodayTimestampRange();
    const allUserHistory = allUserHistoryResponse.data?.items || [];
    const todayHistoryItems = allUserHistory.filter((item: any) => {
      const answerDate = item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.answer_date];
      return answerDate >= todayStart && answerDate <= todayEnd;
    });

    const todayHistory = todayHistoryItems[0];
    const alreadyAnsweredToday = todayHistoryItems.length > 0;
    console.log("[quiz] alreadyAnsweredToday:", alreadyAnsweredToday, "todayHistoryCount:", todayHistoryItems.length);

    const answeredQuizIds = new Set<string>(
      (allUserHistoryResponse.data?.items || []).map((item: any) =>
        extractTextValue(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.quiz_id])
      )
    );

    // まだ回答していないクイズをフィルタリング
    const unansweredQuizzes = quizzes.filter(q => !answeredQuizIds.has(q.quiz_id));

    // 今日のクイズを決定（未回答クイズから日替わりで選択）
    let todayQuiz: QuizMaster | null = null;
    if (unansweredQuizzes.length > 0) {
      const todayIndex = getTodayQuizIndex(unansweredQuizzes.length);
      todayQuiz = unansweredQuizzes[todayIndex];
    }

    // 今日回答済みの場合は、今日回答したクイズを取得
    let todayAnsweredQuiz: QuizMaster | null = null;
    if (alreadyAnsweredToday && todayHistory) {
      const answeredQuizId = extractTextValue(todayHistory.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.quiz_id]);
      todayAnsweredQuiz = quizzes.find(q => q.quiz_id === answeredQuizId) || null;
    }

    const alreadyAnswered = alreadyAnsweredToday;

    // ユーザーの今期ポイント集計
    const userPointsResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `AND(CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.user_email}] = "${userId}", CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.fiscal_period}] = ${currentPeriod})`,
      baseToken,
    });

    const userPoints = (userPointsResponse.data?.items || []).reduce((sum: number, item: any) => {
      return sum + (Number(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.points]) || 0);
    }, 0);

    // 全ユーザーのポイント集計（ランキング用）
    const allHistoryResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.fiscal_period}] = ${currentPeriod}`,
      baseToken,
    });

    const userPointsMap = new Map<string, number>();
    (allHistoryResponse.data?.items || []).forEach((item: any) => {
      const email = extractTextValue(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.user_email]);
      const points = Number(item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.points]) || 0;
      userPointsMap.set(email, (userPointsMap.get(email) || 0) + points);
    });

    // ランキング計算
    const sortedPoints = Array.from(userPointsMap.values()).sort((a, b) => b - a);
    const myRank = sortedPoints.indexOf(userPoints) + 1 || sortedPoints.length + 1;
    const totalParticipants = userPointsMap.size;

    // レスポンス構築
    const response: TodayQuizResponse = {
      quiz: (alreadyAnswered || !todayQuiz) ? null : {
        record_id: todayQuiz.record_id,
        quiz_id: todayQuiz.quiz_id,
        question: todayQuiz.question,
        choice_a: todayQuiz.choice_a,
        choice_b: todayQuiz.choice_b,
        choice_c: todayQuiz.choice_c,
        category: todayQuiz.category,
        is_active: todayQuiz.is_active,
      },
      alreadyAnswered,
      allQuizzesCompleted: unansweredQuizzes.length === 0 && !alreadyAnsweredToday,
      userStats: {
        totalPoints: userPoints,
        rank: myRank,
        totalParticipants,
      },
    };

    // 今日回答済みの場合は結果も返す
    if (alreadyAnswered && todayHistory && todayAnsweredQuiz) {
      response.todayResult = {
        isCorrect: !!todayHistory.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.is_correct],
        correctAnswer: todayAnsweredQuiz.correct_answer,
        userAnswer: extractTextValue(todayHistory.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.user_answer]) as QuizChoice,
        explanation: todayAnsweredQuiz.explanation,
      };
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[quiz] Error:", error);
    return NextResponse.json(
      { error: "クイズの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
