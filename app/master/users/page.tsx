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
  Trash2,
  Save,
  X,
  Loader2,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

interface UserPermissionRecord {
  record_id: string;
  fields: {
    "社員ID": string;
    "社員名": string;
    "対象種別": "menu" | "program";
    "対象ID": string;
    "許可フラグ": boolean;
  };
}

interface UserSummary {
  employeeId: string;
  employeeName: string;
  permissionCount: number;
}

export default function UsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [userPermissions, setUserPermissions] = useState<UserPermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);

  // 新規ユーザー追加フォーム
  const [newUser, setNewUser] = useState({
    社員ID: "",
    社員名: "",
  });

  // 認証チェック
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // データ取得
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/master/menu-permissions?type=user");
      const data = await response.json();

      if (data.success) {
        setUserPermissions(data.data || []);
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError("データの取得に失敗しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  // ユーザーサマリーを生成
  const getUserSummaries = (): UserSummary[] => {
    const userMap = new Map<string, UserSummary>();

    userPermissions.forEach((p) => {
      const employeeId = p.fields?.["社員ID"];
      const employeeName = p.fields?.["社員名"];
      if (!employeeId) return;

      if (!userMap.has(employeeId)) {
        userMap.set(employeeId, {
          employeeId,
          employeeName: employeeName || "",
          permissionCount: 0,
        });
      }
      const user = userMap.get(employeeId)!;
      if (p.fields?.["許可フラグ"]) {
        user.permissionCount++;
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.employeeId.localeCompare(b.employeeId, "ja")
    );
  };

  const users = getUserSummaries();

  // フィルタリング
  const filteredUsers = users.filter(
    (u) =>
      u.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ユーザーの権限一覧を取得
  const getUserPermissionDetails = (employeeId: string) => {
    return userPermissions.filter(
      (p) => p.fields?.["社員ID"] === employeeId && p.fields?.["許可フラグ"]
    );
  };

  // ユーザー追加（ダミー権限レコードを作成）
  const handleAddUser = async () => {
    if (!newUser.社員ID || !newUser.社員名) {
      alert("社員IDと社員名は必須です");
      return;
    }

    // 既存ユーザーチェック
    if (users.some((u) => u.employeeId === newUser.社員ID)) {
      alert("この社員IDは既に登録されています");
      return;
    }

    setSaving(true);
    try {
      // ダミーのメニュー権限レコードを作成（許可フラグfalse）
      const response = await fetch("/api/master/menu-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "user",
          fields: {
            "社員ID": newUser.社員ID,
            "社員名": newUser.社員名,
            "対象種別": "menu",
            "対象ID": "M001",
            "許可フラグ": false,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
        setShowAddUserForm(false);
        setNewUser({ 社員ID: "", 社員名: "" });
      } else {
        alert(data.error || "ユーザーの追加に失敗しました");
      }
    } catch (err) {
      alert("ユーザーの追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ユーザー削除（全権限レコードを削除）
  const handleDeleteUser = async (employeeId: string) => {
    if (!confirm(`社員ID「${employeeId}」の全ての権限を削除しますか？`)) return;

    setSaving(true);
    try {
      const userRecords = userPermissions.filter(
        (p) => p.fields?.["社員ID"] === employeeId
      );

      for (const record of userRecords) {
        await fetch(
          `/api/master/menu-permissions?type=user&record_id=${record.record_id}`,
          { method: "DELETE" }
        );
      }

      await fetchData();
      if (selectedUser?.employeeId === employeeId) {
        setSelectedUser(null);
      }
    } catch (err) {
      alert("削除に失敗しました");
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
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
              <button
                onClick={() => setShowAddUserForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                ユーザー追加
              </button>
            </div>
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
              placeholder="社員IDまたは社員名で検索..."
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

        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="flex gap-6 h-full">
            {/* ユーザー一覧 */}
            <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  ユーザー一覧（{filteredUsers.length}名）
                </h2>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        社員ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        社員名
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        権限数
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          {searchTerm ? "検索結果がありません" : "ユーザーが登録されていません"}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr
                          key={user.employeeId}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            selectedUser?.employeeId === user.employeeId ? "bg-indigo-50" : ""
                          }`}
                          onClick={() => setSelectedUser(user)}
                        >
                          <td className="px-4 py-3 font-mono text-sm text-gray-700">
                            {user.employeeId}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {user.employeeName?.[0] || user.employeeId[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900">
                                {user.employeeName || "(名前未設定)"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                              {user.permissionCount}件
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.employeeId);
                              }}
                              disabled={saving}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 権限詳細パネル */}
            {selectedUser && (
              <div className="w-96 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between">
                  <h3 className="text-white font-bold">
                    {selectedUser.employeeName || selectedUser.employeeId}の権限
                  </h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {(() => {
                    const permissions = getUserPermissionDetails(selectedUser.employeeId);
                    if (permissions.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-4">
                          許可された権限がありません
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {permissions.map((p) => (
                          <div
                            key={p.record_id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded mr-2 ${
                                  p.fields?.["対象種別"] === "menu"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {p.fields?.["対象種別"] === "menu" ? "メニュー" : "プログラム"}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                {p.fields?.["対象ID"]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="px-4 py-3 border-t bg-gray-50">
                  <button
                    onClick={() => router.push("/master/menu-permissions")}
                    className="w-full px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    メニュー権限マスタで編集
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ユーザー追加モーダル */}
        {showAddUserForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">ユーザー追加</h3>
                <button
                  onClick={() => setShowAddUserForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    社員ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.社員ID}
                    onChange={(e) =>
                      setNewUser({ ...newUser, 社員ID: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="例: 000001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    社員名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.社員名}
                    onChange={(e) =>
                      setNewUser({ ...newUser, 社員名: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="例: 山口 太郎"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddUserForm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddUser}
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
