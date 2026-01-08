"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, LogOut, User } from "lucide-react";
import Image from "next/image";
import type { BaiyakuInfo, SearchParams } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    seiban: "",
    tantousha: "",
    anken_name: "",
    tokuisaki: "",
    juchu_date_from: "",
    juchu_date_to: "",
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
      if (searchParams.tantousha) params.set("tantousha", searchParams.tantousha);
      if (searchParams.anken_name) params.set("anken_name", searchParams.anken_name);
      if (searchParams.tokuisaki) params.set("tokuisaki", searchParams.tokuisaki);
      // 日付フォーマット変換: YYYY-MM-DD → YYYY/MM/DD
      if (searchParams.juchu_date_from) {
        params.set("juchu_date_from", searchParams.juchu_date_from.replace(/-/g, "/"));
      }
      if (searchParams.juchu_date_to) {
        params.set("juchu_date_to", searchParams.juchu_date_to.replace(/-/g, "/"));
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
    router.push(`/baiyaku/${encodeURIComponent(baiyaku.seiban)}`);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString("ja-JP");
  };

  // 認証チェック - 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // ローディング中の表示
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto"></div>
          <p className="mt-4 text-white text-xl font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合は何も表示しない（リダイレクト中）
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* ヘッダー（固定） */}
      <header className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 shadow-lg z-50">
        <div className="w-full px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/80 rounded-lg p-1.5">
                <Image
                  src="/membry-logo.png"
                  alt="Membry Logo"
                  width={100}
                  height={32}
                  className="h-8 w-auto"
                />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                売約情報
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="flex items-center gap-1.5 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{session.user.name || session.user.email}</span>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 font-medium"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 検索フォーム（固定） */}
      <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
          <h2 className="text-base font-bold mb-3 text-gray-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-500" />
            検索条件
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                製番
              </label>
              <input
                type="text"
                value={searchParams.seiban}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, seiban: e.target.value })
                }
                placeholder="部分一致"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                営業担当者
              </label>
              <input
                type="text"
                value={searchParams.tantousha}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, tantousha: e.target.value })
                }
                placeholder="部分一致"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                案件名
              </label>
              <input
                type="text"
                value={searchParams.anken_name}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, anken_name: e.target.value })
                }
                placeholder="部分一致"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                得意先名
              </label>
              <input
                type="text"
                value={searchParams.tokuisaki}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, tokuisaki: e.target.value })
                }
                placeholder="部分一致"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                受注日（From）
              </label>
              <input
                type="date"
                value={searchParams.juchu_date_from}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, juchu_date_from: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                受注日（To）
              </label>
              <input
                type="date"
                value={searchParams.juchu_date_to}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, juchu_date_to: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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

      {/* 検索結果（スクロール可能） */}
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        {/* 検索結果 */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2">
              <h3 className="text-base font-bold text-white">
                検索結果: {results.length}件
              </h3>
            </div>
            {/* テーブルヘッダー（固定） */}
            <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
              <table className="w-full table-fixed">
                <thead>
                  <tr>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      製番
                    </th>
                    <th className="w-[25%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      案件名
                    </th>
                    <th className="w-[20%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      得意先名
                    </th>
                    <th className="w-[13%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      営業担当者
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      受注日
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-bold text-gray-700">
                      施工開始日
                    </th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* テーブルボディ（スクロール可能） */}
            <div className="flex-1 overflow-y-auto">
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
                      <td className="w-[12%] px-4 py-2.5 whitespace-nowrap text-sm font-bold text-indigo-600 hover:text-indigo-800">
                        {item.seiban}
                      </td>
                      <td className="w-[25%] px-4 py-2.5 text-sm text-gray-800 truncate">
                        {item.hinmei}
                        {item.hinmei2 && <span className="text-gray-500"> / {item.hinmei2}</span>}
                      </td>
                      <td className="w-[20%] px-4 py-2.5 text-sm text-gray-700 truncate">
                        {item.tokuisaki_atena1 || "-"}
                        {item.tokuisaki_atena2 && <span className="text-gray-500"> / {item.tokuisaki_atena2}</span>}
                      </td>
                      <td className="w-[13%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                        {item.tantousha}
                      </td>
                      <td className="w-[15%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                        {item.juchu_date || "-"}
                      </td>
                      <td className="w-[15%] px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(item.sekou_start_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 検索結果なし */}
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
      </main>
    </div>
  );
}
