import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";
import { authOptions } from "@/lib/auth-options";
import { getBaseRecords, createBaseRecord } from "@/lib/lark-client";
import { getLarkTables, getBaseTokenForTable, QUIZ_MASTER_FIELDS, QUIZ_ANSWER_HISTORY_FIELDS } from "@/lib/lark-tables";
import { QuizMaster, QuizAnswerRequest, QuizAnswerResponse, QuizChoice } from "@/types";

// 期の計算（8月始まり）
function getCurrentFiscalPeriod(today: Date = new Date()): number {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 8 ? year - 1975 : year - 1976;
}

// 今日の日付（ミリ秒タイムスタンプ）- Lark保存用
function getTodayTimestamp(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

// 今日の開始・終了タイムスタンプ（ミリ秒）
function getTodayTimestampRange(): { start: number; end: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = (session.user as any).employeeId || session.user.email || session.user.name || "";
    const userName = (session.user as any).employeeName || session.user.name || userId;

    if (!userId) {
      return NextResponse.json({ error: "ユーザー情報が取得できません" }, { status: 401 });
    }
    const body: QuizAnswerRequest = await request.json();
    const { quiz_id, answer } = body;

    if (!quiz_id || !answer) {
      return NextResponse.json({ error: "クイズIDと回答が必要です" }, { status: 400 });
    }

    if (!["A", "B", "C"].includes(answer)) {
      return NextResponse.json({ error: "回答はA, B, Cのいずれかです" }, { status: 400 });
    }

    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("QUIZ_MASTER");
    const currentPeriod = getCurrentFiscalPeriod();
    const { start: todayStart, end: todayEnd } = getTodayTimestampRange();

    // 既に今日回答済みかチェック（全履歴を取得してJSでフィルタリング）
    const existingResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.user_email}] = "${userId}"`,
      baseToken,
    });

    const todayAnswers = (existingResponse.data?.items || []).filter((item: any) => {
      const answerDate = item.fields?.[QUIZ_ANSWER_HISTORY_FIELDS.answer_date];
      return answerDate >= todayStart && answerDate <= todayEnd;
    });

    if (todayAnswers.length > 0) {
      return NextResponse.json({ error: "本日は既に回答済みです" }, { status: 400 });
    }

    // クイズマスタから正解を取得
    const quizResponse = await getBaseRecords(tables.QUIZ_MASTER, {
      filter: `CurrentValue.[${QUIZ_MASTER_FIELDS.quiz_id}] = "${quiz_id}"`,
      baseToken,
    });

    const quizItem = quizResponse.data?.items?.[0];
    if (!quizItem) {
      return NextResponse.json({ error: "クイズが見つかりません" }, { status: 404 });
    }

    const correctAnswer = extractTextValue(quizItem.fields?.[QUIZ_MASTER_FIELDS.correct_answer]) as QuizChoice;
    const explanation = extractTextValue(quizItem.fields?.[QUIZ_MASTER_FIELDS.explanation]);
    const isCorrect = answer === correctAnswer;
    const pointsEarned = isCorrect ? 1 : 0;

    // 回答履歴を保存
    const historyBaseToken = getBaseTokenForTable("QUIZ_ANSWER_HISTORY");
    const todayTimestamp = getTodayTimestamp();
    const recordData = {
      [QUIZ_ANSWER_HISTORY_FIELDS.user_email]: userId,
      [QUIZ_ANSWER_HISTORY_FIELDS.user_name]: userName,
      [QUIZ_ANSWER_HISTORY_FIELDS.quiz_id]: quiz_id,
      [QUIZ_ANSWER_HISTORY_FIELDS.answer_date]: todayTimestamp,
      [QUIZ_ANSWER_HISTORY_FIELDS.user_answer]: answer,
      [QUIZ_ANSWER_HISTORY_FIELDS.is_correct]: isCorrect,
      [QUIZ_ANSWER_HISTORY_FIELDS.points]: pointsEarned,
      [QUIZ_ANSWER_HISTORY_FIELDS.fiscal_period]: currentPeriod,
    };
    await createBaseRecord(tables.QUIZ_ANSWER_HISTORY, recordData, { baseToken: historyBaseToken });

    // 新しいポイント合計を計算
    const userPointsResponse = await getBaseRecords(tables.QUIZ_ANSWER_HISTORY, {
      filter: `AND(CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.user_email}] = "${userId}", CurrentValue.[${QUIZ_ANSWER_HISTORY_FIELDS.fiscal_period}] = ${currentPeriod})`,
      baseToken,
    });

    const newTotalPoints = (userPointsResponse.data?.items || []).reduce((sum: number, item: any) => {
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

    const sortedPoints = Array.from(userPointsMap.values()).sort((a, b) => b - a);
    const newRank = sortedPoints.indexOf(newTotalPoints) + 1 || sortedPoints.length;

    const response: QuizAnswerResponse = {
      isCorrect,
      correctAnswer,
      explanation,
      pointsEarned,
      newTotalPoints,
      newRank,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[quiz/answer] Error:", error);
    return NextResponse.json(
      { error: "回答の送信に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
