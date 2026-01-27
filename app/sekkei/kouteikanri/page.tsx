"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  PenTool,
  Search,
  Filter,
  ChevronDown,
  User,
  Calendar,
  FileText,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Eye,
  X,
} from "lucide-react";
import { DesignRequestRecord } from "@/lib/design-request-tables";

// 作業区分のステータス色
const SAGYOU_KUBUN_COLORS: Record<string, string> = {
  構造検討: "bg-yellow-100 text-yellow-800",
  構造検討済: "bg-green-100 text-green-800",
  構造計算書: "bg-yellow-100 text-yellow-800",
  構造計算書済: "bg-green-100 text-green-800",
  作図: "bg-blue-100 text-blue-800",
  作図済: "bg-green-100 text-green-800",
  申請図: "bg-purple-100 text-purple-800",
  申請図済: "bg-green-100 text-green-800",
  対応完了: "bg-green-100 text-green-800",
  対応不要: "bg-gray-100 text-gray-800",
  対応不可: "bg-red-100 text-red-800",
};

// 区分フィルターオプション
const KUBUN_OPTIONS = [
  "全て",
  "テント倉庫",
  "上屋",
  "スポーツ施設",
  "畜舎",
  "仮設建築物",
  "移動式テント",
  "ブース",
  "シェード",
  "日除け",
];

// 作業区分フィルターオプション
const SAGYOU_KUBUN_OPTIONS = [
  "全て",
  "構造検討",
  "構造検討済",
  "構造計算書",
  "構造計算書済",
  "作図",
  "作図済",
  "申請図",
  "申請図済",
  "対応完了",
];

export default function DesignProcessManagementPage() {
  const [records, setRecords] = useState<DesignRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedKubun, setSelectedKubun] = useState("全て");
  const [selectedSagyouKubun, setSelectedSagyouKubun] = useState("全て");
  const [selectedRecord, setSelectedRecord] = useState<DesignRequestRecord | null>(null);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // データ取得
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("pageSize", "100");

      if (searchText) {
        params.set("search", searchText);
      }
      if (selectedKubun !== "全て") {
        params.set("kubun", selectedKubun);
      }
      if (selectedSagyouKubun !== "全て") {
        params.set("sagyouKubun", selectedSagyouKubun);
      }

      const response = await fetch(`/api/design-request?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRecords(data.data.records);
        setTotal(data.data.total);
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
    } catch (err) {
      console.error("Error fetching records:", err);
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [searchText, selectedKubun, selectedSagyouKubun]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 検索ハンドラー
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  // 日付フォーマット
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // サイズフォーマット
  const formatSize = (record: DesignRequestRecord) => {
    const w = record.size_w;
    const l = record.size_l;
    const h = record.size_h;
    if (!w && !l && !h) return "-";
    return `W${w || "-"} × L${l || "-"} × H${h || "-"}m`;
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <PenTool className="w-6 h-6 text-blue-500" />
                設計依頼工程管理
              </h1>
              <p className="text-sm text-gray-500">
                設計部 &gt; 工程管理
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                全 {total.toLocaleString()} 件
              </span>
              <button
                onClick={fetchRecords}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="更新"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 検索・フィルターバー */}
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200">
          <form onSubmit={handleSearch} className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="案件番号・案件名で検索..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                showFilters
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              フィルター
              <ChevronDown className={`w-4 h-4 transition ${showFilters ? "rotate-180" : ""}`} />
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              検索
            </button>
          </form>

          {/* フィルターパネル */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">区分</label>
                <select
                  value={selectedKubun}
                  onChange={(e) => setSelectedKubun(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {KUBUN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作業区分</label>
                <select
                  value={selectedSagyouKubun}
                  onChange={(e) => setSelectedSagyouKubun(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SAGYOU_KUBUN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedKubun("全て");
                    setSelectedSagyouKubun("全て");
                    setSearchText("");
                  }}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                >
                  クリア
                </button>
              </div>
            </div>
          )}
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-hidden p-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden h-full flex flex-col">
            {/* テーブルヘッダー */}
            <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium text-gray-700">
                <div className="col-span-1">案件番号</div>
                <div className="col-span-2">案件名</div>
                <div className="col-span-1">区分</div>
                <div className="col-span-1">作業区分</div>
                <div className="col-span-1">担当者</div>
                <div className="col-span-1">サイズ</div>
                <div className="col-span-1">完了期日</div>
                <div className="col-span-1">建設地</div>
                <div className="col-span-1">添付</div>
                <div className="col-span-2 text-center">操作</div>
              </div>
            </div>

            {/* テーブルボディ */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FileText className="w-12 h-12 mb-2" />
                  <p>データがありません</p>
                </div>
              ) : (
                records.map((record) => (
                  <div
                    key={record.record_id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition items-center"
                  >
                    <div className="col-span-1">
                      <span className="text-sm font-mono text-blue-600">
                        {record.anken_bangou || "-"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-gray-900 line-clamp-2">
                        {record.anken_mei || "-"}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {record.kubun || "-"}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          SAGYOU_KUBUN_COLORS[record.sagyou_kubun] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {record.sagyou_kubun || "-"}
                      </span>
                    </div>
                    <div className="col-span-1">
                      {record.tantousha.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700 truncate">
                            {record.tantousha[0].en_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs text-gray-600">{formatSize(record)}</span>
                    </div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {formatDate(record.kanryo_kijitsu)}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">
                          {record.kensetsu_basho_todouhuken || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-2">
                        {record.tenpu_file.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            資料 {record.tenpu_file.length}
                          </span>
                        )}
                        {record.buzai_list.length > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            部材
                          </span>
                        )}
                        {record.kansei_zumen.length > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            図面
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center gap-2">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="詳細"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="部材リストアップロード"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        title="図面ダウンロード"
                        disabled={record.kansei_zumen.length === 0}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* 詳細モーダル */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">
                  設計依頼詳細 - {selectedRecord.anken_bangou}
                </h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div className="grid grid-cols-2 gap-6">
                  {/* 基本情報 */}
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">基本情報</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">案件名</p>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedRecord.anken_mei || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">区分</p>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedRecord.kubun || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">用途</p>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedRecord.youto || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">建物形状</p>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedRecord.tatemono_keijou || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* サイズ・場所 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">サイズ・場所</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">サイズ</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatSize(selectedRecord)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">建設場所</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedRecord.kensetsu_basho_todouhuken}
                          {selectedRecord.kensetsu_basho_ika}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 工程情報 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">工程情報</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">作業区分</p>
                        <span
                          className={`text-sm px-2 py-1 rounded-full ${
                            SAGYOU_KUBUN_COLORS[selectedRecord.sagyou_kubun] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {selectedRecord.sagyou_kubun || "-"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">完了期日</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedRecord.kanryo_kijitsu)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">構造完了(参考)</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedRecord.kouzou_kanryou)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">作図完了(参考)</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedRecord.sakuzu_kanryou)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 担当者情報 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">担当者</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">設計担当</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedRecord.tantousha.map((u) => u.en_name).join(", ") || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">営業担当</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedRecord.eigyou_tantousha.map((u) => u.en_name).join(", ") || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 添付ファイル */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">添付ファイル</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {selectedRecord.tenpu_file.length > 0 ? (
                        selectedRecord.tenpu_file.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">添付ファイルなし</p>
                      )}
                    </div>
                  </div>

                  {/* 備考 */}
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">備考</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedRecord.bikou || "備考なし"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
