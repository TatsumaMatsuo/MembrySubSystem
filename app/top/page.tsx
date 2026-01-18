"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { DailyQuizWidget } from "@/components/quiz";
import { TodayScheduleWidget } from "@/components/calendar";
import { Home, ExternalLink, Image as ImageIcon, Settings } from "lucide-react";
import Link from "next/link";

interface CustomLink {
  record_id?: string;
  display_name: string;
  url: string;
  icon_url?: string;
  sort_order: number;
  is_active: boolean;
}

export default function TopPage() {
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  // カスタムリンクを取得
  useEffect(() => {
    const fetchCustomLinks = async () => {
      try {
        const response = await fetch("/api/top-custom-links");
        const data = await response.json();
        if (data.success) {
          // 有効なリンクのみ表示
          setCustomLinks(data.links?.filter((link: CustomLink) => link.is_active) || []);
        }
      } catch (error) {
        console.error("Failed to fetch custom links:", error);
      } finally {
        setLinksLoading(false);
      }
    };

    fetchCustomLinks();
  }, []);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Home className="w-6 h-6 text-indigo-500" />
                TOPページ
              </h1>
              <p className="text-sm text-gray-500">Membry Sub System</p>
            </div>
            <Link
              href="/settings/top-customize"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
              title="TOP画面カスタマイズ"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* カスタムリンクボタン */}
            {!linksLoading && customLinks.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                <div className="flex flex-wrap gap-3">
                  {customLinks.map((link) => (
                    <a
                      key={link.record_id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 rounded-lg border border-indigo-100 transition-all hover:shadow-md group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
                        {link.icon_url ? (
                          <img
                            src={link.icon_url}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              target.parentElement!.innerHTML = '<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>
                      <span className="font-medium text-gray-700 group-hover:text-indigo-700">
                        {link.display_name}
                      </span>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}

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
