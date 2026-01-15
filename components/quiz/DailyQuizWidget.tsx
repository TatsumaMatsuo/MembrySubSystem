"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Loader2,
  ChevronRight,
  Users,
  X,
  Sparkles,
  Star,
} from "lucide-react";
import { TodayQuizResponse, QuizAnswerResponse, QuizChoice, QuizRankingResponse } from "@/types";

interface DailyQuizWidgetProps {
  className?: string;
}

export function DailyQuizWidget({ className = "" }: DailyQuizWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<TodayQuizResponse | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<QuizChoice | null>(null);
  const [answerResult, setAnswerResult] = useState<QuizAnswerResponse | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setRankingData] = useState<QuizRankingResponse | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // クイズデータ取得
  useEffect(() => {
    fetchQuiz();
  }, []);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/quiz", { credentials: "include" });
      const result = await res.json();
      if (result.success) {
        setQuizData(result.data);
      } else {
        setError(result.error || "クイズの取得に失敗しました");
      }
    } catch (e) {
      setError("クイズの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 回答送信
  const submitAnswer = async () => {
    if (!selectedAnswer || !quizData?.quiz) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quiz_id: quizData.quiz.quiz_id,
          answer: selectedAnswer,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAnswerResult(result.data);
        // クイズデータを更新
        setQuizData((prev) =>
          prev
            ? {
                ...prev,
                alreadyAnswered: true,
                todayResult: {
                  isCorrect: result.data.isCorrect,
                  correctAnswer: result.data.correctAnswer,
                  userAnswer: selectedAnswer,
                  explanation: result.data.explanation,
                },
                userStats: {
                  ...prev.userStats,
                  totalPoints: result.data.newTotalPoints,
                  rank: result.data.newRank,
                },
              }
            : null
        );
      } else {
        setError(result.error || "回答の送信に失敗しました");
      }
    } catch (e) {
      setError("回答の送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // ランキング取得
  const fetchRanking = async () => {
    try {
      setRankingLoading(true);
      const res = await fetch("/api/quiz/ranking", { credentials: "include" });
      const result = await res.json();
      if (result.success) {
        setRankingData(result.data);
      }
    } catch (e) {
      console.error("ランキング取得エラー:", e);
    } finally {
      setRankingLoading(false);
    }
  };

  const openRanking = () => {
    setShowRanking(true);
    fetchRanking();
  };

  // 選択肢の絵文字
  const choiceEmojis: Record<QuizChoice, string> = {
    A: "🅰️",
    B: "🅱️",
    C: "©️",
  };

  // ローディング中
  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-lg p-6 border-2 border-yellow-200 ${className}`}>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
          <span className="text-amber-500 text-sm font-medium animate-pulse">クイズを準備中だクマ...</span>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-lg p-6 border-2 border-yellow-200 ${className}`}>
        <div className="text-center py-4">
          <span className="text-4xl mb-2 block">😢</span>
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button
            onClick={fetchQuiz}
            className="px-4 py-2 bg-amber-100 text-amber-600 text-sm rounded-full hover:bg-amber-200 transition-all font-medium"
          >
            🔄 もう一度試すクマ
          </button>
        </div>
      </div>
    );
  }

  // 全てのクイズを回答済みの場合
  if (quizData?.allQuizzesCompleted) {
    return (
      <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-lg p-6 border-2 border-yellow-200 ${className}`}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-24 relative flex-shrink-0">
            <Image
              src="/images/menkuma-quiz.png"
              alt="メンくま教授"
              fill
              className="object-contain"
            />
            <span className="absolute -top-2 -right-1 text-lg">🎓🏆</span>
          </div>
          <div className="text-center flex-1">
            <span className="text-4xl mb-2 block">🎊</span>
            <p className="text-amber-600 font-bold">全クイズクリアだクマ！</p>
            <p className="text-gray-500 text-sm mt-1">すべてのクイズに回答したクマ！</p>
            <p className="text-gray-400 text-xs mt-1">新しいクイズを待つクマ〜</p>
          </div>
        </div>
      </div>
    );
  }

  // クイズがない場合
  if (!quizData || (!quizData.quiz && !quizData.alreadyAnswered)) {
    return (
      <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-lg p-6 border-2 border-yellow-200 ${className}`}>
        <div className="text-center py-6">
          <span className="text-5xl mb-3 block">😴</span>
          <p className="text-gray-500 text-sm">今日のクイズはおやすみだクマ</p>
          <p className="text-gray-400 text-xs mt-1">また明日チャレンジするクマ！</p>
        </div>
      </div>
    );
  }

  const { quiz, alreadyAnswered, todayResult, userStats } = quizData;

  return (
    <>
      <div className={`bg-gradient-to-br from-yellow-50 via-white to-orange-50 rounded-3xl shadow-lg overflow-hidden border-2 border-yellow-200 ${className}`}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <div>
                <span className="text-white font-bold text-lg">メンくま教授のクイズ</span>
                <Sparkles className="w-4 h-4 text-yellow-100 inline ml-1" />
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/25 backdrop-blur-sm rounded-full px-4 py-1.5">
              <span className="text-lg">⭐</span>
              <span className="text-white text-sm font-bold">
                {userStats.totalPoints} pt
              </span>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-5">
          {/* 未回答：問題表示 */}
          {!alreadyAnswered && quiz && (
            <>
              <div className="mb-5">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-600 text-xs rounded-full mb-3 font-medium">
                  📚 {quiz.category}
                </span>
                {/* メンくま教授と吹き出し */}
                <div className="flex items-start gap-3">
                  {/* メンくま教授 */}
                  <div className="flex-shrink-0 relative">
                    <div className="w-20 h-24 relative">
                      <Image
                        src="/images/menkuma-quiz.png"
                        alt="メンくま教授"
                        fill
                        className="object-contain"
                      />
                    </div>
                    {/* 教授帽子アイコン */}
                    <span className="absolute -top-2 -right-1 text-lg">🎓</span>
                  </div>
                  {/* 吹き出し */}
                  <div className="flex-1 relative">
                    <div className="absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white -ml-2"></div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100">
                      <p className="text-gray-700 font-medium leading-relaxed">
                        <span className="text-pink-500 font-bold mr-1">Q.</span>
                        {quiz.question}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                {(["A", "B", "C"] as QuizChoice[]).map((choice) => {
                  const text =
                    choice === "A"
                      ? quiz.choice_a
                      : choice === "B"
                      ? quiz.choice_b
                      : quiz.choice_c;
                  const isSelected = selectedAnswer === choice;
                  return (
                    <button
                      key={choice}
                      onClick={() => setSelectedAnswer(choice)}
                      className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all transform hover:scale-[1.02] ${
                        isSelected
                          ? "border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-md"
                          : "border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50 bg-white"
                      }`}
                    >
                      <span className="text-xl mr-2">{choiceEmojis[choice]}</span>
                      <span className={`${isSelected ? "text-amber-700 font-medium" : "text-gray-700"}`}>
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer || submitting}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 text-white font-bold rounded-2xl hover:from-yellow-500 hover:via-amber-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎯</span>
                    回答する！
                  </>
                )}
              </button>
            </>
          )}

          {/* 回答済み：結果表示 */}
          {alreadyAnswered && todayResult && (
            <>
              {/* 本日は回答済みメッセージ */}
              <div className="bg-gradient-to-r from-amber-100 to-yellow-100 rounded-2xl p-3 mb-4 border border-amber-200 text-center">
                <p className="text-amber-700 font-bold flex items-center justify-center gap-2">
                  <span>✅</span>
                  本日は回答済だクマ！
                </p>
                <p className="text-amber-600 text-xs mt-1">また明日挑戦してほしいクマ〜</p>
              </div>

              {/* 正誤表示 with メンくま */}
              <div className="flex items-start gap-3 mb-4">
                {/* メンくま教授 */}
                <div className="flex-shrink-0 relative">
                  <div className={`w-20 h-24 relative ${todayResult.isCorrect ? "animate-bounce" : ""}`}>
                    <Image
                      src="/images/menkuma-quiz.png"
                      alt="メンくま教授"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="absolute -top-2 -right-1 text-lg">
                    {todayResult.isCorrect ? "🎓✨" : "🎓"}
                  </span>
                </div>
                {/* 吹き出し */}
                <div className="flex-1 relative">
                  <div className={`absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 -ml-2 ${
                    todayResult.isCorrect ? "border-r-green-50" : "border-r-red-50"
                  }`}></div>
                  <div
                    className={`p-4 rounded-2xl ${
                      todayResult.isCorrect
                        ? "bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200"
                        : "bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200"
                    }`}
                  >
                    {todayResult.isCorrect ? (
                      <div>
                        <p className="text-green-600 font-bold text-lg flex items-center gap-2">
                          <span className="text-2xl">🎉</span>
                          すごい！正解だクマ！
                        </p>
                        <p className="text-green-500 text-sm flex items-center gap-1 mt-1">
                          <Star className="w-4 h-4 fill-current" />
                          +1ポイント獲得したクマ！
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-500 font-bold text-lg">
                          残念...不正解だクマ
                        </p>
                        <p className="text-red-400 text-sm mt-1">
                          正解は「{todayResult.correctAnswer}」だったクマ
                        </p>
                        <p className="text-orange-500 text-xs mt-2">
                          また明日チャレンジするクマ！💪
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 解説 */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-20 flex-shrink-0"></div>
                <div className="flex-1 relative">
                  <div className="absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-blue-50 -ml-2"></div>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                    <p className="text-sm font-bold text-blue-600 mb-2 flex items-center gap-1">
                      <span>💡</span> 解説だクマ
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {todayResult.explanation}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* フッター：ランキング情報 */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-dashed border-yellow-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-lg">🏅</span>
              <span className="font-medium">
                {userStats.rank}位 / {userStats.totalParticipants}人中
              </span>
            </div>
            <button
              onClick={openRanking}
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-all"
            >
              👑 ランキング
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ランキングモーダル */}
      {showRanking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border-2 border-yellow-200">
            <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <span className="text-white font-bold text-lg">
                  {rankingData?.periodLabel || ""} ランキング
                </span>
              </div>
              <button
                onClick={() => setShowRanking(false)}
                className="text-white/80 hover:text-white bg-white/20 rounded-full p-1.5 hover:bg-white/30 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[55vh]">
              {rankingLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
                  <span className="text-amber-500 text-sm">読み込み中だクマ...</span>
                </div>
              ) : rankingData?.rankings.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-5xl block mb-3">🌱</span>
                  <p className="text-gray-500">まだ参加者がいないクマ</p>
                  <p className="text-gray-400 text-sm mt-1">一番乗りを目指すクマ！</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {rankingData?.rankings.map((entry) => {
                    const isMe = entry.rank === rankingData.myRank;
                    const getRankEmoji = (rank: number) => {
                      if (rank === 1) return "🥇";
                      if (rank === 2) return "🥈";
                      if (rank === 3) return "🥉";
                      return `${rank}`;
                    };
                    return (
                      <div
                        key={entry.user_email}
                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                          isMe
                            ? "bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 shadow-md"
                            : "bg-white border border-gray-100 hover:border-yellow-200"
                        }`}
                      >
                        <div className="w-10 text-center">
                          {entry.rank <= 3 ? (
                            <span className="text-2xl">{getRankEmoji(entry.rank)}</span>
                          ) : (
                            <span className="text-gray-500 font-bold">{entry.rank}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isMe ? "text-amber-700" : "text-gray-700"}`}>
                            {entry.user_name}
                            {isMe && <span className="ml-1 text-xs text-amber-500">✨あなた</span>}
                          </p>
                          <p className="text-xs text-gray-400">正解率 {entry.correct_rate}%</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${isMe ? "text-amber-600" : "text-orange-500"}`}>
                            {entry.total_points}
                          </span>
                          <span className="text-xs text-gray-400 ml-0.5">pt</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-4 bg-white/50 border-t-2 border-dashed border-yellow-200 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Users className="w-4 h-4" />
                <span>参加者 {rankingData?.totalParticipants || 0}人</span>
              </div>
              {rankingData?.myRank && (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <span>🎯</span>
                  あなたは {rankingData.myRank}位だクマ！
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
