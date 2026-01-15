import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createBaseRecord } from "@/lib/lark-client";
import { getLarkTables, getBaseTokenForTable, QUIZ_MASTER_FIELDS } from "@/lib/lark-tables";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout for bulk import

interface QuizData {
  quiz_id: string;
  category: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  correct_answer: string;
  explanation: string;
  difficulty?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const quizzes: QuizData[] = body.quizzes;

    if (!quizzes || !Array.isArray(quizzes) || quizzes.length === 0) {
      return NextResponse.json({ error: "クイズデータが必要です" }, { status: 400 });
    }

    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("QUIZ_MASTER");

    console.log("[quiz-import] Starting import of", quizzes.length, "quizzes");

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // バッチ処理（10件ずつ）
    const batchSize = 10;
    for (let i = 0; i < quizzes.length; i += batchSize) {
      const batch = quizzes.slice(i, i + batchSize);

      const promises = batch.map(async (quiz) => {
        try {
          const fields = {
            [QUIZ_MASTER_FIELDS.quiz_id]: quiz.quiz_id,
            [QUIZ_MASTER_FIELDS.question]: quiz.question,
            [QUIZ_MASTER_FIELDS.choice_a]: quiz.choice_a,
            [QUIZ_MASTER_FIELDS.choice_b]: quiz.choice_b,
            [QUIZ_MASTER_FIELDS.choice_c]: quiz.choice_c,
            [QUIZ_MASTER_FIELDS.correct_answer]: quiz.correct_answer,
            [QUIZ_MASTER_FIELDS.explanation]: quiz.explanation,
            [QUIZ_MASTER_FIELDS.category]: quiz.category,
            [QUIZ_MASTER_FIELDS.is_active]: true,
          };

          const response = await createBaseRecord(tables.QUIZ_MASTER, fields, { baseToken });

          if (response.code === 0) {
            return { success: true, quiz_id: quiz.quiz_id };
          } else {
            return { success: false, quiz_id: quiz.quiz_id, error: response.msg };
          }
        } catch (error) {
          return { success: false, quiz_id: quiz.quiz_id, error: String(error) };
        }
      });

      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${result.quiz_id}: ${result.error}`);
        }
      }

      console.log(`[quiz-import] Progress: ${Math.min(i + batchSize, quizzes.length)}/${quizzes.length}`);

      // Rate limiting: wait 500ms between batches
      if (i + batchSize < quizzes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log("[quiz-import] Import completed:", results);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("[quiz-import] Error:", error);
    return NextResponse.json(
      { error: "インポートに失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
