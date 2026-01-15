"use client";

import { MainLayout } from "@/components/layout";
import { DailyQuizWidget } from "@/components/quiz";
import { TodayScheduleWidget } from "@/components/calendar";
import { Home } from "lucide-react";

export default function TopPage() {
  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Home className="w-6 h-6 text-indigo-500" />
            TOPページ
          </h1>
          <p className="text-sm text-gray-500">Membry Sub System</p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {/* ウィジェットグリッド */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 本日の予定 */}
              <div>
                <TodayScheduleWidget />
              </div>

              {/* クイズウィジェット */}
              <div>
                <DailyQuizWidget />
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
