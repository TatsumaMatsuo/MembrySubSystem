/**
 * クイズデータインポートスクリプト
 * 実行方法: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/import-quiz-data.ts
 */

import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// 環境変数読み込み
dotenv.config({ path: ".env.local" });

const QUIZ_MASTER_FIELDS = {
  quiz_id: "クイズID",
  question: "問題文",
  choice_a: "選択肢A",
  choice_b: "選択肢B",
  choice_c: "選択肢C",
  correct_answer: "正解",
  explanation: "解説",
  category: "カテゴリ",
  is_active: "有効フラグ",
} as const;

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

async function importQuizData() {
  console.log("=== クイズデータインポート開始 ===");

  // Larkクライアント初期化
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
    console.error("LARK_APP_ID または LARK_APP_SECRET が設定されていません");
    process.exit(1);
  }

  const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: larkDomain,
  });

  const baseToken = process.env.LARK_BASE_TOKEN || "";
  const tableId = process.env.LARK_TABLE_QUIZ_MASTER || "tbl5Od0bDQEHG3Wm";

  console.log("BaseToken:", baseToken.substring(0, 10) + "...");
  console.log("TableId:", tableId);

  // クイズデータ読み込み
  const scratchpadPath = path.join(
    process.env.TEMP || "/tmp",
    "claude/C--Users-tatsuma-m-Documents-AI-MembrySubSystem/526a2833-470d-4599-8e1e-7a005cde71c7/scratchpad"
  );

  const quizFiles = [
    "quiz-data.json",
    "quiz-data-part2.json",
    "quiz-data-part3.json",
    "quiz-data-part4.json",
  ];

  let allQuizzes: QuizData[] = [];

  for (const file of quizFiles) {
    try {
      const filePath = path.join(scratchpadPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const quizzes = JSON.parse(content) as QuizData[];
      allQuizzes = allQuizzes.concat(quizzes);
      console.log(`${file}: ${quizzes.length}問読み込み`);
    } catch (error) {
      console.error(`${file} の読み込みに失敗:`, error);
    }
  }

  console.log(`\n合計: ${allQuizzes.length}問`);

  // インポート実行
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  const batchSize = 10;
  for (let i = 0; i < allQuizzes.length; i += batchSize) {
    const batch = allQuizzes.slice(i, i + batchSize);

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

        const response = await larkClient.bitable.appTableRecord.create({
          path: {
            app_token: baseToken,
            table_id: tableId,
          },
          data: { fields },
        });

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

    const progress = Math.min(i + batchSize, allQuizzes.length);
    console.log(`進捗: ${progress}/${allQuizzes.length} (成功: ${results.success}, 失敗: ${results.failed})`);

    // Rate limiting
    if (i + batchSize < allQuizzes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log("\n=== インポート完了 ===");
  console.log(`成功: ${results.success}`);
  console.log(`失敗: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log("\nエラー詳細:");
    results.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    if (results.errors.length > 10) {
      console.log(`  ... 他 ${results.errors.length - 10} 件`);
    }
  }
}

importQuizData().catch(console.error);
