"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Briefcase,
  PenTool,
  Factory,
  ClipboardList,
  Wrench,
  Truck,
  Monitor,
  FileText,
  Settings,
  Building2,
  Database,
  Shield,
  Users,
  BarChart3,
  Upload,
  FileSpreadsheet,
  Cog,
  Link2,
} from "lucide-react";

// 部門メニュー定義
export interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: MenuItem[];
}

export const DEPARTMENT_MENUS: MenuItem[] = [
  {
    id: "common",
    label: "共通",
    icon: <Home className="w-5 h-5 text-indigo-500" />,
    children: [
      {
        id: "baiyaku",
        label: "売約情報",
        icon: <FileText className="w-4 h-4 text-indigo-400" />,
        href: "/",
      },
      {
        id: "data-upload",
        label: "データアップロード",
        icon: <Upload className="w-4 h-4 text-indigo-400" />,
        children: [
          {
            id: "upload-order-backlog",
            label: "受注残情報",
            icon: <FileSpreadsheet className="w-4 h-4 text-indigo-300" />,
            href: "/upload/order-backlog",
          },
        ],
      },
      {
        id: "system-settings",
        label: "システム設定",
        icon: <Cog className="w-4 h-4 text-indigo-400" />,
        children: [
          {
            id: "data-mapping",
            label: "データマッピング",
            icon: <Link2 className="w-4 h-4 text-indigo-300" />,
            href: "/settings/data-mapping",
          },
        ],
      },
    ],
  },
  {
    id: "soumu",
    label: "総務部",
    icon: <Building2 className="w-5 h-5 text-slate-500" />,
    children: [],
  },
  {
    id: "eigyo",
    label: "営業部",
    icon: <Briefcase className="w-5 h-5 text-emerald-500" />,
    children: [
      {
        id: "sales-analysis",
        label: "売上分析",
        icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
        href: "/eigyo/sales-analysis",
      },
    ],
  },
  {
    id: "sekkei",
    label: "設計部",
    icon: <PenTool className="w-5 h-5 text-blue-500" />,
    children: [],
  },
  {
    id: "seizou",
    label: "製造部",
    icon: <Factory className="w-5 h-5 text-orange-500" />,
    children: [],
  },
  {
    id: "seisan",
    label: "生産管理部",
    icon: <ClipboardList className="w-5 h-5 text-purple-500" />,
    children: [],
  },
  {
    id: "koumu",
    label: "工務課",
    icon: <Wrench className="w-5 h-5 text-amber-500" />,
    children: [],
  },
  {
    id: "unyu",
    label: "運輸部",
    icon: <Truck className="w-5 h-5 text-cyan-500" />,
    children: [],
  },
  {
    id: "systemhouse",
    label: "システムハウス",
    icon: <Monitor className="w-5 h-5 text-pink-500" />,
    children: [],
  },
  {
    id: "master",
    label: "マスタ",
    icon: <Database className="w-5 h-5 text-gray-600" />,
    children: [
      {
        id: "permission-settings",
        label: "権限設定",
        icon: <Shield className="w-4 h-4 text-gray-500" />,
        href: "/master/permissions",
      },
      {
        id: "user-management",
        label: "ユーザー管理",
        icon: <Users className="w-4 h-4 text-gray-500" />,
        href: "/master/users",
      },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  isPopover?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  isPopover = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["common"]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    const active = isActive(item.href);

    return (
      <div key={item.id}>
        {item.href && !hasChildren ? (
          <Link
            href={item.href}
            onClick={handleLinkClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              depth > 0 ? "ml-4" : ""
            } ${
              active
                ? "bg-indigo-100 text-indigo-700 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.icon}
            {!collapsed && <span className="text-sm">{item.label}</span>}
          </Link>
        ) : (
          <button
            onClick={() => hasChildren && toggleMenu(item.id)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              depth > 0 ? "ml-4" : ""
            } ${
              hasChildren && isExpanded
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </div>
            {!collapsed && hasChildren && (
              <span className="text-gray-400">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}
          </button>
        )}

        {/* サブメニュー */}
        {hasChildren && isExpanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // POPモードの場合はヘッダーなしでメニューのみ表示
  if (isPopover) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {DEPARTMENT_MENUS.map((menu) => renderMenuItem(menu))}
        </nav>

        {/* フッター */}
        <div className="flex-shrink-0 p-3 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <Settings className="w-5 h-5" />
            <span className="text-sm">設定</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="h-full flex flex-col">
        {/* サイドバーヘッダー */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Membry</h2>
                <p className="text-xs text-gray-500">Sub System</p>
              </div>
            )}
          </div>
        </div>

        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {DEPARTMENT_MENUS.map((menu) => renderMenuItem(menu))}
        </nav>

        {/* フッター */}
        <div className="flex-shrink-0 p-3 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <Settings className="w-5 h-5" />
            {!collapsed && <span className="text-sm">設定</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
