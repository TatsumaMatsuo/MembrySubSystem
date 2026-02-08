"use client";

import { ReactNode } from "react";

interface SekkeiLayoutProps {
  children: ReactNode;
}

/**
 * 設計部ページ用レイアウト
 * 開発中は認証をスキップ
 */
export default function SekkeiLayout({ children }: SekkeiLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* シンプルヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Membry</h1>
                <p className="text-xs text-white/70">設計部メニュー</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <a
                href="/sekkei/kouteikanri"
                className="text-white/80 hover:text-white text-sm transition"
              >
                工程管理
              </a>
              <a
                href="/sekkei/fuka-kanri"
                className="text-white/80 hover:text-white text-sm transition"
              >
                負荷管理
              </a>
              <a
                href="/sekkei/schedule"
                className="text-white/80 hover:text-white text-sm transition"
              >
                スケジュール
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="h-[calc(100vh-60px)]">{children}</main>
    </div>
  );
}
