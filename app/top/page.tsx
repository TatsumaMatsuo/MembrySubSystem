"use client";

import { MainLayout } from "@/components/layout";
import { Home, Construction } from "lucide-react";

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
        <main className="flex-1 flex items-center justify-center px-4 pb-4">
          <div className="text-center">
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Construction className="w-12 h-12 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              TOPページ準備中
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              このページは現在準備中です。
              <br />
              左側のサイドメニューから各機能にアクセスしてください。
            </p>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
