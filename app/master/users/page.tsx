"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Save,
  X,
  Loader2,
  UserCheck,
  Shield,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { RoleMaster, UserRole, UserPermission } from "@/types";

interface UserSummary {
  email: string;
  name: string;
  roles: string[];
  permissionCount: number;
}

export default function UsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);

  // 新規ロール追加フォーム
  const [newRole, setNewRole] = useState({
    ロールID: "",
    ロール名: "",
    説明: "",
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
        const [rolesRes, permissionsRes] = await Promise.all([
          fetch("/api/master/roles"),
          fetch("/api/master/permissions"),
        ]);

        const rolesData = await rolesRes.json();
        const permissionsData = await permissionsRes.json();

        if (rolesData.success) {
          setRoles(rolesData.data);
        }
        if (permissionsData.success) {
          setPermissions(permissionsData.data);
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

  // ユーザーサマリーを生成
  const getUserSummaries = (): UserSummary[] => {
    const userMap = new Map<string, UserSummary>();

    // 権限からユーザーを抽出
    permissions.forEach((p) => {
      if (!userMap.has(p.ユーザーメール)) {
        userMap.set(p.ユーザーメール, {
          email: p.ユーザーメール,
          name: p.ユーザー名,
          roles: [],
          permissionCount: 0,
        });
      }
      const user = userMap.get(p.ユーザーメール)!;
      user.permissionCount++;
    });

    return Array.from(userMap.values());
  };

  const users = getUserSummaries();

  // フィルタリング
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ロール追加
  const handleAddRole = async () => {
    if (!newRole.ロールID || !newRole.ロール名) {
      alert("ロールIDとロール名は必須です");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/master/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRole,
          有効フラグ: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setRoles([...roles, data.data]);
        setShowAddRoleForm(false);
        setNewRole({ ロールID: "", ロール名: "", 説明: "" });
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("ロールの追加に失敗しました");
    } finally {
      setSaving(false);
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
                <Users className="w-6 h-6 text-indigo-600" />
                ユーザー管理
              </h1>
              <p className="text-sm text-gray-500">マスタ &gt; ユーザー管理</p>
            </div>
            <button
              onClick={() => setShowAddRoleForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              ロール追加
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

        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {/* ユーザー一覧 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500">
              <h2 className="text-white font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                ユーザー一覧（{filteredUsers.length}名）
              </h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    ユーザー
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    メールアドレス
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    権限設定数
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? "検索結果がありません" : "ユーザーデータがありません"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.email} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {user.name?.[0] || user.email[0].toUpperCase()}
                          </div>
                          <div className="font-medium text-gray-900">
                            {user.name || "(名前未設定)"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                          {user.permissionCount}件
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            router.push(
                              `/master/permissions?user_email=${encodeURIComponent(user.email)}`
                            )
                          }
                          className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          権限を見る
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ロール一覧 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                ロールマスタ（{roles.length}件）
              </h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    ロールID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    ロール名
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    説明
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      ロールが登録されていません
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.record_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm text-gray-700">
                        {role.ロールID}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {role.ロール名}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {role.説明 || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {role.有効フラグ ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            有効
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                            無効
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ロール追加モーダル */}
        {showAddRoleForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">ロール追加</h3>
                <button
                  onClick={() => setShowAddRoleForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ロールID *
                  </label>
                  <input
                    type="text"
                    value={newRole.ロールID}
                    onChange={(e) =>
                      setNewRole({ ...newRole, ロールID: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="admin, sales_manager など"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ロール名 *
                  </label>
                  <input
                    type="text"
                    value={newRole.ロール名}
                    onChange={(e) =>
                      setNewRole({ ...newRole, ロール名: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="管理者、営業マネージャー など"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={newRole.説明}
                    onChange={(e) =>
                      setNewRole({ ...newRole, 説明: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    placeholder="ロールの説明"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddRoleForm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddRole}
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
