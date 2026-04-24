"use client";

import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  History,
  Settings,
  Calendar,
  LogOut,
  Menu,
  X,
  Search,
  BadgeCheck,
  UserPlus,
  Download,
  BarChart3,
} from "lucide-react";
import { useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    {
      name: "申請一覧",
      href: "/soumu/syaryo/admin/applications",
      icon: FileText,
      color: "text-blue-600",
    },
    {
      name: "代理申請",
      href: "/soumu/syaryo/admin/proxy",
      icon: UserPlus,
      color: "text-cyan-600",
    },
    {
      name: "書類照会",
      href: "/soumu/syaryo/admin/search",
      icon: Search,
      color: "text-emerald-600",
    },
    {
      name: "発行済み許可証",
      href: "/soumu/syaryo/admin/permits",
      icon: BadgeCheck,
      color: "text-teal-600",
    },
    {
      name: "承認履歴",
      href: "/soumu/syaryo/admin/history",
      icon: History,
      color: "text-amber-600",
    },
    {
      name: "分析ダッシュボード",
      href: "/soumu/syaryo/admin/analytics",
      icon: BarChart3,
      color: "text-purple-600",
    },
    {
      name: "エクスポート",
      href: "/soumu/syaryo/admin/export",
      icon: Download,
      color: "text-green-600",
    },
    {
      name: "有効期限監視",
      href: "/soumu/syaryo/admin/monitoring/expiration",
      icon: Calendar,
      color: "text-rose-600",
    },
    {
      name: "システム設定",
      href: "/soumu/syaryo/admin/settings/system",
      icon: Settings,
      color: "text-indigo-600",
    },
    {
      name: "権限設定",
      href: "/soumu/syaryo/admin/settings/permissions",
      icon: Settings,
      color: "text-slate-600",
    },
  ];

  const handleSignOut = async () => {
    const { signOut } = await import("@/lib/syaryo/session-shim");
    await signOut({ callbackUrl: "/auth/signin" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* サイドバー */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* ヘッダー */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-gray-900">管理画面</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* メニュー */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={!sidebarOpen ? item.name : undefined}
              >
                <item.icon className={`w-5 h-5 ${sidebarOpen ? "mr-3" : ""} ${item.color}`} />
                {sidebarOpen && (
                  <span className="font-medium">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ユーザー情報とログアウト */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {sidebarOpen && session?.user && (
            <div className="mb-3 px-4 py-2">
              <p className="text-sm font-medium text-gray-900">
                {session.user.name}
              </p>
              <p className="text-xs text-gray-500">{session.user.email}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={`flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
              !sidebarOpen ? "justify-center" : ""
            }`}
            title={!sidebarOpen ? "ログアウト" : undefined}
          >
            <LogOut className={`w-5 h-5 ${sidebarOpen ? "mr-3" : ""}`} />
            {sidebarOpen && <span className="font-medium">ログアウト</span>}
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
