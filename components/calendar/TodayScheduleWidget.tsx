"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, MapPin, Loader2, RefreshCw, ChevronLeft, ChevronRight, X, FileText, Video, Building2 } from "lucide-react";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  meeting_rooms?: string[];
  vchat?: string;
  status: string;
}

interface ScheduleData {
  events: CalendarEvent[];
  date: string;
  dateStr: string;
  isToday: boolean;
  message?: string;
}

// 日付を YYYY-MM-DD 形式に変換
function formatDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

// 日付を1日進める/戻す
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateStr(date);
}

// イベント詳細モーダル
function EventDetailModal({
  event,
  date,
  onClose,
}: {
  event: CalendarEvent;
  date: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダル */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-lg font-bold text-white break-words">
                {event.summary}
              </h3>
              <p className="text-blue-100 text-sm mt-1">{date}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* 時間 */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">時間</p>
              {event.is_all_day ? (
                <p className="text-gray-800 font-medium">終日</p>
              ) : (
                <p className="text-gray-800 font-medium">
                  {event.start_time} 〜 {event.end_time}
                </p>
              )}
            </div>
          </div>

          {/* 会議室 */}
          {event.meeting_rooms && event.meeting_rooms.length > 0 && (
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500">会議室</p>
                <p className="text-gray-800">{event.meeting_rooms.join(", ")}</p>
              </div>
            </div>
          )}

          {/* 場所 */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500">場所</p>
                <p className="text-gray-800">{event.location}</p>
              </div>
            </div>
          )}

          {/* ビデオ会議 */}
          {event.vchat && (
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">ビデオ会議</p>
                <a
                  href={event.vchat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  会議に参加
                </a>
              </div>
            </div>
          )}

          {/* 説明 */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">詳細</p>
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                  {event.description}
                </p>
              </div>
            </div>
          )}

          {/* 情報がない場合 */}
          {!event.description && !event.location && !event.vchat && (!event.meeting_rooms || event.meeting_rooms.length === 0) && (
            <p className="text-gray-400 text-sm text-center py-4">
              詳細情報はありません
            </p>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export function TodayScheduleWidget() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDateStr, setCurrentDateStr] = useState<string>(formatDateStr(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchSchedule = useCallback(async (dateStr?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = dateStr ? `/api/calendar/today?date=${dateStr}` : "/api/calendar/today";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        if (result.data.dateStr) {
          setCurrentDateStr(result.data.dateStr);
        }
      } else {
        setError(result.error || "予定の取得に失敗しました");
      }
    } catch (err) {
      setError("予定の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // 前の日へ
  const goToPreviousDay = () => {
    const newDate = addDays(currentDateStr, -1);
    fetchSchedule(newDate);
  };

  // 次の日へ
  const goToNextDay = () => {
    const newDate = addDays(currentDateStr, 1);
    fetchSchedule(newDate);
  };

  // 今日へ戻る
  const goToToday = () => {
    const today = formatDateStr(new Date());
    fetchSchedule(today);
  };

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
            onClick={() => fetchSchedule(currentDateStr)}
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
    <>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">
                  {data?.isToday ? "本日の予定" : "予定"}
                </h3>
                <p className="text-blue-100 text-sm">{data?.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* 今日ボタン（今日以外の日を表示している場合） */}
              {!data?.isToday && (
                <button
                  onClick={goToToday}
                  className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
                  title="今日に戻る"
                >
                  今日
                </button>
              )}
              <button
                onClick={() => fetchSchedule(currentDateStr)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="更新"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* 日付ナビゲーション */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="前の日"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-medium min-w-[100px] text-center">
              {data?.date?.split("日")[0]}日
            </span>
            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="次の日"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* イベント一覧 */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {data?.events && data.events.length > 0 ? (
            <div className="space-y-3">
              {data.events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full flex gap-4 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors text-left cursor-pointer"
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
                        <span className="truncate">{event.location}</span>
                      </p>
                    )}
                    {event.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {event.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {data?.isToday ? "本日の予定はありません" : "この日の予定はありません"}
              </p>
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
              {data.events.length}件の予定（クリックで詳細）
            </p>
          </div>
        )}
      </div>

      {/* 詳細モーダル */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          date={data?.date || ""}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
