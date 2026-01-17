"use client";

import { MainLayout } from "@/components/layout/MainLayout";

export default function QualityRequestPage() {
  const larkFormUrl = "https://osvn246ak4c.jp.larksuite.com/share/base/form/shrjp1mHuVuITqtGBZH42QZJbLc";

  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800">品質改善リクエスト</h1>
          <p className="text-sm text-gray-500 mt-1">
            品質に関する問題や改善要望を入力してください
          </p>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
          <iframe
            src={larkFormUrl}
            className="w-full h-full min-h-[800px] border-0"
            title="品質改善リクエストフォーム"
            allow="clipboard-write"
          />
        </div>
      </div>
    </MainLayout>
  );
}
