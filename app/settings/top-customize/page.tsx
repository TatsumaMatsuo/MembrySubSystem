"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw,
  Check,
} from "lucide-react";

interface CustomLink {
  record_id?: string;
  user_id: string;
  display_name: string;
  url: string;
  icon_url?: string;
  sort_order: number;
  is_active: boolean;
}

export default function TopCustomizePage() {
  const [links, setLinks] = useState<CustomLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 新規追加用フォーム
  const [newLink, setNewLink] = useState<Partial<CustomLink>>({
    display_name: "",
    url: "",
    icon_url: "",
    sort_order: 0,
  });

  // 編集用フォーム
  const [editLink, setEditLink] = useState<Partial<CustomLink>>({});

  // データ取得
  const fetchLinks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/top-custom-links");
      const data = await response.json();
      if (data.success) {
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error("Failed to fetch links:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // 新規追加
  const handleAdd = async () => {
    if (!newLink.display_name || !newLink.url) return;

    setSaving(true);
    try {
      const response = await fetch("/api/top-custom-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newLink,
          sort_order: links.length,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNewLink({ display_name: "", url: "", icon_url: "", sort_order: 0 });
        setShowAddForm(false);
        await fetchLinks();
      }
    } catch (error) {
      console.error("Failed to add link:", error);
    } finally {
      setSaving(false);
    }
  };

  // 編集開始
  const startEdit = (link: CustomLink) => {
    setEditingId(link.record_id || null);
    setEditLink({ ...link });
  };

  // 編集保存
  const handleUpdate = async () => {
    if (!editLink.record_id) return;

    setSaving(true);
    try {
      const response = await fetch("/api/top-custom-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editLink),
      });

      const data = await response.json();
      if (data.success) {
        setEditingId(null);
        setEditLink({});
        await fetchLinks();
      }
    } catch (error) {
      console.error("Failed to update link:", error);
    } finally {
      setSaving(false);
    }
  };

  // 削除
  const handleDelete = async (recordId: string) => {
    if (!confirm("このリンクを削除しますか？")) return;

    try {
      const response = await fetch(`/api/top-custom-links?record_id=${recordId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        await fetchLinks();
      }
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  // 有効/無効切り替え
  const toggleActive = async (link: CustomLink) => {
    try {
      const response = await fetch("/api/top-custom-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: link.record_id,
          is_active: !link.is_active,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchLinks();
      }
    } catch (error) {
      console.error("Failed to toggle active:", error);
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-500" />
            TOP画面カスタマイズ
          </h1>
          <p className="text-sm text-gray-500">
            システム設定 &gt; TOP画面カスタマイズ
          </p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 説明 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                TOP画面に表示するカスタムリンクボタンを設定できます。
                登録したリンクはTOP画面のウィジェットエリアに表示され、クリックすると新しいタブで開きます。
              </p>
            </div>

            {/* リンク一覧 */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-600" />
                  カスタムリンク一覧
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLinks}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    新規追加
                  </button>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                ) : links.length === 0 ? (
                  <div className="text-center py-12">
                    <LinkIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">カスタムリンクが登録されていません</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      最初のリンクを追加する
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {links.map((link) => (
                      <div
                        key={link.record_id}
                        className={`border rounded-lg p-4 ${
                          link.is_active ? "bg-white" : "bg-gray-50 opacity-60"
                        }`}
                      >
                        {editingId === link.record_id ? (
                          // 編集モード
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  表示名
                                </label>
                                <input
                                  type="text"
                                  value={editLink.display_name || ""}
                                  onChange={(e) =>
                                    setEditLink({ ...editLink, display_name: e.target.value })
                                  }
                                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  URL
                                </label>
                                <input
                                  type="url"
                                  value={editLink.url || ""}
                                  onChange={(e) =>
                                    setEditLink({ ...editLink, url: e.target.value })
                                  }
                                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                アイコン画像URL（任意）
                              </label>
                              <input
                                type="url"
                                value={editLink.icon_url || ""}
                                onChange={(e) =>
                                  setEditLink({ ...editLink, icon_url: e.target.value })
                                }
                                placeholder="https://example.com/icon.png"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditLink({});
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                              >
                                <X className="w-4 h-4" />
                                キャンセル
                              </button>
                              <button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {saving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <GripVertical className="w-5 h-5 text-gray-300" />
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                              {link.icon_url ? (
                                <img
                                  src={link.icon_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800">{link.display_name}</div>
                              <div className="text-sm text-gray-500 truncate">{link.url}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleActive(link)}
                                className={`p-2 rounded-lg transition-colors ${
                                  link.is_active
                                    ? "bg-green-100 text-green-600"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                                title={link.is_active ? "有効" : "無効"}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="プレビュー"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => startEdit(link)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="編集"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => link.record_id && handleDelete(link.record_id)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 新規追加フォーム */}
            {showAddForm && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    新規リンク追加
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        表示名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newLink.display_name || ""}
                        onChange={(e) =>
                          setNewLink({ ...newLink, display_name: e.target.value })
                        }
                        placeholder="例: 社内ポータル"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={newLink.url || ""}
                        onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      アイコン画像URL（任意）
                    </label>
                    <input
                      type="url"
                      value={newLink.icon_url || ""}
                      onChange={(e) => setNewLink({ ...newLink, icon_url: e.target.value })}
                      placeholder="https://example.com/icon.png"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      画像URLを指定するとボタンにアイコンが表示されます
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewLink({ display_name: "", url: "", icon_url: "", sort_order: 0 });
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={saving || !newLink.display_name || !newLink.url}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      追加する
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
