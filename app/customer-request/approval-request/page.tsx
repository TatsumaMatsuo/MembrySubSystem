"use client";

import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { FileText, ExternalLink } from "lucide-react";

export default function ApprovalRequestPage() {
  const larkAppUrl = "https://applink.larksuite.com/T93e2dHBICa9";

  useEffect(() => {
    window.location.href = larkAppUrl;
  }, []);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-500" />
            稟議申請
          </h1>
          <p className="text-sm text-gray-500">
            共通 &gt; 稟議申請
          </p>
        </div>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
            <p className="text-gray-600 mb-4">Larkアプリへ移動しています...</p>
            <a
              href={larkAppUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              手動で開く
            </a>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
