"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Calendar,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  User,
} from "lucide-react";
import { DesignRequestRecord, LarkUser } from "@/lib/design-request-tables";

// 負荷レベルの閾値と色
const LOAD_LEVELS = {
  low: { max: 3, color: "bg-green-500", label: "余裕あり" },
  medium: { max: 6, color: "bg-yellow-500", label: "適正" },
  high: { max: 10, color: "bg-orange-500", label: "高負荷" },
  overload: { max: Infinity, color: "bg-red-500", label: "過負荷" },
};

interface TantoushaLoad {
  user: LarkUser;
  total: number;
  inProgress: number;
  pending: number;
  completed: number;
  records: DesignRequestRecord[];
}

export default function LoadManagementPage() {
  const [records, setRecords] = useState<DesignRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTantousha, setSelectedTantousha] = useState<string | null>(null);

  // データ取得
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/design-request?pageSize=500");
      const data = await response.json();

      if (data.success) {
        setRecords(data.data.records);
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
    } catch (err) {
      console.error("Error fetching records:", err);
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 担当者別の負荷を集計
  const tantoushaLoads = useMemo(() => {
    const loadMap = new Map<string, TantoushaLoad>();

    records.forEach((record) => {
      record.tantousha.forEach((user) => {
        const key = user.id || user.email;
        if (!loadMap.has(key)) {
          loadMap.set(key, {
            user,
            total: 0,
            inProgress: 0,
            pending: 0,
            completed: 0,
            records: [],
          });
        }

        const load = loadMap.get(key)!;
        load.total++;
        load.records.push(record);

        // ステータス別にカウント
        const status = record.sagyou_kubun;
        if (status?.includes("済") || status === "対応完了") {
          load.completed++;
        } else if (status === "対応不要" || status === "対応不可") {
          // カウントしない
        } else {
          load.inProgress++;
        }
      });
    });

    return Array.from(loadMap.values()).sort((a, b) => b.inProgress - a.inProgress);
  }, [records]);

  // 負荷レベルを取得
  const getLoadLevel = (count: number) => {
    if (count <= LOAD_LEVELS.low.max) return LOAD_LEVELS.low;
    if (count <= LOAD_LEVELS.medium.max) return LOAD_LEVELS.medium;
    if (count <= LOAD_LEVELS.high.max) return LOAD_LEVELS.high;
    return LOAD_LEVELS.overload;
  };

  // 日付フォーマット
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleDateString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 選択された担当者のレコード
  const selectedRecords = useMemo(() => {
    if (!selectedTantousha) return [];
    const load = tantoushaLoads.find(
      (l) => l.user.id === selectedTantousha || l.user.email === selectedTantousha
    );
    return load?.records || [];
  }, [selectedTantousha, tantoushaLoads]);

  return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-500" />
                課員負荷管理
              </h1>
              <p className="text-sm text-gray-500">設計部 &gt; 負荷管理</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  余裕
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  適正
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  高負荷
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  過負荷
                </span>
              </div>
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

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-hidden p-4 flex gap-4">
          {/* 担当者一覧 */}
          <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800">担当者別負荷状況</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                tantoushaLoads.map((load) => {
                  const level = getLoadLevel(load.inProgress);
                  const isSelected =
                    selectedTantousha === load.user.id ||
                    selectedTantousha === load.user.email;
                  return (
                    <button
                      key={load.user.id || load.user.email}
                      onClick={() =>
                        setSelectedTantousha(load.user.id || load.user.email)
                      }
                      className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition text-left ${
                        isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {load.user.en_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {load.user.email?.split("@")[0]}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>対応中: {load.inProgress}件</span>
                            <span className={`px-2 py-0.5 rounded-full text-white ${level.color}`}>
                              {level.label}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${level.color}`}
                              style={{
                                width: `${Math.min(100, (load.inProgress / 10) * 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          進行中: {load.inProgress}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          完了: {load.completed}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 詳細パネル */}
          <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800">
                {selectedTantousha
                  ? `${
                      tantoushaLoads.find(
                        (l) =>
                          l.user.id === selectedTantousha ||
                          l.user.email === selectedTantousha
                      )?.user.en_name || ""
                    } の担当案件`
                  : "担当者を選択してください"}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTantousha ? (
                selectedRecords.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {selectedRecords.map((record) => (
                      <div
                        key={record.record_id}
                        className="p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono text-blue-600">
                                {record.anken_bangou}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  record.sagyou_kubun?.includes("済")
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {record.sagyou_kubun || "-"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 line-clamp-1">
                              {record.anken_mei}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                期日: {formatDate(record.kanryo_kijitsu)}
                              </span>
                              <span>{record.kubun}</span>
                              <span>{record.kensetsu_basho_todouhuken}</span>
                            </div>
                          </div>
                          {record.kanryo_kijitsu &&
                            new Date(record.kanryo_kijitsu) < new Date() &&
                            !record.sagyou_kubun?.includes("済") && (
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <BarChart3 className="w-12 h-12 mb-2" />
                    <p>担当案件がありません</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Users className="w-12 h-12 mb-2" />
                  <p>左のリストから担当者を選択してください</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
  );
}
