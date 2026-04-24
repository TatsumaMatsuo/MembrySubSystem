"use client";

import { useState } from "react";
import { Search, FileText, Car, Shield, User, Calendar, CheckCircle, XCircle, Clock, Image as ImageIcon, Download } from "lucide-react";
import { LarkUser, DriversLicense, VehicleRegistration, InsurancePolicy, LarkAttachment } from "@/types/syaryo";
import { AttachmentViewer } from "@/components/features/syaryo/ui/attachment-viewer";

// image_attachmentからファイルURLを取得
function getAttachmentUrl(attachment: LarkAttachment | LarkAttachment[] | undefined | null): string | null {
  if (!attachment) return null;
  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  if (!att?.file_token) return null;
  const baseUrl = `/api/syaryo/attachments/${att.file_token}`;
  const downloadUrl = att.url;
  return downloadUrl ? `${baseUrl}?url=${encodeURIComponent(downloadUrl)}` : baseUrl;
}

// 添付ファイルがPDFかどうかを判定
function isAttachmentPdf(attachment: LarkAttachment | LarkAttachment[] | undefined | null): boolean {
  if (!attachment) return false;
  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  if (att?.type && att.type.includes('pdf')) return true;
  if (att?.name && att.name.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

interface UserDocuments {
  license: DriversLicense | null;
  vehicle: VehicleRegistration | null;
  insurance: InsurancePolicy | null;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LarkUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LarkUser | null>(null);
  const [documents, setDocuments] = useState<UserDocuments | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ attachment: LarkAttachment | LarkAttachment[]; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ユーザー検索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert("検索キーワードを入力してください");
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/syaryo/lark/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data);
        if (data.data.length === 0) {
          alert("ユーザーが見つかりませんでした");
        }
      } else {
        alert("検索に失敗しました");
      }
    } catch (error) {
      console.error("Failed to search users:", error);
      alert("検索中にエラーが発生しました");
    } finally {
      setSearching(false);
    }
  };

  // ユーザー選択して書類取得
  const handleSelectUser = async (user: LarkUser) => {
    setSelectedUser(user);
    setDocuments(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/syaryo/search/user-documents?employee_id=${encodeURIComponent(user.user_id || user.open_id)}`);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.data);
      } else {
        setError(data.error || "書類の取得に失敗しました");
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError("書類の取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            承認済
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            却下
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            承認待ち
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            不明
          </span>
        );
    }
  };

  return (
    <div className="p-8">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー書類照会</h1>
        <p className="mt-1 text-sm text-gray-600">
          ユーザーを検索して最新の書類を確認できます
        </p>
      </div>

      {/* ユーザー検索 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Search className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">ユーザー検索</h2>
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 border rounded-lg px-4 py-2"
            placeholder="名前、メールアドレス、または社員IDで検索..."
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {searching ? "検索中..." : "検索"}
          </button>
        </div>

        {/* 検索結果 */}
        {searchResults.length > 0 && (
          <div className="mt-4 border rounded-lg max-h-60 overflow-y-auto">
            <div className="divide-y">
              {searchResults.map((user) => (
                <div
                  key={user.open_id}
                  onClick={() => handleSelectUser(user)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedUser?.open_id === user.open_id
                      ? "bg-blue-50 border-l-4 border-blue-600"
                      : ""
                  }`}
                >
                  <div className="flex items-center">
                    <User className="w-5 h-5 text-gray-400 mr-3" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 選択されたユーザーの書類 */}
      {selectedUser && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <User className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-600">書類を読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
              <XCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="mt-4 text-red-600 font-medium">エラーが発生しました</p>
              <p className="text-sm text-red-500 mt-1">{error}</p>
            </div>
          ) : !documents ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <User className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="mt-4 text-gray-600">書類情報がありません</p>
              <p className="text-sm text-gray-500 mt-1">このユーザーは書類を登録していません</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 運転免許証 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">運転免許証</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">最新</span>
                  </div>
                  {documents.license && getStatusBadge(documents.license.approval_status)}
                </div>

                {documents.license ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="space-y-2 text-sm">
                          <div className="flex">
                            <span className="text-gray-500 w-32">免許証番号:</span>
                            <span className="text-gray-900 font-medium">{documents.license.license_number}</span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">種別:</span>
                            <span className="text-gray-900">{documents.license.license_type}</span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">交付日:</span>
                            <span className="text-gray-900">
                              {new Date(documents.license.issue_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">有効期限:</span>
                            <span className="text-gray-900 font-medium">
                              {new Date(documents.license.expiration_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">登録日:</span>
                            <span className="text-gray-900 text-xs">
                              {new Date(documents.license.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* 免許証画像（表面・裏面）- 縦2段表示（申請詳細と同じ仕様） */}
                    <div className="space-y-4">
                      {/* 表面 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gray-500 text-sm">表面</p>
                          {getAttachmentUrl(documents.license.image_attachment) && (
                            <a
                              href={getAttachmentUrl(documents.license.image_attachment)!}
                              download
                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500 transition-colors flex items-center"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              ダウンロード
                            </a>
                          )}
                        </div>
                        <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                          {getAttachmentUrl(documents.license.image_attachment) ? (
                            isAttachmentPdf(documents.license.image_attachment) ? (
                              <iframe
                                src={getAttachmentUrl(documents.license.image_attachment)!}
                                className="w-full h-full border-0"
                                title="運転免許証（表面）"
                              />
                            ) : (
                              <img
                                src={getAttachmentUrl(documents.license.image_attachment)!}
                                alt="運転免許証（表面）"
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <div className="text-center">
                                <FileText className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm">画像なし</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 裏面 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gray-500 text-sm">裏面</p>
                          {getAttachmentUrl(documents.license.image_attachment_ura) && (
                            <a
                              href={getAttachmentUrl(documents.license.image_attachment_ura)!}
                              download
                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500 transition-colors flex items-center"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              ダウンロード
                            </a>
                          )}
                        </div>
                        <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                          {getAttachmentUrl(documents.license.image_attachment_ura) ? (
                            isAttachmentPdf(documents.license.image_attachment_ura) ? (
                              <iframe
                                src={getAttachmentUrl(documents.license.image_attachment_ura)!}
                                className="w-full h-full border-0"
                                title="運転免許証（裏面）"
                              />
                            ) : (
                              <img
                                src={getAttachmentUrl(documents.license.image_attachment_ura)!}
                                alt="運転免許証（裏面）"
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <div className="text-center">
                                <FileText className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm">画像なし</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">登録されていません</p>
                )}
              </div>

              {/* 車検証 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Car className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">車検証</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">最新</span>
                  </div>
                  {documents.vehicle && getStatusBadge(documents.vehicle.approval_status)}
                </div>

                {documents.vehicle ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="space-y-2 text-sm">
                        <div className="flex">
                          <span className="text-gray-500 w-32">車両番号:</span>
                          <span className="text-gray-900 font-medium">{documents.vehicle.vehicle_number}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-32">車種:</span>
                          <span className="text-gray-900">{documents.vehicle.vehicle_type}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-32">メーカー:</span>
                          <span className="text-gray-900">{documents.vehicle.manufacturer}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-32">型式:</span>
                          <span className="text-gray-900">{documents.vehicle.model_name}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-32">車検有効期限:</span>
                          <span className="text-gray-900 font-medium">
                            {new Date(documents.vehicle.inspection_expiration_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-32">登録日:</span>
                          <span className="text-gray-900 text-xs">
                            {new Date(documents.vehicle.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-500 text-sm">画像</p>
                        {getAttachmentUrl(documents.vehicle.image_attachment) && (
                          <a
                            href={getAttachmentUrl(documents.vehicle.image_attachment)!}
                            download
                            className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500 transition-colors flex items-center"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            ダウンロード
                          </a>
                        )}
                      </div>
                      <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '200px' }}>
                        {getAttachmentUrl(documents.vehicle.image_attachment) ? (
                          isAttachmentPdf(documents.vehicle.image_attachment) ? (
                            <iframe
                              src={getAttachmentUrl(documents.vehicle.image_attachment)!}
                              className="w-full h-full border-0"
                              title="車検証"
                            />
                          ) : (
                            <img
                              src={getAttachmentUrl(documents.vehicle.image_attachment)!}
                              alt="車検証"
                              className="w-full h-full object-contain"
                            />
                          )
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500">
                            <div className="text-center">
                              <FileText className="h-12 w-12 mx-auto mb-2" />
                              <p className="text-sm">画像なし</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">登録されていません</p>
                )}
              </div>

              {/* 任意保険証 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">任意保険証</h3>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">最新</span>
                  </div>
                  {documents.insurance && getStatusBadge(documents.insurance.approval_status)}
                </div>

                {documents.insurance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="space-y-2 text-sm">
                          <div className="flex">
                            <span className="text-gray-500 w-32">証券番号:</span>
                            <span className="text-gray-900 font-medium">{documents.insurance.policy_number}</span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">保険会社:</span>
                            <span className="text-gray-900">{documents.insurance.insurance_company}</span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">保険種別:</span>
                            <span className="text-gray-900">{documents.insurance.policy_type}</span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">保障開始日:</span>
                            <span className="text-gray-900">
                              {new Date(documents.insurance.coverage_start_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">保障終了日:</span>
                            <span className="text-gray-900 font-medium">
                              {new Date(documents.insurance.coverage_end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="text-gray-500 w-32">登録日:</span>
                            <span className="text-gray-900 text-xs">
                              {new Date(documents.insurance.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gray-500 text-sm">画像</p>
                          {getAttachmentUrl(documents.insurance.image_attachment) && (
                            <a
                              href={getAttachmentUrl(documents.insurance.image_attachment)!}
                              download
                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500 transition-colors flex items-center"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              ダウンロード
                            </a>
                          )}
                        </div>
                        <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '200px' }}>
                          {getAttachmentUrl(documents.insurance.image_attachment) ? (
                            isAttachmentPdf(documents.insurance.image_attachment) ? (
                              <iframe
                                src={getAttachmentUrl(documents.insurance.image_attachment)!}
                                className="w-full h-full border-0"
                                title="任意保険証"
                              />
                            ) : (
                              <img
                                src={getAttachmentUrl(documents.insurance.image_attachment)!}
                                alt="任意保険証"
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <div className="text-center">
                                <FileText className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm">画像なし</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 補償内容 */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="text-sm font-medium text-purple-800 mb-3">補償内容（会社規定）</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700">対人補償:</span>
                          {documents.insurance.liability_personal_unlimited ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              無制限
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              条件未達
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700">対物補償:</span>
                          {(documents.insurance.liability_property_amount || 0) >= 5000 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {(documents.insurance.liability_property_amount || 0).toLocaleString()}万円
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              {(documents.insurance.liability_property_amount || 0).toLocaleString()}万円（5,000万円以上必要）
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700">搭乗者傷害:</span>
                          {(documents.insurance.passenger_injury_amount || 0) >= 2000 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {(documents.insurance.passenger_injury_amount || 0).toLocaleString()}万円
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              {(documents.insurance.passenger_injury_amount || 0).toLocaleString()}万円（2,000万円以上必要）
                            </span>
                          )}
                        </div>
                      </div>
                      {/* 会社規定判定 */}
                      {(() => {
                        const meetsRequirements =
                          documents.insurance!.liability_personal_unlimited &&
                          (documents.insurance!.liability_property_amount || 0) >= 5000 &&
                          (documents.insurance!.passenger_injury_amount || 0) >= 2000;
                        return meetsRequirements ? (
                          <div className="mt-3 p-2 bg-green-100 rounded text-center">
                            <span className="text-green-800 text-sm font-medium">
                              ✓ 会社規定を満たしています（許可証発行可能）
                            </span>
                          </div>
                        ) : (
                          <div className="mt-3 p-2 bg-red-100 rounded text-center">
                            <span className="text-red-800 text-sm font-medium">
                              ✗ 会社規定を満たしていません（許可証発行不可）
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">登録されていません</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
