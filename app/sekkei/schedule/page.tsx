"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  FileText,
  MapPin,
} from "lucide-react";
import { DesignRequestRecord } from "@/lib/design-request-tables";
import { addDays, startOfWeek, format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

// ステータス色
const STATUS_COLORS: Record<string, string> = {
  構造検討: "bg-yellow-200 border-yellow-400",
  構造検討済: "bg-green-200 border-green-400",
  構造計算書: "bg-yellow-200 border-yellow-400",
  構造計算書済: "bg-green-200 border-green-400",
  作図: "bg-blue-200 border-blue-400",
  作図済: "bg-green-200 border-green-400",
  申請図: "bg-purple-200 border-purple-400",
  申請図済: "bg-green-200 border-green-400",
  対応完了: "bg-green-200 border-green-400",
};

export default function SchedulePage() {
  const [records, setRecords] = useState<DesignRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

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

  // 週の日付を取得
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // 月曜始まり
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // 担当者一覧を取得
  const users = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; email: string }>();
    records.forEach((record) => {
      record.tantousha.forEach((user) => {
        const key = user.id || user.email;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: user.id,
            name: user.en_name,
            email: user.email,
          });
        }
      });
    });
    return Array.from(userMap.values());
  }, [records]);

  // フィルタリングされたレコード
  const filteredRecords = useMemo(() => {
    if (!selectedUser) return records;
    return records.filter((record) =>
      record.tantousha.some((u) => u.id === selectedUser || u.email === selectedUser)
    );
  }, [records, selectedUser]);

  // 日付ごとのレコードを取得
  const getRecordsForDate = (date: Date) => {
    return filteredRecords.filter((record) => {
      if (!record.taiou_bi && !record.kanryo_kijitsu) return false;

      // 対応日で判定
      if (record.taiou_bi) {
        const taiouDate = new Date(record.taiou_bi);
        if (isSameDay(taiouDate, date)) return true;
      }

      // 完了期日で判定
      if (record.kanryo_kijitsu) {
        const kanryoDate = new Date(record.kanryo_kijitsu);
        if (isSameDay(kanryoDate, date)) return true;
      }

      return false;
    });
  };

  // 前週へ
  const goToPrevWeek = () => {
    setCurrentDate((prev) => addDays(prev, -7));
  };

  // 次週へ
  const goToNextWeek = () => {
    setCurrentDate((prev) => addDays(prev, 7));
  };

  // 今週へ
  const goToThisWeek = () => {
    setCurrentDate(new Date());
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-500" />
                スケジュール確認
              </h1>
              <p className="text-sm text-gray-500">設計部 &gt; スケジュール</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全員</option>
                {users.map((user) => (
                  <option key={user.id || user.email} value={user.id || user.email}>
                    {user.name}
                  </option>
                ))}
              </select>
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

        {/* カレンダーナビゲーション */}
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToThisWeek}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                今週
              </button>
              <button
                onClick={goToNextWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              {format(weekDays[0], "yyyy年M月d日", { locale: ja })} -{" "}
              {format(weekDays[6], "M月d日", { locale: ja })}
            </h2>
            <div className="w-32"></div>
          </div>
        </div>

        {/* カレンダー本体 */}
        <main className="flex-1 overflow-hidden p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden h-full flex flex-col">
            {/* 曜日ヘッダー */}
            <div className="flex-shrink-0 grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const dayOfWeek = format(day, "E", { locale: ja });
                const isSunday = idx === 6;
                const isSaturday = idx === 5;
                return (
                  <div
                    key={idx}
                    className={`p-3 text-center border-r last:border-r-0 ${
                      isToday ? "bg-blue-50" : "bg-gray-50"
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        isSunday
                          ? "text-red-500"
                          : isSaturday
                          ? "text-blue-500"
                          : "text-gray-500"
                      }`}
                    >
                      {dayOfWeek}
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        isToday
                          ? "text-blue-600"
                          : isSunday
                          ? "text-red-600"
                          : isSaturday
                          ? "text-blue-600"
                          : "text-gray-800"
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* スケジュール */}
            <div className="flex-1 grid grid-cols-7 overflow-hidden">
              {weekDays.map((day, idx) => {
                const dayRecords = getRecordsForDate(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={idx}
                    className={`border-r last:border-r-0 overflow-y-auto p-2 ${
                      isToday ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {dayRecords.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        予定なし
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayRecords.map((record) => (
                          <div
                            key={record.record_id}
                            className={`p-2 rounded-lg border text-xs ${
                              STATUS_COLORS[record.sagyou_kubun] ||
                              "bg-gray-100 border-gray-300"
                            }`}
                          >
                            <p className="font-mono text-gray-600 mb-1">
                              {record.anken_bangou}
                            </p>
                            <p className="font-medium text-gray-900 line-clamp-2 mb-1">
                              {record.anken_mei}
                            </p>
                            <div className="flex items-center gap-1 text-gray-600">
                              <User className="w-3 h-3" />
                              <span className="truncate">
                                {record.tantousha[0]?.en_name || "-"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-500 mt-1">
                              <span className="px-1.5 py-0.5 bg-white/50 rounded text-xs">
                                {record.sagyou_kubun || "-"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
