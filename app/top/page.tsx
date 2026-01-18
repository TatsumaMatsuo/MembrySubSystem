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
              <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-xl shadow-lg p-4">
                <div className="flex flex-wrap gap-3">
                  {customLinks.map((link, index) => {
                    const bgColors = [
                      "bg-gradient-to-br from-yellow-300 to-orange-400",
                      "bg-gradient-to-br from-pink-300 to-rose-400",
                      "bg-gradient-to-br from-cyan-300 to-blue-400",
                      "bg-gradient-to-br from-green-300 to-emerald-400",
                      "bg-gradient-to-br from-purple-300 to-indigo-400",
                      "bg-gradient-to-br from-red-300 to-pink-400",
                    ];
                    const bgColor = bgColors[index % bgColors.length];

                    return (
                      <a
                        key={link.record_id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.display_name}
                        className={`w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 flex items-center justify-center ${!link.icon_url ? bgColor : "bg-white"} shadow-[0_4px_0_0_rgba(0,0,0,0.2),0_6px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.15)] hover:translate-y-[2px] active:shadow-[0_0px_0_0_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.15)] active:translate-y-[4px] border-2 border-white/50`}
                      >
                        {link.icon_url ? (
                          <img
                            src={link.icon_url}
                            alt={link.display_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-white drop-shadow-lg" />
                        )}
                      </a>
                    );
                  })}
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
