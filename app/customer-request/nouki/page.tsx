"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { Calendar } from "lucide-react";

export default function NoukiChangePage() {
  const larkFormUrl = "https://osvn246ak4c.jp.larksuite.com/share/base/form/shrjpvlXRuuKEB3dijL6ht3MvNe";

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            納期変更
          </h1>
          <p className="text-sm text-gray-500">
            顧客要求事項変更届 &gt; 納期変更
          </p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden h-full">
            <iframe
              src={larkFormUrl}
              className="w-full h-full min-h-[800px] border-0"
              title="納期変更フォーム"
              allow="clipboard-write"
            />
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
