"use client";

import { useState, useEffect } from "react";
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
  Loader2,
  LucideIcon,
} from "lucide-react";
import { PermittedMenuStructure, MenuDisplayMaster, FunctionPlacementMaster } from "@/types";

// アイコンマッピング
const ICON_MAP: Record<string, LucideIcon> = {
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
};

// アイコン色マッピング（第1階層用）
const ICON_COLORS: Record<string, string> = {
  Home: "text-indigo-500",
  Briefcase: "text-emerald-500",
  PenTool: "text-blue-500",
  Factory: "text-orange-500",
  ClipboardList: "text-purple-500",
  Wrench: "text-amber-500",
  Truck: "text-cyan-500",
  Monitor: "text-pink-500",
  Building2: "text-slate-500",
  Database: "text-gray-600",
  Upload: "text-teal-500",
  Cog: "text-slate-600",
  Shield: "text-gray-500",
  FileText: "text-indigo-400",
  BarChart3: "text-emerald-400",
  FileSpreadsheet: "text-teal-400",
  Users: "text-gray-500",
  Link2: "text-slate-500",
};

// アイコンを取得
function getIcon(iconName?: string, isChild = false): React.ReactNode {
  const IconComponent = iconName ? ICON_MAP[iconName] : Home;
  if (!IconComponent) return <Home className="w-5 h-5 text-gray-500" />;

  const colorClass = isChild
    ? ICON_COLORS[iconName || ""] || "text-gray-400"
    : ICON_COLORS[iconName || ""] || "text-gray-500";
  const sizeClass = isChild ? "w-4 h-4" : "w-5 h-5";

  return <IconComponent className={`${sizeClass} ${colorClass}`} />;
}

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
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [menuStructure, setMenuStructure] = useState<PermittedMenuStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // メニュー構造を取得
  useEffect(() => {
    fetchMenuStructure();
  }, []);

  const fetchMenuStructure = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/menu-permission");
      const data = await response.json();

      if (data.success && data.data?.menuStructure) {
        setMenuStructure(data.data.menuStructure);
        // 最初のメニューを展開
        if (data.data.menuStructure.length > 0) {
          setExpandedMenus([data.data.menuStructure[0].menu.menu_id]);
        }
      } else {
        setError("メニューの取得に失敗しました");
      }
    } catch (err) {
      console.error("Failed to fetch menu structure:", err);
      setError("メニューの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

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

  // 第1階層メニューをレンダリング
  const renderLevel1Menu = (item: PermittedMenuStructure) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.menu.menu_id);

    return (
      <div key={item.menu.menu_id}>
        <button
          onClick={() => hasChildren && toggleMenu(item.menu.menu_id)}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
            hasChildren && isExpanded
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            {getIcon(item.menu.icon)}
            {!collapsed && (
              <span className="text-sm font-medium">{item.menu.menu_name}</span>
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

        {/* 第2階層メニュー */}
        {hasChildren && isExpanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => renderLevel2Menu(child))}
          </div>
        )}
      </div>
    );
  };

  // 第2階層メニューをレンダリング
  const renderLevel2Menu = (child: { menu: MenuDisplayMaster; programs: FunctionPlacementMaster[] }) => {
    const hasPrograms = child.programs && child.programs.length > 0;

    // プログラムが1つだけの場合は直接リンク
    if (hasPrograms && child.programs.length === 1) {
      const program = child.programs[0];
      const active = isActive(program.url_path);
      return (
        <Link
          key={child.menu.menu_id}
          href={program.url_path}
          onClick={handleLinkClick}
          className={`flex items-center gap-3 px-3 py-2.5 ml-4 rounded-lg transition-all duration-200 ${
            active
              ? "bg-indigo-100 text-indigo-700 font-semibold"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {getIcon(child.menu.icon, true)}
          <span className="text-sm">{child.menu.menu_name}</span>
        </Link>
      );
    }

    // プログラムが複数ある場合は展開可能
    if (hasPrograms) {
      const isExpanded = expandedMenus.includes(child.menu.menu_id);
      return (
        <div key={child.menu.menu_id}>
          <button
            onClick={() => toggleMenu(child.menu.menu_id)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 ml-4 rounded-lg transition-all duration-200 ${
              isExpanded ? "bg-gray-50 text-gray-900" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              {getIcon(child.menu.icon, true)}
              <span className="text-sm">{child.menu.menu_name}</span>
            </div>
            <span className="text-gray-400">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          </button>

          {/* プログラム一覧 */}
          {isExpanded && (
            <div className="mt-1 space-y-1">
              {child.programs.map((program) => {
                const active = isActive(program.url_path);
                return (
                  <Link
                    key={program.program_id}
                    href={program.url_path}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-3 px-3 py-2 ml-8 rounded-lg transition-all duration-200 ${
                      active
                        ? "bg-indigo-100 text-indigo-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm">{program.program_name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ローディング表示
  const renderLoading = () => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  // エラー表示
  const renderError = () => (
    <div className="px-3 py-4 text-center">
      <p className="text-sm text-red-500">{error}</p>
      <button
        onClick={fetchMenuStructure}
        className="mt-2 text-xs text-indigo-600 hover:underline"
      >
        再読み込み
      </button>
    </div>
  );

  // POPモードの場合はヘッダーなしでメニューのみ表示
  if (isPopover) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading && renderLoading()}
          {error && renderError()}
          {!loading && !error && menuStructure.map((menu) => renderLevel1Menu(menu))}
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
          {loading && renderLoading()}
          {error && renderError()}
          {!loading && !error && menuStructure.map((menu) => renderLevel1Menu(menu))}
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
