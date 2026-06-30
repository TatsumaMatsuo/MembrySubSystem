"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { DailyQuizWidget } from "@/components/quiz";
import { TodayScheduleWidget } from "@/components/calendar";
import { Home, Image as ImageIcon, Settings, Link as LinkIcon, User as UserIcon } from "lucide-react";
import Link from "next/link";

interface CustomLink {
  record_id?: string;
  user_id?: string;
  display_name: string;
  url: string;
  icon_url?: string;
  sort_order: number;
  is_active: boolean;
}

const COMMON_USER_ID = "ALL"; // 共通(全ユーザー表示)リンクのユーザーID

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

  // 共通(ALL)と個人(本人専用)に振り分け
  const commonLinks = customLinks.filter((l) => (l.user_id || COMMON_USER_ID) === COMMON_USER_ID);
  const personalLinks = customLinks.filter((l) => l.user_id && l.user_id !== COMMON_USER_ID);

  // リンクボタン群の描画（枠ごとに色をローテーション）
  const renderLinks = (links: CustomLink[]) => (
    <div className="flex flex-wrap gap-3">
      {links.map((link, index) => {
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
            className={`w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 flex items-center justify-center ${!link.icon_url ? bgColor : "bg-white"} shadow-[0_4px_0_0_rgba(0,0,0,0.2),0_6px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.15)] hover:translate-y-[2px] active:shadow-[0_0px_0_0_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.15)] active:translate-y-[4px] border-2 border-gray-300`}
          >
            {link.icon_url ? (
              <img
                src={link.icon_url}
                alt={link.display_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-white drop-shadow-lg" />
            )}
          </a>
        );
      })}
    </div>
  );

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
              <p className="text-sm text-gray-500">MembryMainSystem</p>
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
            {/* 共通リンクボタン（全ユーザー表示） */}
            {!linksLoading && commonLinks.length > 0 && (
              <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-xl shadow-lg p-4">
                <div className="flex items-center gap-1.5 mb-3 text-white/95">
                  <LinkIcon className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wide">共通リンク</span>
                </div>
                {renderLinks(commonLinks)}
              </div>
            )}

            {/* 個人リンクボタン（本人専用。すぐ下に別枠で表示） */}
            {!linksLoading && personalLinks.length > 0 && (
              <div className="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between mb-3 text-white/95">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    <span className="text-xs font-bold tracking-wide">個人リンク</span>
                  </div>
                  <Link href="/settings/top-customize" className="flex items-center gap-1 text-[11px] text-white/90 hover:text-white">
                    <Settings className="w-3.5 h-3.5" /> 編集
                  </Link>
                </div>
                {renderLinks(personalLinks)}
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
