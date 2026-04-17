"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { MainLayout } from "@/components/layout";
import type { BaiyakuInfo, SearchParams, SalesStatusFilter } from "@/types";

export default function BaiyakuSearchPage() {
  const router = useRouter();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    seiban: "",
    tantousha: "",
    anken_name: "",
    tokuisaki: "",
    juchu_date_from: "",
    juchu_date_to: "",
    uriage_date_from: "",
    uriage_date_to: "",
    sales_status: "juchu_zan", // デフォルトは受注残
  });
  const [results, setResults] = useState<BaiyakuInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchParams.seiban) params.set("seiban", searchParams.seiban);
      if (searchParams.tantousha)
        params.set("tantousha", searchParams.tantousha);
      if (searchParams.anken_name)
        params.set("anken_name", searchParams.anken_name);
      if (searchParams.tokuisaki)
        params.set("tokuisaki", searchParams.tokuisaki);
      if (searchParams.juchu_date_from) {
        params.set(
          "juchu_date_from",
          searchParams.juchu_date_from.replace(/-/g, "/")
        );
      }
      if (searchParams.juchu_date_to) {
        params.set(
          "juchu_date_to",
          searchParams.juchu_date_to.replace(/-/g, "/")
        );
      }
      if (searchParams.uriage_date_from) {
        params.set(
          "uriage_date_from",
          searchParams.uriage_date_from.replace(/-/g, "/")
        );
      }
      if (searchParams.uriage_date_to) {
        params.set(
          "uriage_date_to",
          searchParams.uriage_date_to.replace(/-/g, "/")
        );
      }
      if (searchParams.sales_status) {
        params.set("sales_status", searchParams.sales_status);
      }

      const response = await fetch(`/api/baiyaku?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "検索に失敗しました";
        setError(errorMsg);
      }
    } catch (err) {
      setError("検索中にエラーが発生しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBaiyaku = (baiyaku: BaiyakuInfo) => {
    window.open(`/baiyaku/${encodeURIComponent(baiyaku.seiban)}`, '_blank');
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString("ja-JP");
  };

  const getUriageDateLabel = () => {
    switch (searchParams.sales_status) {
      case "juchu_zan": return "売上見込日";
      case "uriagezumi": return "売上日";
      default: return "売上日";
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-y-auto">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800">売約情報検索</h1>
          <p className="text-sm text-gray-500">共通 &gt; 売約情報</p>
        </div>

        {/* 検索フォーム */}
        <div className="flex-shrink-0 px-4 py-3">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <h2 className="text-base font-bold mb-3 text-gray-800 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-500" />
              検索条件
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 mb-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  ステータス
                </label>
                <select
                  value={searchParams.sales_status || "juchu_zan"}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      sales_status: e.target.value as SalesStatusFilter,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                >
                  <option value="juchu_zan">受注残</option>
                  <option value="uriagezumi">売上済</option>
                  <option value="all">全て</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  製番
                </label>
                <input
                  type="text"
                  value={searchParams.seiban}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, seiban: e.target.value })
                  }
                  placeholder="部分一致"
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  営業担当者
                </label>
                <input
                  type="text"
                  value={searchParams.tantousha}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      tantousha: e.target.value,
                    })
                  }
                  placeholder="部分一致"
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  案件名
                </label>
                <input
                  type="text"
                  value={searchParams.anken_name}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      anken_name: e.target.value,
                    })
                  }
                  placeholder="部分一致"
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  得意先名
                </label>
                <input
                  type="text"
                  value={searchParams.tokuisaki}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      tokuisaki: e.target.value,
                    })
                  }
                  placeholder="部分一致"
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  受注日From
                </label>
                <input
                  type="date"
                  value={searchParams.juchu_date_from}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      juchu_date_from: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  受注日To
                </label>
                <input
                  type="date"
                  value={searchParams.juchu_date_to}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      juchu_date_to: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  {getUriageDateLabel()}From
                </label>
                <input
                  type="date"
                  value={searchParams.uriage_date_from}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      uriage_date_from: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                  {getUriageDateLabel()}To
                </label>
                <input
                  type="date"
                  value={searchParams.uriage_date_to}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      uriage_date_to: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Search className="w-4 h-4" />
              {loading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>

        {/* 検索結果 */}
        <div className="flex-shrink-0 px-4 pb-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2">
                <h3 className="text-base font-bold text-white">
                  検索結果: {results.length}件
                </h3>
              </div>

              {/* PC用テーブル */}
              <div className="hidden lg:block">
                <div className="bg-gray-50 border-b border-gray-200">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr>
                        <th className="w-[10%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          製番
                        </th>
                        <th className="w-[20%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          案件名
                        </th>
                        <th className="w-[16%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          得意先名
                        </th>
                        <th className="w-[10%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          営業担当者
                        </th>
                        <th className="w-[11%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          受注日
                        </th>
                        <th className="w-[11%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          売上見込日
                        </th>
                        <th className="w-[11%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          売上日
                        </th>
                        <th className="w-[11%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                          施工開始日
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full table-fixed">
                    <tbody className="divide-y divide-gray-100">
                      {results.map((item, index) => (
                        <tr
                          key={item.record_id}
                          onClick={() => handleSelectBaiyaku(item)}
                          className={`cursor-pointer transition-all duration-150 hover:bg-indigo-50 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="w-[10%] px-4 py-2.5 whitespace-nowrap text-sm font-bold text-indigo-600 hover:text-indigo-800">
                            {item.seiban}
                          </td>
                          <td className="w-[20%] px-4 py-2.5 text-sm text-gray-800 truncate">
                            {item.hinmei}
                            {item.hinmei2 && (
                              <span className="text-gray-500">
                                {" "}
                                / {item.hinmei2}
                              </span>
                            )}
                          </td>
                          <td className="w-[16%] px-4 py-2.5 text-sm text-gray-700 truncate">
                            {item.tokuisaki_atena1 || "-"}
                            {item.tokuisaki_atena2 && (
                              <span className="text-gray-500">
                                {" "}
                                / {item.tokuisaki_atena2}
                              </span>
                            )}
                          </td>
                          <td className="w-[10%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                            {item.tantousha}
                          </td>
                          <td className="w-[11%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                            {item.juchu_date || "-"}
                          </td>
                          <td className="w-[11%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                            {item.uriage_mikomi_date || "-"}
                          </td>
                          <td className="w-[11%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                            {item.uriage_date || "-"}
                          </td>
                          <td className="w-[11%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                            {formatDate(item.sekou_start_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* モバイル用カードリスト */}
              <div className="lg:hidden divide-y divide-gray-100">
                {results.map((item, index) => (
                  <div
                    key={item.record_id}
                    onClick={() => handleSelectBaiyaku(item)}
                    className={`px-4 py-3 cursor-pointer active:bg-indigo-50 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-indigo-600">
                        {item.seiban}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.tantousha}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 truncate">
                      {item.hinmei}
                      {item.hinmei2 && (
                        <span className="text-gray-500"> / {item.hinmei2}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {item.tokuisaki_atena1 || "-"}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                      {item.juchu_date && (
                        <span>受注: {item.juchu_date}</span>
                      )}
                      {item.uriage_mikomi_date && (
                        <span>見込: {item.uriage_mikomi_date}</span>
                      )}
                      {item.uriage_date && (
                        <span>売上: {item.uriage_date}</span>
                      )}
                      {item.sekou_start_date && (
                        <span>施工: {formatDate(item.sekou_start_date)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-indigo-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">
                検索条件を入力して検索してください
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
