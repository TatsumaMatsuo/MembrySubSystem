"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Loader2, RefreshCw } from "lucide-react";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  status: string;
}

interface TodayScheduleData {
  events: CalendarEvent[];
  date: string;
  message?: string;
}

export function TodayScheduleWidget() {
  const [data, setData] = useState<TodayScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/calendar/today");
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "予定の取得に失敗しました");
      }
    } catch (err) {
      setError("予定の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchSchedule}
            className="text-blue-500 hover:text-blue-600 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">本日の予定</h3>
              <p className="text-blue-100 text-sm">{data?.date}</p>
            </div>
          </div>
          <button
            onClick={fetchSchedule}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="更新"
          >
            <RefreshCw className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* イベント一覧 */}
      <div className="p-4 max-h-80 overflow-y-auto">
        {data?.events && data.events.length > 0 ? (
          <div className="space-y-3">
            {data.events.map((event) => (
              <div
                key={event.id}
                className="flex gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* 時間 */}
                <div className="flex-shrink-0 w-20 text-center">
                  {event.is_all_day ? (
                    <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      終日
                    </span>
                  ) : (
                    <div className="text-sm">
                      <div className="font-bold text-gray-800">{event.start_time}</div>
                      <div className="text-gray-400">〜</div>
                      <div className="text-gray-600">{event.end_time}</div>
                    </div>
                  )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 truncate">{event.summary}</h4>
                  {event.location && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">本日の予定はありません</p>
            {data?.message && (
              <p className="text-gray-400 text-sm mt-2">{data.message}</p>
            )}
          </div>
        )}
      </div>

      {/* フッター */}
      {data?.events && data.events.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-sm text-gray-500 text-center">
            {data.events.length}件の予定
          </p>
        </div>
      )}
    </div>
  );
}
