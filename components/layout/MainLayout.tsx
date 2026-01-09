"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, User, Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ESCキーでメニューを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 認証チェック
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto"></div>
          <p className="mt-4 text-white text-xl font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* グローバルヘッダー */}
      <header className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 shadow-lg z-50">
        <div className="w-full px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* メニュートグル */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* ロゴ */}
              <div className="bg-white/80 rounded-lg p-1.5">
                <Image
                  src="/membry-logo.png"
                  alt="Membry Logo"
                  width={100}
                  height={32}
                  className="h-8 w-auto"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Membry
                </h1>
                <p className="text-xs text-white/70">統合業務システム</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="flex items-center gap-1.5 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                  <User className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">
                    {session.user.name || session.user.email}
                  </span>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* オーバーレイ */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* POPサイドバー */}
        <div
          className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full flex">
            <div className="w-72 bg-white shadow-2xl">
              {/* サイドバーヘッダー */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">M</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-sm">Membry</h2>
                    <p className="text-xs text-white/70">Sub System</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* サイドバーコンテンツ */}
              <Sidebar
                collapsed={false}
                onToggle={() => setSidebarOpen(false)}
                onNavigate={() => setSidebarOpen(false)}
                isPopover
              />
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
