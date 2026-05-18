"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPermission, LarkUser, PermissionRole } from "@/types/syaryo";
import { Users, Shield, Eye, Trash2, Search, Plus } from "lucide-react";

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/syaryo/permissions");
      const data = await response.json();

      if (data.success) {
        setPermissions(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleDelete = async (id: string) => {
    if (!confirm("この権限を削除しますか？")) return;

    try {
      const response = await fetch(`/api/syaryo/permissions/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("権限を削除しました");
        fetchPermissions();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Failed to delete permission:", error);
      alert("削除に失敗しました");
    }
  };

  const getRoleBadge = (role: PermissionRole) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Shield className="w-3 h-3 mr-1" />
          管理者
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Eye className="w-3 h-3 mr-1" />
        閲覧者
      </span>
    );
  };

  return (
    <div className="p-8">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー権限管理</h1>
          <p className="mt-1 text-sm text-gray-600">
            管理者と閲覧者の権限を設定します
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          ユーザーを追加
        </button>
      </div>

      {/* 権限一覧 */}
      <div>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              権限が設定されていません
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              ユーザーを追加して権限を設定してください
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    権限
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    付与日時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {permission.user_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {permission.lark_user_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {permission.user_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(permission.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(permission.granted_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(permission.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ユーザー追加モーダル */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchPermissions();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LarkUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LarkUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<PermissionRole>("viewer");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    console.log('DEBUG handleSearch - searchQuery:', searchQuery);

    if (!searchQuery.trim()) {
      console.log('DEBUG handleSearch - empty query');
      alert("検索キーワードを入力してください");
      return;
    }

    setSearching(true);
    console.log('DEBUG handleSearch - fetching...');

    try {
      const url = `/api/syaryo/lark/users/search?q=${encodeURIComponent(searchQuery)}`;
      console.log('DEBUG handleSearch - URL:', url);

      const response = await fetch(url);
      console.log('DEBUG handleSearch - response status:', response.status);

      const data = await response.json();
      console.log('DEBUG handleSearch - response data:', data);

      if (data.success) {
        console.log('DEBUG handleSearch - search results count:', data.data?.length || 0);
        setSearchResults(data.data);

        if (data.data.length === 0) {
          alert("ユーザーが見つかりませんでした");
        }
      } else {
        console.error('DEBUG handleSearch - API error:', data.error);
        alert("検索に失敗しました: " + (data.error || "不明なエラー"));
      }
    } catch (error) {
      console.error("Failed to search users:", error);
      alert("検索中にエラーが発生しました");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      alert("ユーザーを選択してください");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/syaryo/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lark_user_id: selectedUser.open_id,
          user_name: selectedUser.name,
          user_email: selectedUser.email,
          role: selectedRole,
        }),
      });

      if (response.ok) {
        alert("権限を追加しました");
        onSuccess();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to add permission");
      }
    } catch (error) {
      console.error("Failed to add permission:", error);
      alert(
        error instanceof Error ? error.message : "権限の追加に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          ユーザーを追加
        </h2>

        {/* ユーザー検索 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Larkユーザーを検索
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="名前またはメールアドレスで検索..."
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 検索結果 */}
        {searchResults.length > 0 && (
          <div className="mb-6 border rounded-lg max-h-60 overflow-y-auto">
            <div className="divide-y">
              {searchResults.map((user) => (
                <div
                  key={user.open_id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${
                    selectedUser?.open_id === user.open_id
                      ? "bg-blue-50 border-l-4 border-blue-600"
                      : ""
                  }`}
                >
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 選択されたユーザー */}
        {selectedUser && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">
              選択されたユーザー
            </div>
            <div className="font-medium text-gray-900">{selectedUser.name}</div>
            <div className="text-sm text-gray-500">{selectedUser.email}</div>
          </div>
        )}

        {/* 権限選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            権限レベル
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedRole("admin")}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                selectedRole === "admin"
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="flex items-center mb-2">
                <Shield className="w-5 h-5 mr-2 text-purple-600" />
                <span className="font-medium">管理者</span>
              </div>
              <div className="text-xs text-gray-600">
                全ての操作が可能（承認・却下・権限管理）
              </div>
            </button>
            <button
              onClick={() => setSelectedRole("viewer")}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                selectedRole === "viewer"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center mb-2">
                <Eye className="w-5 h-5 mr-2 text-blue-600" />
                <span className="font-medium">閲覧者</span>
              </div>
              <div className="text-xs text-gray-600">
                申請の閲覧のみ可能（承認・却下不可）
              </div>
            </button>
          </div>
        </div>

        {/* アクション */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedUser}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? "追加中..." : "追加する"}
          </button>
        </div>
      </div>
    </div>
  );
}
