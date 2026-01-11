"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Menu,
  Layers,
  Users,
  User,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  ChevronRight,
  ChevronDown,
  // アイコン選択用
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
  Shield,
  BarChart3,
  Upload,
  FileSpreadsheet,
  Cog,
  Link2,
  LucideIcon,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

type TabType = "menu" | "program" | "group" | "user";

// 利用可能なアイコン一覧
const AVAILABLE_ICONS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: "Home", icon: Home, label: "ホーム" },
  { name: "Briefcase", icon: Briefcase, label: "ブリーフケース" },
  { name: "PenTool", icon: PenTool, label: "ペンツール" },
  { name: "Factory", icon: Factory, label: "工場" },
  { name: "ClipboardList", icon: ClipboardList, label: "リスト" },
  { name: "Wrench", icon: Wrench, label: "レンチ" },
  { name: "Truck", icon: Truck, label: "トラック" },
  { name: "Monitor", icon: Monitor, label: "モニター" },
  { name: "FileText", icon: FileText, label: "ファイル" },
  { name: "Settings", icon: Settings, label: "設定" },
  { name: "Building2", icon: Building2, label: "ビル" },
  { name: "Database", icon: Database, label: "データベース" },
  { name: "Shield", icon: Shield, label: "シールド" },
  { name: "Users", icon: Users, label: "ユーザー" },
  { name: "BarChart3", icon: BarChart3, label: "チャート" },
  { name: "Upload", icon: Upload, label: "アップロード" },
  { name: "FileSpreadsheet", icon: FileSpreadsheet, label: "スプレッドシート" },
  { name: "Cog", icon: Cog, label: "歯車" },
  { name: "Link2", icon: Link2, label: "リンク" },
  { name: "Menu", icon: Menu, label: "メニュー" },
  { name: "Layers", icon: Layers, label: "レイヤー" },
];

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "icon";
  required?: boolean;
  options?: { value: string; label: string }[];
  sortable?: boolean;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

// デフォルトソート設定
const DEFAULT_SORT: Record<TabType, SortConfig[]> = {
  menu: [
    { key: "階層レベル", direction: "asc" },
    { key: "表示順", direction: "asc" },
  ],
  program: [{ key: "表示順", direction: "asc" }],
  group: [{ key: "グループID", direction: "asc" }],
  user: [{ key: "社員ID", direction: "asc" }],
};

// アイコン選択コンポーネント
const IconPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIcon = AVAILABLE_ICONS.find((i) => i.name === value);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {selectedIcon ? (
          <>
            <selectedIcon.icon className="w-4 h-4 text-gray-600" />
            <span>{selectedIcon.label}</span>
            <span className="text-gray-400 text-xs ml-auto">{selectedIcon.name}</span>
          </>
        ) : (
          <span className="text-gray-400">アイコンを選択...</span>
        )}
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1 p-2">
            {AVAILABLE_ICONS.map((iconItem) => {
              const IconComponent = iconItem.icon;
              return (
                <button
                  key={iconItem.name}
                  type="button"
                  onClick={() => {
                    onChange(iconItem.name);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded hover:bg-indigo-50 transition-colors ${
                    value === iconItem.name ? "bg-indigo-100 ring-2 ring-indigo-500" : ""
                  }`}
                  title={iconItem.label}
                >
                  <IconComponent className="w-5 h-5 text-gray-600" />
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {iconItem.label}
                  </span>
                </button>
              );
            })}
          </div>
          {value && (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="w-full text-sm text-red-600 hover:bg-red-50 py-1 rounded"
              >
                クリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// フィールド入力コンポーネント（外部定義で再レンダリング防止）
const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: any;
  onChange: (value: any) => void;
}) => {
  switch (field.type) {
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      );
    case "select":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">選択してください</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "icon":
      return <IconPicker value={value || ""} onChange={onChange} />;
    default:
      return (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      );
  }
};

// グループ権限マトリックスコンポーネント
interface GroupInfo {
  id: string;
  name: string;
}

interface MenuWithPrograms {
  menu: any;
  programs: any[];
}

interface LarkDepartment {
  id: string;
  name: string;
  parent_id?: string;
  member_count?: number;
  has_child?: boolean;
}

const GroupPermissionMatrix = ({
  menus,
  programs,
  groupPermissions,
  onPermissionChange,
  onAddGroup,
  onRemoveGroup,
  saving,
}: {
  menus: any[];
  programs: any[];
  groupPermissions: any[];
  onPermissionChange: (groupId: string, targetType: "menu" | "program", targetId: string, isAllowed: boolean) => void;
  onAddGroup: (groupId: string, groupName: string) => void;
  onRemoveGroup: (groupId: string) => void;
  saving: boolean;
}) => {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [larkDepartments, setLarkDepartments] = useState<LarkDepartment[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"lark" | "manual">("lark");

  // グループ一覧を取得（重複排除）
  const groups: GroupInfo[] = Array.from(
    new Map(
      groupPermissions.map((p) => [
        p.fields?.["グループID"],
        { id: p.fields?.["グループID"], name: p.fields?.["グループ名"] || p.fields?.["グループID"] },
      ])
    ).values()
  ).filter((g) => g.id);

  // メニュー階層を構築
  const menuHierarchy: MenuWithPrograms[] = menus
    .filter((m) => m.fields?.["階層レベル"] === 1 || m.fields?.["階層レベル"] === "1")
    .sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0))
    .map((menu) => {
      const menuId = menu.fields?.["メニューID"];
      const childMenus = menus
        .filter((m) => m.fields?.["親メニューID"] === menuId)
        .sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0));

      const menuPrograms = programs.filter((p) => {
        const placementId = p.fields?.["配置メニューID"];
        return placementId === menuId || childMenus.some((cm) => cm.fields?.["メニューID"] === placementId);
      }).sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0));

      return { menu, programs: menuPrograms };
    });

  // 権限チェック
  const hasPermission = (groupId: string, targetType: "menu" | "program", targetId: string): boolean => {
    const permission = groupPermissions.find(
      (p) =>
        p.fields?.["グループID"] === groupId &&
        p.fields?.["対象種別"] === targetType &&
        p.fields?.["対象ID"] === targetId
    );
    return permission?.fields?.["許可フラグ"] === true;
  };

  // メニュー展開/折りたたみ
  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  // 全展開
  const expandAll = () => {
    setExpandedMenus(new Set(menus.map((m) => m.fields?.["メニューID"])));
  };

  // 全折りたたみ
  const collapseAll = () => {
    setExpandedMenus(new Set());
  };

  // Lark部門を取得
  const fetchLarkDepartments = async () => {
    setLoadingDepartments(true);
    setDepartmentError(null);
    try {
      const response = await fetch("/api/lark/groups?type=departments");
      const data = await response.json();
      if (data.success) {
        setLarkDepartments(data.data || []);
        if (data.data?.length === 0) {
          setDepartmentError("部門が見つかりません。Lark管理コンソールで権限設定を確認してください。");
        }
      } else {
        setDepartmentError(data.error || "部門の取得に失敗しました");
        console.error("Failed to fetch Lark departments:", data);
      }
    } catch (err) {
      setDepartmentError("APIエラー: " + String(err));
      console.error("Error fetching Lark departments:", err);
    } finally {
      setLoadingDepartments(false);
    }
  };

  // モーダル表示時にLark部門を取得
  const handleOpenAddGroup = () => {
    setShowAddGroup(true);
    if (larkDepartments.length === 0) {
      fetchLarkDepartments();
    }
  };

  // グループ追加
  const handleAddGroup = () => {
    if (newGroupId.trim()) {
      onAddGroup(newGroupId.trim(), newGroupName.trim() || newGroupId.trim());
      setNewGroupId("");
      setNewGroupName("");
      setShowAddGroup(false);
    }
  };

  // Lark部門からグループ追加
  const handleAddFromLark = (dept: LarkDepartment) => {
    onAddGroup(dept.id, dept.name);
    setShowAddGroup(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50"
          >
            全展開
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50"
          >
            全折りたたみ
          </button>
        </div>
        <button
          onClick={handleOpenAddGroup}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          グループ追加
        </button>
      </div>

      {/* マトリックステーブル */}
      <div className="flex-1 overflow-auto border rounded-lg bg-white">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="sticky left-0 bg-gray-50 border-b border-r px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[300px] z-20">
                機能
              </th>
              {groups.map((group) => (
                <th
                  key={group.id}
                  className="border-b border-r px-3 py-2 text-center text-sm font-semibold text-gray-700 min-w-[100px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[90px]" title={group.name}>
                      {group.name}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`「${group.name}」を削除しますか？`)) {
                          onRemoveGroup(group.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                      title="グループ削除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              {groups.length === 0 && (
                <th className="border-b border-r px-4 py-3 text-center text-sm text-gray-400">
                  グループを追加してください
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {menuHierarchy.map(({ menu, programs: menuPrograms }) => {
              const menuId = menu.fields?.["メニューID"];
              const menuName = menu.fields?.["メニュー名"];
              const isExpanded = expandedMenus.has(menuId);
              const hasChildren = menuPrograms.length > 0;

              return (
                <React.Fragment key={menuId}>
                  {/* メニュー行 */}
                  <tr className="bg-gray-100 hover:bg-gray-200">
                    <td className="sticky left-0 bg-gray-100 border-b border-r px-4 py-2 z-10">
                      <div className="flex items-center gap-2">
                        {hasChildren ? (
                          <button
                            onClick={() => toggleMenu(menuId)}
                            className="p-0.5 hover:bg-gray-300 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <span className="font-medium text-gray-800">{menuName}</span>
                        <span className="text-xs text-gray-400">({menuId})</span>
                      </div>
                    </td>
                    {groups.map((group) => (
                      <td
                        key={group.id}
                        className="border-b border-r px-3 py-2 text-center bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={hasPermission(group.id, "menu", menuId)}
                          onChange={(e) => onPermissionChange(group.id, "menu", menuId, e.target.checked)}
                          disabled={saving}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    ))}
                    {groups.length === 0 && <td className="border-b border-r" />}
                  </tr>
                  {/* プログラム行 */}
                  {isExpanded &&
                    menuPrograms.map((program) => {
                      const programId = program.fields?.["プログラムID"];
                      const programName = program.fields?.["プログラム名称"];
                      return (
                        <tr key={programId} className="hover:bg-blue-50">
                          <td className="sticky left-0 bg-white border-b border-r px-4 py-2 z-10">
                            <div className="flex items-center gap-2 pl-8">
                              <span className="text-sm text-gray-600">{programName}</span>
                              <span className="text-xs text-gray-400">({programId})</span>
                            </div>
                          </td>
                          {groups.map((group) => (
                            <td
                              key={group.id}
                              className="border-b border-r px-3 py-2 text-center"
                            >
                              <input
                                type="checkbox"
                                checked={hasPermission(group.id, "program", programId)}
                                onChange={(e) =>
                                  onPermissionChange(group.id, "program", programId, e.target.checked)
                                }
                                disabled={saving}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                          ))}
                          {groups.length === 0 && <td className="border-b border-r" />}
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* グループ追加モーダル */}
      {showAddGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">グループ追加</h3>
              <button
                onClick={() => setShowAddGroup(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* タブ切り替え */}
            <div className="flex border-b flex-shrink-0">
              <button
                onClick={() => setInputMode("lark")}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  inputMode === "lark"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Lark部門から選択
              </button>
              <button
                onClick={() => setInputMode("manual")}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  inputMode === "manual"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                手動入力
              </button>
            </div>

            {inputMode === "lark" ? (
              /* Lark部門選択 */
              <div className="flex-1 overflow-auto p-4">
                {loadingDepartments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <span className="ml-2 text-gray-500">部門を取得中...</span>
                  </div>
                ) : departmentError ? (
                  <div className="text-center py-6">
                    <p className="text-red-600 mb-3 text-sm">{departmentError}</p>
                    <div className="text-xs text-gray-500 mb-4 text-left bg-gray-50 p-3 rounded">
                      <p className="font-medium mb-1">必要な権限（いずれか1つ）:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>contact:contact.base:readonly</li>
                        <li>contact:department.organize:readonly</li>
                        <li>contact:contact:readonly</li>
                      </ul>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={fetchLarkDepartments}
                        className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded text-sm"
                      >
                        再取得
                      </button>
                      <button
                        onClick={() => setInputMode("manual")}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
                      >
                        手動入力へ
                      </button>
                    </div>
                  </div>
                ) : larkDepartments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>部門が見つかりません</p>
                    <button
                      onClick={fetchLarkDepartments}
                      className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                      再取得
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {larkDepartments.map((dept) => {
                      const isAdded = groups.some((g) => g.id === dept.id);
                      return (
                        <div
                          key={dept.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isAdded ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:border-indigo-300"
                          }`}
                        >
                          <div>
                            <div className="font-medium text-gray-800">{dept.name}</div>
                            <div className="text-xs text-gray-400">{dept.id}</div>
                          </div>
                          {isAdded ? (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                              追加済み
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddFromLark(dept)}
                              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              追加
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* 手動入力 */
              <>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      グループID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newGroupId}
                      onChange={(e) => setNewGroupId(e.target.value)}
                      placeholder="例: G001"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      グループ名
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="例: 営業部"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                  <button
                    onClick={() => setShowAddGroup(false)}
                    className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddGroup}
                    disabled={!newGroupId.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    追加
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 個別権限マトリックスコンポーネント
interface UserInfo {
  id: string;
  name: string;
}

interface EmployeeSearchResult {
  社員コード: string;
  社員名: string;
  メールアドレス?: string;
  部署?: string;
}

const UserPermissionMatrix = ({
  menus,
  programs,
  userPermissions,
  onPermissionChange,
  onAddUser,
  onRemoveUser,
  saving,
}: {
  menus: any[];
  programs: any[];
  userPermissions: any[];
  onPermissionChange: (userId: string, targetType: "menu" | "program", targetId: string, isAllowed: boolean) => void;
  onAddUser: (userId: string, userName: string) => void;
  onRemoveUser: (userId: string) => void;
  saving: boolean;
}) => {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [inputMode, setInputMode] = useState<"search" | "manual">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmployeeSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ユーザー一覧を取得（重複排除）
  const users: UserInfo[] = Array.from(
    new Map(
      userPermissions.map((p) => [
        p.fields?.["社員ID"],
        { id: p.fields?.["社員ID"], name: p.fields?.["社員名"] || p.fields?.["社員ID"] },
      ])
    ).values()
  ).filter((u) => u.id);

  // メニュー階層を構築
  const menuHierarchy: MenuWithPrograms[] = menus
    .filter((m) => m.fields?.["階層レベル"] === 1 || m.fields?.["階層レベル"] === "1")
    .sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0))
    .map((menu) => {
      const menuId = menu.fields?.["メニューID"];
      const childMenus = menus
        .filter((m) => m.fields?.["親メニューID"] === menuId)
        .sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0));

      const menuPrograms = programs.filter((p) => {
        const placementId = p.fields?.["配置メニューID"];
        return placementId === menuId || childMenus.some((cm) => cm.fields?.["メニューID"] === placementId);
      }).sort((a, b) => (Number(a.fields?.["表示順"]) || 0) - (Number(b.fields?.["表示順"]) || 0));

      return { menu, programs: menuPrograms };
    });

  // 権限チェック
  const hasPermission = (userId: string, targetType: "menu" | "program", targetId: string): boolean => {
    const permission = userPermissions.find(
      (p) =>
        p.fields?.["社員ID"] === userId &&
        p.fields?.["対象種別"] === targetType &&
        p.fields?.["対象ID"] === targetId
    );
    return permission?.fields?.["許可フラグ"] === true;
  };

  // メニュー展開/折りたたみ
  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  // 全展開
  const expandAll = () => {
    setExpandedMenus(new Set(menus.map((m) => m.fields?.["メニューID"])));
  };

  // 全折りたたみ
  const collapseAll = () => {
    setExpandedMenus(new Set());
  };

  // 社員検索
  const searchEmployees = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    setSearchError(null);
    try {
      const response = await fetch(`/api/master/employees?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data || []);
      } else {
        setSearchError(data.error || "検索に失敗しました");
      }
    } catch (err) {
      setSearchError("検索に失敗しました");
      console.error("Employee search error:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  // 検索クエリの変更をデバウンス
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchEmployees(query);
    }, 300);
  };

  // モーダルを開く
  const handleOpenAddUser = () => {
    setShowAddUser(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setNewUserId("");
    setNewUserName("");
    setInputMode("search");
  };

  // 検索結果から選択
  const handleSelectEmployee = (employee: EmployeeSearchResult) => {
    onAddUser(employee.社員コード, employee.社員名);
    setShowAddUser(false);
  };

  // ユーザー追加（手動入力）
  const handleAddUser = () => {
    if (newUserId.trim()) {
      onAddUser(newUserId.trim(), newUserName.trim() || newUserId.trim());
      setNewUserId("");
      setNewUserName("");
      setShowAddUser(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50"
          >
            全展開
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50"
          >
            全折りたたみ
          </button>
        </div>
        <button
          onClick={handleOpenAddUser}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          ユーザー追加
        </button>
      </div>

      {/* マトリックステーブル */}
      <div className="flex-1 overflow-auto border rounded-lg bg-white">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="sticky left-0 bg-gray-50 border-b border-r px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[300px] z-20">
                機能
              </th>
              {users.map((user) => (
                <th
                  key={user.id}
                  className="border-b border-r px-3 py-2 text-center text-sm font-semibold text-gray-700 min-w-[100px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[90px]" title={user.name}>
                      {user.name}
                    </span>
                    <span className="text-xs text-gray-400">{user.id}</span>
                    <button
                      onClick={() => {
                        if (confirm(`「${user.name}」を削除しますか？`)) {
                          onRemoveUser(user.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                      title="ユーザー削除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              {users.length === 0 && (
                <th className="border-b border-r px-4 py-3 text-center text-sm text-gray-400">
                  ユーザーを追加してください
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {menuHierarchy.map(({ menu, programs: menuPrograms }) => {
              const menuId = menu.fields?.["メニューID"];
              const menuName = menu.fields?.["メニュー名"];
              const isExpanded = expandedMenus.has(menuId);
              const hasChildren = menuPrograms.length > 0;

              return (
                <React.Fragment key={menuId}>
                  {/* メニュー行 */}
                  <tr className="bg-gray-100 hover:bg-gray-200">
                    <td className="sticky left-0 bg-gray-100 border-b border-r px-4 py-2 z-10">
                      <div className="flex items-center gap-2">
                        {hasChildren ? (
                          <button
                            onClick={() => toggleMenu(menuId)}
                            className="p-0.5 hover:bg-gray-300 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <span className="font-medium text-gray-800">{menuName}</span>
                        <span className="text-xs text-gray-400">({menuId})</span>
                      </div>
                    </td>
                    {users.map((user) => (
                      <td
                        key={user.id}
                        className="border-b border-r px-3 py-2 text-center bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={hasPermission(user.id, "menu", menuId)}
                          onChange={(e) => onPermissionChange(user.id, "menu", menuId, e.target.checked)}
                          disabled={saving}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    ))}
                    {users.length === 0 && <td className="border-b border-r" />}
                  </tr>
                  {/* プログラム行 */}
                  {isExpanded &&
                    menuPrograms.map((program) => {
                      const programId = program.fields?.["プログラムID"];
                      const programName = program.fields?.["プログラム名称"];
                      return (
                        <tr key={programId} className="hover:bg-blue-50">
                          <td className="sticky left-0 bg-white border-b border-r px-4 py-2 z-10">
                            <div className="flex items-center gap-2 pl-8">
                              <span className="text-sm text-gray-600">{programName}</span>
                              <span className="text-xs text-gray-400">({programId})</span>
                            </div>
                          </td>
                          {users.map((user) => (
                            <td
                              key={user.id}
                              className="border-b border-r px-3 py-2 text-center"
                            >
                              <input
                                type="checkbox"
                                checked={hasPermission(user.id, "program", programId)}
                                onChange={(e) =>
                                  onPermissionChange(user.id, "program", programId, e.target.checked)
                                }
                                disabled={saving}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                          ))}
                          {users.length === 0 && <td className="border-b border-r" />}
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ユーザー追加モーダル */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">ユーザー追加</h3>
              <button
                onClick={() => setShowAddUser(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* タブ切り替え */}
            <div className="flex border-b flex-shrink-0">
              <button
                onClick={() => setInputMode("search")}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  inputMode === "search"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                社員マスタから検索
              </button>
              <button
                onClick={() => setInputMode("manual")}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  inputMode === "manual"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                手動入力
              </button>
            </div>

            {inputMode === "search" ? (
              /* 社員検索 */
              <div className="flex-1 overflow-auto p-4">
                {/* 検索ボックス */}
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchQueryChange(e.target.value)}
                    placeholder="社員ID、名前、メールアドレスで検索..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                {loadingSearch ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <span className="ml-2 text-gray-500">検索中...</span>
                  </div>
                ) : searchError ? (
                  <div className="text-center py-6">
                    <p className="text-red-600 mb-3 text-sm">{searchError}</p>
                    <button
                      onClick={() => setInputMode("manual")}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
                    >
                      手動入力へ
                    </button>
                  </div>
                ) : searchQuery && searchResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>「{searchQuery}」に一致する社員が見つかりません</p>
                    <button
                      onClick={() => setInputMode("manual")}
                      className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                      手動入力する
                    </button>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((employee) => {
                      const isAdded = users.some((u) => u.id === employee.社員コード);
                      return (
                        <div
                          key={employee.社員コード}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isAdded ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:border-indigo-300"
                          }`}
                        >
                          <div>
                            <div className="font-medium text-gray-800">{employee.社員名}</div>
                            <div className="text-xs text-gray-400 space-x-2">
                              <span>{employee.社員コード}</span>
                              {employee.部署 && <span>/ {employee.部署}</span>}
                            </div>
                            {employee.メールアドレス && (
                              <div className="text-xs text-gray-400">{employee.メールアドレス}</div>
                            )}
                          </div>
                          {isAdded ? (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                              追加済み
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSelectEmployee(employee)}
                              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              追加
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>社員ID、名前、またはメールアドレスで検索してください</p>
                  </div>
                )}
              </div>
            ) : (
              /* 手動入力 */
              <>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      社員ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="例: 000001"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      社員名
                    </label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="例: 山口 太郎"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                  <button
                    onClick={() => setShowAddUser(false)}
                    className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUserId.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    追加
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TABS: TabConfig[] = [
  {
    id: "menu",
    label: "メニュー表示マスタ",
    icon: <Menu className="w-4 h-4" />,
    fields: [
      { key: "メニューID", label: "メニューID", type: "text", required: true, sortable: true },
      { key: "メニュー名", label: "メニュー名", type: "text", required: true, sortable: true },
      { key: "階層レベル", label: "階層レベル", type: "number", required: true, sortable: true },
      { key: "親メニューID", label: "親メニューID", type: "text", sortable: true },
      { key: "表示順", label: "表示順", type: "number", sortable: true },
      { key: "アイコン", label: "アイコン", type: "icon", sortable: true },
      { key: "有効フラグ", label: "有効", type: "boolean", sortable: true },
    ],
  },
  {
    id: "program",
    label: "機能配置マスタ",
    icon: <Layers className="w-4 h-4" />,
    fields: [
      { key: "プログラムID", label: "プログラムID", type: "text", required: true, sortable: true },
      { key: "プログラム名称", label: "プログラム名称", type: "text", required: true, sortable: true },
      { key: "配置メニューID", label: "配置メニューID", type: "text", required: true, sortable: true },
      { key: "URLパス", label: "URLパス", type: "text", required: true, sortable: true },
      { key: "表示順", label: "表示順", type: "number", sortable: true },
      { key: "説明", label: "説明", type: "text" },
      { key: "有効フラグ", label: "有効", type: "boolean", sortable: true },
    ],
  },
  {
    id: "group",
    label: "グループ権限マスタ",
    icon: <Users className="w-4 h-4" />,
    fields: [
      { key: "グループID", label: "グループID", type: "text", required: true, sortable: true },
      { key: "グループ名", label: "グループ名", type: "text", sortable: true },
      { key: "対象種別", label: "対象種別", type: "select", sortable: true, options: [
        { value: "menu", label: "メニュー" },
        { value: "program", label: "プログラム" },
      ]},
      { key: "対象ID", label: "対象ID", type: "text", required: true, sortable: true },
      { key: "許可フラグ", label: "許可", type: "boolean", sortable: true },
    ],
  },
  {
    id: "user",
    label: "個別権限マスタ",
    icon: <User className="w-4 h-4" />,
    fields: [
      { key: "社員ID", label: "社員ID", type: "text", required: true, sortable: true },
      { key: "社員名", label: "社員名", type: "text", sortable: true },
      { key: "対象種別", label: "対象種別", type: "select", sortable: true, options: [
        { value: "menu", label: "メニュー" },
        { value: "program", label: "プログラム" },
      ]},
      { key: "対象ID", label: "対象ID", type: "text", required: true, sortable: true },
      { key: "許可フラグ", label: "許可", type: "boolean", sortable: true },
    ],
  },
];

export default function MenuPermissionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [data, setData] = useState<Record<string, any[]>>({
    menu: [],
    program: [],
    group: [],
    user: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, any>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // データ取得
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/master/menu-permissions");
      const result = await response.json();

      if (result.success) {
        setData({
          menu: result.data.menus || [],
          program: result.data.programs || [],
          group: result.data.groups || [],
          user: result.data.users || [],
        });
      } else {
        setError(result.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError("データの取得に失敗しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // タブ切り替え時にソートをリセット
  useEffect(() => {
    setSortConfig(null);
  }, [activeTab]);

  // 現在のタブ設定を取得
  const currentTab = TABS.find((t) => t.id === activeTab)!;

  // ソート処理
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        // 同じキーの場合は方向を切り替え
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // 新しいキーの場合は昇順でソート
      return { key, direction: "asc" };
    });
  };

  // ソートアイコンを取得
  const getSortIcon = (key: string) => {
    if (sortConfig?.key === key) {
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      );
    }
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  };

  // 数値フィールドのキー一覧
  const numericFields = new Set(
    currentTab.fields.filter((f) => f.type === "number").map((f) => f.key)
  );

  // データのソート
  const sortedData = (() => {
    const rawData = data[activeTab] || [];
    if (rawData.length === 0) return rawData;

    // ソート設定を決定（カスタムソートまたはデフォルトソート）
    const sortKeys = sortConfig
      ? [sortConfig]
      : DEFAULT_SORT[activeTab] || [];

    if (sortKeys.length === 0) return rawData;

    return [...rawData].sort((a, b) => {
      for (const { key, direction } of sortKeys) {
        const aRaw = a.fields?.[key] ?? "";
        const bRaw = b.fields?.[key] ?? "";

        let comparison = 0;

        // 数値フィールドは数値として比較
        if (numericFields.has(key)) {
          const aNum = Number(aRaw) || 0;
          const bNum = Number(bRaw) || 0;
          comparison = aNum - bNum;
        } else if (typeof aRaw === "boolean" && typeof bRaw === "boolean") {
          comparison = aRaw === bRaw ? 0 : aRaw ? -1 : 1;
        } else {
          comparison = String(aRaw).localeCompare(String(bRaw), "ja");
        }

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  })();

  const currentData = sortedData;

  // フィールド値を取得
  const getFieldValue = (record: any, key: string) => {
    return record.fields?.[key] ?? "";
  };

  // 新規レコード追加
  const handleAdd = async () => {
    const requiredFields = currentTab.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !newRecord[f.key]);

    if (missingFields.length > 0) {
      alert(`必須項目が入力されていません: ${missingFields.map((f) => f.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      // 数値フィールドを変換
      const convertedRecord: Record<string, any> = {};
      currentTab.fields.forEach((field) => {
        const value = newRecord[field.key];
        if (value === undefined || value === "") return;
        if (field.type === "number") {
          convertedRecord[field.key] = Number(value) || 0;
        } else if (field.type === "boolean") {
          convertedRecord[field.key] = value === true || value === "true";
        } else {
          convertedRecord[field.key] = value;
        }
      });

      const response = await fetch("/api/master/menu-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          fields: convertedRecord,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchData();
        setShowAddForm(false);
        setNewRecord({});
      } else {
        alert(result.error || "追加に失敗しました");
      }
    } catch (err) {
      alert("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // フィールド値を型変換
  const convertFieldTypes = (data: Record<string, any>) => {
    const converted: Record<string, any> = {};
    currentTab.fields.forEach((field) => {
      const value = data[field.key];
      if (value === undefined || value === "") {
        // 空の値はスキップ（Lark APIが空文字を受け付けない場合がある）
        return;
      }
      if (field.type === "number") {
        converted[field.key] = Number(value) || 0;
      } else if (field.type === "boolean") {
        converted[field.key] = value === true || value === "true";
      } else {
        converted[field.key] = value;
      }
    });
    return converted;
  };

  // レコード更新
  const handleUpdate = async (recordId: string) => {
    setSaving(true);
    try {
      const convertedData = convertFieldTypes(editingData);
      const response = await fetch("/api/master/menu-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          record_id: recordId,
          fields: convertedData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchData();
        setEditingId(null);
        setEditingData({});
      } else {
        alert(result.error || "更新に失敗しました");
      }
    } catch (err) {
      alert("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // レコード削除
  const handleDelete = async (recordId: string) => {
    if (!confirm("このレコードを削除しますか？")) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/master/menu-permissions?type=${activeTab}&record_id=${recordId}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        await fetchData();
      } else {
        alert(result.error || "削除に失敗しました");
      }
    } catch (err) {
      alert("削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 編集開始
  const startEdit = (record: any) => {
    setEditingId(record.record_id);
    const data: Record<string, any> = {};
    currentTab.fields.forEach((field) => {
      data[field.key] = getFieldValue(record, field.key);
    });
    setEditingData(data);
  };

  // グループ権限の変更（マトリックス用）
  const handlePermissionChange = async (
    groupId: string,
    targetType: "menu" | "program",
    targetId: string,
    isAllowed: boolean
  ) => {
    setSaving(true);
    try {
      // 既存レコードを検索
      const existingRecord = data.group.find(
        (p: any) =>
          p.fields?.["グループID"] === groupId &&
          p.fields?.["対象種別"] === targetType &&
          p.fields?.["対象ID"] === targetId
      );

      if (existingRecord) {
        // 既存レコードを更新
        const response = await fetch("/api/master/menu-permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "group",
            record_id: existingRecord.record_id,
            fields: { "許可フラグ": isAllowed },
          }),
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.error || "更新に失敗しました");
        }
      } else {
        // 新規レコードを作成
        const groupRecord = data.group.find((p: any) => p.fields?.["グループID"] === groupId);
        const groupName = groupRecord?.fields?.["グループ名"] || groupId;

        const response = await fetch("/api/master/menu-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "group",
            fields: {
              "グループID": groupId,
              "グループ名": groupName,
              "対象種別": targetType,
              "対象ID": targetId,
              "許可フラグ": isAllowed,
            },
          }),
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.error || "作成に失敗しました");
        }
      }
      await fetchData();
    } catch (err) {
      alert("権限の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // グループ追加（マトリックス用）
  const handleAddGroup = async (groupId: string, groupName: string) => {
    setSaving(true);
    try {
      // 最初のメニューに対するダミーレコードを作成してグループを追加
      const firstMenu = data.menu[0];
      if (firstMenu) {
        const response = await fetch("/api/master/menu-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "group",
            fields: {
              "グループID": groupId,
              "グループ名": groupName,
              "対象種別": "menu",
              "対象ID": firstMenu.fields?.["メニューID"] || "M001",
              "許可フラグ": false,
            },
          }),
        });
        const result = await response.json();
        if (result.success) {
          await fetchData();
        } else {
          alert(result.error || "グループの追加に失敗しました");
        }
      }
    } catch (err) {
      alert("グループの追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // グループ削除（マトリックス用 - そのグループの全レコードを削除）
  const handleRemoveGroup = async (groupId: string) => {
    setSaving(true);
    try {
      const groupRecords = data.group.filter((p: any) => p.fields?.["グループID"] === groupId);
      for (const record of groupRecords) {
        await fetch(
          `/api/master/menu-permissions?type=group&record_id=${record.record_id}`,
          { method: "DELETE" }
        );
      }
      await fetchData();
    } catch (err) {
      alert("グループの削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 個別権限の変更（マトリックス用）
  const handleUserPermissionChange = async (
    userId: string,
    targetType: "menu" | "program",
    targetId: string,
    isAllowed: boolean
  ) => {
    setSaving(true);
    try {
      // 既存レコードを検索
      const existingRecord = data.user.find(
        (p: any) =>
          p.fields?.["社員ID"] === userId &&
          p.fields?.["対象種別"] === targetType &&
          p.fields?.["対象ID"] === targetId
      );

      if (existingRecord) {
        // 既存レコードを更新
        const response = await fetch("/api/master/menu-permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "user",
            record_id: existingRecord.record_id,
            fields: { "許可フラグ": isAllowed },
          }),
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.error || "更新に失敗しました");
        }
      } else {
        // 新規レコードを作成
        const userRecord = data.user.find((p: any) => p.fields?.["社員ID"] === userId);
        const userName = userRecord?.fields?.["社員名"] || userId;

        const response = await fetch("/api/master/menu-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "user",
            fields: {
              "社員ID": userId,
              "社員名": userName,
              "対象種別": targetType,
              "対象ID": targetId,
              "許可フラグ": isAllowed,
            },
          }),
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.error || "作成に失敗しました");
        }
      }
      await fetchData();
    } catch (err) {
      alert("権限の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ユーザー追加（マトリックス用）
  const handleAddUser = async (userId: string, userName: string) => {
    setSaving(true);
    try {
      // 最初のメニューに対するダミーレコードを作成してユーザーを追加
      const firstMenu = data.menu[0];
      if (firstMenu) {
        const response = await fetch("/api/master/menu-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "user",
            fields: {
              "社員ID": userId,
              "社員名": userName,
              "対象種別": "menu",
              "対象ID": firstMenu.fields?.["メニューID"] || "M001",
              "許可フラグ": false,
            },
          }),
        });
        const result = await response.json();
        if (result.success) {
          await fetchData();
        } else {
          alert(result.error || "ユーザーの追加に失敗しました");
        }
      }
    } catch (err) {
      alert("ユーザーの追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ユーザー削除（マトリックス用 - そのユーザーの全レコードを削除）
  const handleRemoveUser = async (userId: string) => {
    setSaving(true);
    try {
      const userRecords = data.user.filter((p: any) => p.fields?.["社員ID"] === userId);
      for (const record of userRecords) {
        await fetch(
          `/api/master/menu-permissions?type=user&record_id=${record.record_id}`,
          { method: "DELETE" }
        );
      }
      await fetchData();
    } catch (err) {
      alert("ユーザーの削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ページヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Database className="w-6 h-6 text-indigo-600" />
                メニュー権限マスタ管理
              </h1>
              <p className="text-sm text-gray-500">マスタ &gt; メニュー権限マスタ管理</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
              {activeTab !== "group" && activeTab !== "user" && (
                <button
                  onClick={() => {
                    setNewRecord({});
                    setShowAddForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新規追加
                </button>
              )}
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="flex-shrink-0 px-6 bg-white border-b">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {data[tab.id]?.length || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* グループ権限マトリックス表示 */}
          {activeTab === "group" ? (
            <GroupPermissionMatrix
              menus={data.menu}
              programs={data.program}
              groupPermissions={data.group}
              onPermissionChange={handlePermissionChange}
              onAddGroup={handleAddGroup}
              onRemoveGroup={handleRemoveGroup}
              saving={saving}
            />
          ) : activeTab === "user" ? (
            /* 個別権限マトリックス表示 */
            <UserPermissionMatrix
              menus={data.menu}
              programs={data.program}
              userPermissions={data.user}
              onPermissionChange={handleUserPermissionChange}
              onAddUser={handleAddUser}
              onRemoveUser={handleRemoveUser}
              saving={saving}
            />
          ) : (
          /* 通常テーブル表示 */
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {currentTab.fields.map((field) => (
                      <th
                        key={field.key}
                        className={`px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap ${
                          field.sortable ? "cursor-pointer hover:bg-gray-100 select-none" : ""
                        }`}
                        onClick={() => field.sortable && handleSort(field.key)}
                      >
                        <div className="flex items-center gap-1">
                          <span>
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </span>
                          {field.sortable && getSortIcon(field.key)}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={currentTab.fields.length + 1}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    currentData.map((record) => (
                      <tr key={record.record_id} className="hover:bg-gray-50">
                        {currentTab.fields.map((field) => (
                          <td key={field.key} className="px-4 py-2">
                            {editingId === record.record_id ? (
                              <FieldInput
                                field={field}
                                value={editingData[field.key]}
                                onChange={(value) =>
                                  setEditingData({ ...editingData, [field.key]: value })
                                }
                              />
                            ) : field.type === "boolean" ? (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  getFieldValue(record, field.key)
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {getFieldValue(record, field.key) ? "有効" : "無効"}
                              </span>
                            ) : field.type === "icon" ? (
                              (() => {
                                const iconName = getFieldValue(record, field.key);
                                const iconItem = AVAILABLE_ICONS.find((i) => i.name === iconName);
                                if (iconItem) {
                                  const IconComponent = iconItem.icon;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="w-4 h-4 text-gray-600" />
                                      <span className="text-sm text-gray-500">{iconItem.label}</span>
                                    </div>
                                  );
                                }
                                return <span className="text-sm text-gray-400">-</span>;
                              })()
                            ) : (
                              <span className="text-sm text-gray-700">
                                {getFieldValue(record, field.key) || "-"}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1">
                            {editingId === record.record_id ? (
                              <>
                                <button
                                  onClick={() => handleUpdate(record.record_id)}
                                  disabled={saving}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                  title="保存"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingData({});
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                                  title="キャンセル"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(record)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="編集"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(record.record_id)}
                                  disabled={saving}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

        {/* 新規追加モーダル */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-lg font-bold text-gray-800">
                  {currentTab.label} - 新規追加
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {currentTab.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <FieldInput
                      field={field}
                      value={newRecord[field.key]}
                      onChange={(value) =>
                        setNewRecord({ ...newRecord, [field.key]: value })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
