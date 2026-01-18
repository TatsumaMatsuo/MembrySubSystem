"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Calendar,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  RefreshCw,
  Info,
} from "lucide-react";

interface SnapshotResult {
  success: boolean;
  targetMonth: string;
  dryRun: boolean;
  summary?: {
    totalBacklogRecords: number;
    uniqueTantousha: number;
    savedRecords: number;
    errorCount: number;
  };
  snapshots?: { tantousha: string; count: number }[];
  duration?: string;
  errors?: string[];
  error?: string;
}

interface SnapshotStatus {
  success: boolean;
  currentMonth: string;
  previousMonth: string;
  snapshotTableConfigured: boolean;
  monthlyData: {
    yearMonth: string;
    totalBacklog: number;
    tantoushaCount: number;
  }[];
  totalRecords: number;
}

export default function BatchManagementPage() {
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [status, setStatus] = useState<SnapshotStatus | null>(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [dryRun, setDryRun] = useState(true);

  // 前月のYYYYMM形式を取得
  const getPreviousMonthYYYYMM = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  };

  // ステータス取得
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/batch/monthly-order-snapshot");
      const data = await response.json();
      setStatus(data);
      if (!targetMonth) {
        setTargetMonth(data.previousMonth || getPreviousMonthYYYYMM());
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // バッチ実行
  const executeSnapshot = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/batch/monthly-order-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMonth,
          dryRun,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success && !dryRun) {
        // 成功した場合はステータスを更新
        await fetchStatus();
      }
    } catch (error) {
      setResult({
        success: false,
        targetMonth,
        dryRun,
        error: "バッチ実行に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  // YYYYMM形式を表示用に変換
  const formatYearMonth = (ym: string) => {
    if (!ym || ym.length !== 6) return ym;
    return `${ym.slice(0, 4)}年${parseInt(ym.slice(4), 10)}月`;
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            バッチ処理管理
          </h1>
          <p className="text-sm text-gray-500">
            管理 &gt; バッチ処理管理
          </p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 月次受注残スナップショット */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  月次受注残スナップショット
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  担当者別の受注残件数を月次で保存し、納期変更率の算出に使用します
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* 自動実行スケジュール */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-800">自動実行スケジュール</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        毎月21日 9:00（JST）に前月分のスナップショットを自動作成します
                      </p>
                    </div>
                  </div>
                </div>

                {/* 手動実行フォーム */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-4">手動実行</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        対象年月（YYYYMM）
                      </label>
                      <input
                        type="text"
                        value={targetMonth}
                        onChange={(e) => setTargetMonth(e.target.value)}
                        placeholder="例: 202501"
                        maxLength={6}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        実行モード
                      </label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={dryRun}
                            onChange={() => setDryRun(true)}
                            className="text-indigo-600"
                          />
                          <span className="text-sm text-gray-700">プレビュー（保存しない）</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={!dryRun}
                            onChange={() => setDryRun(false)}
                            className="text-indigo-600"
                          />
                          <span className="text-sm text-gray-700">本番実行</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={executeSnapshot}
                      disabled={loading || !targetMonth}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {dryRun ? "プレビュー実行" : "スナップショット作成"}
                    </button>
                  </div>
                </div>

                {/* 実行結果 */}
                {result && (
                  <div className={`rounded-lg p-4 ${result.success ? "bg-green-50" : "bg-red-50"}`}>
                    <div className="flex items-start gap-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
                          {result.success
                            ? result.dryRun
                              ? "プレビュー完了"
                              : "スナップショット作成完了"
                            : "エラーが発生しました"}
                        </h3>

                        {result.success && result.summary && (
                          <div className="mt-2 text-sm space-y-1">
                            <p className="text-green-700">
                              対象月: {formatYearMonth(result.targetMonth)}
                            </p>
                            <p>受注残件数: {result.summary.totalBacklogRecords.toLocaleString()}件</p>
                            <p>担当者数: {result.summary.uniqueTantousha}名</p>
                            {!result.dryRun && (
                              <p>保存件数: {result.summary.savedRecords}件</p>
                            )}
                            <p className="text-gray-500">処理時間: {result.duration}</p>
                          </div>
                        )}

                        {result.success && result.snapshots && result.snapshots.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">担当者別（上位10名）:</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {result.snapshots.slice(0, 10).map((s, i) => (
                                <div key={i} className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                  <span>{s.tantousha}</span>
                                  <span className="font-medium">{s.count}件</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.error && (
                          <p className="mt-2 text-sm text-red-700">{result.error}</p>
                        )}

                        {result.errors && result.errors.length > 0 && (
                          <div className="mt-2 text-sm text-red-700">
                            <p>エラー詳細:</p>
                            <ul className="list-disc list-inside">
                              {result.errors.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 過去のスナップショット */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-800">保存済みスナップショット</h3>
                    <button
                      onClick={fetchStatus}
                      disabled={statusLoading}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <RefreshCw className={`w-4 h-4 ${statusLoading ? "animate-spin" : ""}`} />
                      更新
                    </button>
                  </div>

                  {statusLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  ) : status?.snapshotTableConfigured === false ? (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-yellow-800">
                            スナップショットテーブルが設定されていません
                          </p>
                          <p className="text-xs text-yellow-700 mt-1">
                            環境変数 <code className="bg-yellow-100 px-1 rounded">LARK_TABLE_ORDER_SNAPSHOT</code> を設定してください
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : status?.monthlyData && status.monthlyData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">年月</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">受注残合計</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">担当者数</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {status.monthlyData.map((m) => (
                            <tr key={m.yearMonth} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{formatYearMonth(m.yearMonth)}</td>
                              <td className="px-3 py-2 text-right">{m.totalBacklog.toLocaleString()}件</td>
                              <td className="px-3 py-2 text-right">{m.tantoushaCount}名</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      スナップショットデータがありません
                    </p>
                  )}
                </div>

                {/* 計算式の説明 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-gray-500" />
                    納期変更率の計算式
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">納期変更率</span> = 納期変更回数 ÷ 受注残件数
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      ※ 受注残件数は、売上済フラグ=falseの案件数を月次でスナップショットしたものを使用します
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
