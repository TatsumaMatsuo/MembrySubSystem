"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Save,
  X,
  Loader2,
  ChevronDown,
  Users,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { FeatureMaster, UserPermission, PermissionLevel, Employee } from "@/types";

export default function PermissionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [features, setFeatures] = useState<FeatureMaster[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 社員検索用の状態
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 新規追加フォームの状態
  const [newPermission, setNewPermission] = useState({
    ユーザーメール: "",
    ユーザー名: "",
    対象機能: [] as string[],
    権限レベル: "view" as PermissionLevel,
    備考: "",
  });

  // 認証チェック
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [featuresRes, permissionsRes, employeesRes] = await Promise.all([
          fetch("/api/master/features"),
          fetch("/api/master/permissions"),
          fetch("/api/master/employees"),
        ]);

        const featuresData = await featuresRes.json();
        const permissionsData = await permissionsRes.json();
        const employeesData = await employeesRes.json();

        if (featuresData.success) {
          setFeatures(featuresData.data);
        }
        if (permissionsData.success) {
          setPermissions(permissionsData.data);
        }
        if (employeesData.success) {
          setEmployees(employeesData.data);
        }
      } catch (err) {
        setError("データの取得に失敗しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  // 社員検索フィルター
  useEffect(() => {
    if (employeeSearch.length > 0) {
      const filtered = employees.filter(
        (e) =>
          e.社員名.toLowerCase().includes(employeeSearch.toLowerCase()) ||
          e.メールアドレス.toLowerCase().includes(employeeSearch.toLowerCase()) ||
          e.社員コード.toLowerCase().includes(employeeSearch.toLowerCase())
      );
      setFilteredEmployees(filtered);
      setShowEmployeeDropdown(true);
    } else {
      setFilteredEmployees([]);
      setShowEmployeeDropdown(false);
    }
  }, [employeeSearch, employees]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 社員選択
  const handleSelectEmployee = (employee: Employee) => {
    setNewPermission({
      ...newPermission,
      ユーザーメール: employee.メールアドレス,
      ユーザー名: employee.社員名,
    });
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  // 権限追加
  const handleAddPermission = async () => {
    if (!newPermission.ユーザーメール || newPermission.対象機能.length === 0) {
      alert("ユーザーメールと対象機能は必須です");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/master/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPermission,
          付与者: session?.user?.email,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPermissions([...permissions, data.data]);
        setShowAddForm(false);
        setNewPermission({
          ユーザーメール: "",
          ユーザー名: "",
          対象機能: [],
          権限レベル: "view",
          備考: "",
        });
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("権限の追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 権限更新
  const handleUpdatePermission = async (permission: UserPermission) => {
    setSaving(true);
    try {
      const response = await fetch("/api/master/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permission),
      });

      const data = await response.json();
      if (data.success) {
        setPermissions(
          permissions.map((p) =>
            p.record_id === permission.record_id ? permission : p
          )
        );
        setEditingId(null);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("権限の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // フィルタリング
  const filteredPermissions = permissions.filter(
    (p) =>
      p.ユーザーメール.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ユーザー名.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 機能名を取得するヘルパー
  const getFeatureName = (featureIds: string[]) => {
    return featureIds
      .map((id) => {
        const feature = features.find((f) => f.record_id === id || f.機能ID === id);
        return feature?.機能名 || id;
      })
      .join(", ");
  };

  // 権限レベルの表示
  const getPermissionLevelBadge = (level: PermissionLevel) => {
    switch (level) {
      case "edit":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            編集
          </span>
        );
      case "view":
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            表示のみ
          </span>
        );
      case "hidden":
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            非表示
          </span>
        );
    }
  };

  if (status === "loading" || loading) {
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
                <Shield className="w-6 h-6 text-indigo-600" />
                権限設定
              </h1>
              <p className="text-sm text-gray-500">マスタ &gt; 権限設定</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              権限追加
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ユーザー名またはメールで検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 権限一覧テーブル */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    ユーザー
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    対象機能
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    権限レベル
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    付与者
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    備考
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? "検索結果がありません" : "権限データがありません"}
                    </td>
                  </tr>
                ) : (
                  filteredPermissions.map((permission) => (
                    <tr key={permission.record_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {permission.ユーザー名}
                          </div>
                          <div className="text-sm text-gray-500">
                            {permission.ユーザーメール}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getFeatureName(permission.対象機能)}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === permission.record_id ? (
                          <select
                            value={permission.権限レベル}
                            onChange={(e) =>
                              setPermissions(
                                permissions.map((p) =>
                                  p.record_id === permission.record_id
                                    ? { ...p, 権限レベル: e.target.value as PermissionLevel }
                                    : p
                                )
                              )
                            }
                            className="px-2 py-1 border rounded text-sm"
                          >
                            <option value="edit">編集</option>
                            <option value="view">表示のみ</option>
                            <option value="hidden">非表示</option>
                          </select>
                        ) : (
                          getPermissionLevelBadge(permission.権限レベル)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {permission.付与者 || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {permission.備考 || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingId === permission.record_id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdatePermission(permission)}
                              disabled={saving}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingId(permission.record_id)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 機能マスタ一覧 */}
        <div className="flex-shrink-0 px-6 pb-4">
          <details className="bg-white rounded-xl shadow-lg overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 cursor-pointer font-medium text-gray-700 flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              機能マスタ一覧（{features.length}件）
            </summary>
            <div className="p-4 max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">機能ID</th>
                    <th className="px-2 py-2 text-left">機能名</th>
                    <th className="px-2 py-2 text-left">メニューグループ</th>
                    <th className="px-2 py-2 text-left">タイプ</th>
                    <th className="px-2 py-2 text-center">有効</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.record_id} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2 font-mono text-xs">{feature.機能ID}</td>
                      <td className="px-2 py-2">{feature.機能名}</td>
                      <td className="px-2 py-2">{feature.所属メニューグループ}</td>
                      <td className="px-2 py-2">{feature.機能タイプ}</td>
                      <td className="px-2 py-2 text-center">
                        {feature.有効フラグ ? "✓" : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {/* 新規追加モーダル */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-lg font-bold text-gray-800">権限追加</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* 社員検索 */}
                <div ref={dropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    社員マスタから選択
                  </label>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    onFocus={() => employeeSearch.length > 0 && setShowEmployeeDropdown(true)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="社員名、メール、社員コードで検索..."
                  />
                  {showEmployeeDropdown && filteredEmployees.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredEmployees.map((employee) => (
                        <button
                          key={employee.record_id}
                          onClick={() => handleSelectEmployee(employee)}
                          className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-3 border-b last:border-b-0"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {employee.社員名[0]}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{employee.社員名}</div>
                            <div className="text-xs text-gray-500">
                              {employee.社員コード} / {employee.メールアドレス}
                            </div>
                          </div>
                          {employee.部署 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {employee.部署}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {showEmployeeDropdown && employeeSearch.length > 0 && filteredEmployees.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      該当する社員が見つかりません
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 mb-3">または直接入力：</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ユーザーメール *
                      </label>
                      <input
                        type="email"
                        value={newPermission.ユーザーメール}
                        onChange={(e) =>
                          setNewPermission({ ...newPermission, ユーザーメール: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ユーザー名
                      </label>
                      <input
                        type="text"
                        value={newPermission.ユーザー名}
                        onChange={(e) =>
                          setNewPermission({ ...newPermission, ユーザー名: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="山田太郎"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    対象機能 *
                  </label>
                  <select
                    multiple
                    value={newPermission.対象機能}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        対象機能: Array.from(e.target.selectedOptions, (opt) => opt.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32"
                  >
                    {features
                      .filter((f) => f.有効フラグ)
                      .map((feature) => (
                        <option key={feature.record_id} value={feature.record_id}>
                          [{feature.所属メニューグループ}] {feature.機能名}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Ctrlキーを押しながらクリックで複数選択
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    権限レベル
                  </label>
                  <select
                    value={newPermission.権限レベル}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        権限レベル: e.target.value as PermissionLevel,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="edit">編集 - 閲覧・作成・編集・削除が可能</option>
                    <option value="view">表示のみ - 閲覧のみ可能</option>
                    <option value="hidden">非表示 - メニューに表示されない</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    備考
                  </label>
                  <textarea
                    value={newPermission.備考}
                    onChange={(e) =>
                      setNewPermission({ ...newPermission, 備考: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    placeholder="権限付与の理由など"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddPermission}
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
