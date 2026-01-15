import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

// 指定日の開始・終了タイムスタンプ（秒）
function getDateRange(dateStr?: string): { start: number; end: number; targetDate: Date } {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  // 無効な日付の場合は今日を使用
  if (isNaN(targetDate.getTime())) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      targetDate: now,
    };
  }
  const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    targetDate,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // セッションからユーザーのアクセストークンを取得
    const userAccessToken = (session as any).accessToken;
    if (!userAccessToken) {
      console.error("[calendar] No user access token in session");
      return NextResponse.json({
        success: true,
        data: {
          events: [],
          message: "カレンダーへのアクセス権限がありません。再ログインしてください。",
        },
      });
    }

    // クエリパラメータから日付を取得
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const { start, end, targetDate } = getDateRange(dateParam || undefined);

    // Lark APIドメイン（lark-clientと同じドメインを使用）
    const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";

    console.log("[calendar] Calling API:", {
      domain: larkDomain,
      start,
      end,
      hasToken: !!userAccessToken,
      tokenLength: userAccessToken?.length,
    });

    // まずカレンダー一覧を取得
    const calendarListResponse = await fetch(
      `${larkDomain}/open-apis/calendar/v4/calendars`,
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const calendarListResult = await calendarListResponse.json();

    console.log("[calendar] Calendar list response:", {
      code: calendarListResult.code,
      msg: calendarListResult.msg,
      calendars: calendarListResult.data?.calendar_list?.length,
    });

    if (calendarListResult.code !== 0) {
      console.error("[calendar] Calendar list error:", calendarListResult);

      // エラーメッセージを判定
      let errorMessage = "カレンダーの取得に失敗しました";
      if (calendarListResult.code === 99991672 || calendarListResult.msg?.includes("scope")) {
        errorMessage = "カレンダーへのアクセス権限がありません。Lark Appにcalendar:calendar:readonly権限（用户身份）が必要です。";
      } else if (calendarListResult.code === 190006) {
        errorMessage = "テナント設定エラー。管理者にお問い合わせください。";
      } else if (calendarListResult.code === 99991663 || calendarListResult.code === 99991664) {
        errorMessage = "セッションが切れました。再ログインしてください。";
      }

      return NextResponse.json({
        success: true,
        data: {
          events: [],
          message: errorMessage,
        },
      });
    }

    // ユーザー自身のプライマリカレンダーを探す
    // role: "owner" かつ type: "primary" のカレンダーを優先
    const calendars = calendarListResult.data?.calendar_list || [];
    const userName = session.user.name || session.user.email;

    // 1. まずオーナーのプライマリカレンダーを探す
    let primaryCalendar = calendars.find((cal: any) =>
      cal.type === "primary" && cal.role === "owner"
    );

    // 2. 見つからない場合、ユーザー名と一致するカレンダーを探す
    if (!primaryCalendar && userName) {
      primaryCalendar = calendars.find((cal: any) =>
        cal.summary === userName || cal.summary?.includes(userName)
      );
    }

    // 3. それでも見つからない場合、最初のオーナーカレンダーを使う
    if (!primaryCalendar) {
      primaryCalendar = calendars.find((cal: any) => cal.role === "owner");
    }

    // 4. 最後の手段として最初のプライマリを使う
    if (!primaryCalendar) {
      primaryCalendar = calendars.find((cal: any) => cal.type === "primary") || calendars[0];
    }

    if (!primaryCalendar) {
      return NextResponse.json({
        success: true,
        data: {
          events: [],
          message: "カレンダーが見つかりません",
        },
      });
    }

    console.log("[calendar] Using calendar:", {
      id: primaryCalendar.calendar_id,
      summary: primaryCalendar.summary,
      type: primaryCalendar.type,
      role: primaryCalendar.role,
      userName,
    });

    // カレンダーの予定一覧を取得
    const eventsResponse = await fetch(
      `${larkDomain}/open-apis/calendar/v4/calendars/${primaryCalendar.calendar_id}/events?start_time=${start}&end_time=${end}&page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await eventsResponse.json();

    console.log("[calendar] Events response:", {
      code: result.code,
      msg: result.msg,
      items: result.data?.items?.length,
    });

    if (result.code !== 0) {
      console.error("[calendar] Events API Error:", result);
      return NextResponse.json({
        success: true,
        data: {
          events: [],
          message: result.msg || "予定の取得に失敗しました",
        },
      });
    }

    // 各イベントの詳細を取得
    const eventIds = (result.data?.items || [])
      .filter((e: any) => e.status !== "cancelled" && e.status !== "removed")
      .map((e: any) => e.event_id);

    console.log("[calendar] Fetching details for events:", eventIds.length);

    // 並列でイベント詳細と参加者を取得（最大10件）
    const eventDetailsPromises = eventIds.slice(0, 10).map(async (eventId: string) => {
      try {
        // イベント詳細を取得
        const detailResponse = await fetch(
          `${larkDomain}/open-apis/calendar/v4/calendars/${primaryCalendar.calendar_id}/events/${eventId}?need_meeting_rooms=true`,
          {
            headers: {
              Authorization: `Bearer ${userAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        const detailResult = await detailResponse.json();

        if (detailResult.code !== 0) {
          return null;
        }

        const event = detailResult.data?.event;

        // 参加者を取得（会議室はresourceタイプの参加者として含まれる）
        try {
          const attendeesResponse = await fetch(
            `${larkDomain}/open-apis/calendar/v4/calendars/${primaryCalendar.calendar_id}/events/${eventId}/attendees?page_size=50`,
            {
              headers: {
                Authorization: `Bearer ${userAccessToken}`,
                "Content-Type": "application/json",
              },
            }
          );
          const attendeesResult = await attendeesResponse.json();

          if (attendeesResult.code === 0 && attendeesResult.data?.items) {
            // 会議室タイプの参加者を抽出
            const meetingRooms = attendeesResult.data.items
              .filter((a: any) => a.type === "resource" || a.type === "meeting_room")
              .map((a: any) => ({
                name: a.display_name || a.resource_name || a.attendee_id,
                id: a.attendee_id,
              }));

            console.log(`[calendar] Attendees for ${event.summary}:`, {
              total: attendeesResult.data.items.length,
              meetingRooms,
              allTypes: attendeesResult.data.items.map((a: any) => ({ type: a.type, name: a.display_name })),
            });

            // イベントに会議室情報を追加
            event.meeting_rooms_from_attendees = meetingRooms;
          }
        } catch (attendeeError) {
          console.error("[calendar] Error fetching attendees:", eventId, attendeeError);
        }

        return event;
      } catch (e) {
        console.error("[calendar] Error fetching event detail:", eventId, e);
        return null;
      }
    });

    const eventDetails = (await Promise.all(eventDetailsPromises)).filter(Boolean);
    console.log("[calendar] Got event details:", eventDetails.length);

    // すべてのイベントの構造をログに出力（会議室関連フィールドを詳細に）
    eventDetails.forEach((event: any, index: number) => {
      // イベントの全キーを出力して会議室関連フィールドを探す
      const allKeys = Object.keys(event);
      console.log(`[calendar] Event ${index + 1} (${event.summary}):`, {
        allKeys,
        location: event.location,
        meeting_rooms: event.meeting_rooms,
        // 他の可能性のあるフィールド
        rooms: event.rooms,
        room: event.room,
        meeting_room: event.meeting_room,
        venue: event.venue,
        // 参加者情報（会議室が参加者として含まれている可能性）
        attendees: event.attendees,
      });
    });

    // 対象日の日付文字列を取得（終日イベント用）
    const targetDateStr = targetDate.toISOString().split("T")[0]; // "YYYY-MM-DD"

    // 対象日のイベントのみをフィルタリングして整形
    const events = eventDetails
      .filter((event: any) => {
        // キャンセル・削除されたイベントを除外
        if (event.status === "cancelled" || event.status === "removed") {
          console.log("[calendar] Skipping cancelled event:", event.summary);
          return false;
        }

        // 終日イベントの場合
        if (event.start_time?.date) {
          // 終日イベントの日付が対象日と一致するか確認
          return event.start_time.date === targetDateStr;
        }

        // 時間指定イベントの場合
        if (event.start_time?.timestamp) {
          const eventStart = Number(event.start_time.timestamp);
          const eventEnd = event.end_time?.timestamp ? Number(event.end_time.timestamp) : eventStart;

          // イベントが今日の範囲と重なっているか確認
          return eventStart <= end && eventEnd >= start;
        }

        return false;
      })
      .map((event: any) => {
        // 会議室情報を取得（meeting_rooms配列または参加者から）
        let meetingRoomNames: string[] = [];
        if (event.meeting_rooms && Array.isArray(event.meeting_rooms)) {
          meetingRoomNames = event.meeting_rooms
            .map((room: any) => room.meeting_room_name || room.name)
            .filter(Boolean);
        }
        // 参加者APIから取得した会議室情報を使用
        if (meetingRoomNames.length === 0 && event.meeting_rooms_from_attendees) {
          meetingRoomNames = event.meeting_rooms_from_attendees
            .map((room: any) => room.name)
            .filter(Boolean);
        }

        // 場所情報（location.nameのみ、会議室は別フィールド）
        const locationName = event.location?.name || "";

        return {
          id: event.event_id,
          summary: event.summary || "（タイトルなし）",
          description: event.description || "",
          start_time: event.start_time?.timestamp
            ? new Date(Number(event.start_time.timestamp) * 1000).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : event.start_time?.date || "",
          end_time: event.end_time?.timestamp
            ? new Date(Number(event.end_time.timestamp) * 1000).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : event.end_time?.date || "",
          is_all_day: !!event.start_time?.date,
          location: locationName,
          meeting_rooms: meetingRoomNames,
          status: event.status,
          color: event.color,
          vchat: event.vchat?.meeting_url || event.vchat?.video_meeting?.meeting_url || "",
        };
      });

    console.log("[calendar] Filtered events count:", events.length);

    // 開始時間でソート
    events.sort((a: any, b: any) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      return a.start_time.localeCompare(b.start_time);
    });

    // 今日かどうかを判定
    const today = new Date();
    const isToday = targetDate.toDateString() === today.toDateString();

    return NextResponse.json({
      success: true,
      data: {
        events,
        date: targetDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
        dateStr: targetDateStr, // フロントエンドでのナビゲーション用
        isToday,
      },
    });
  } catch (error) {
    console.error("[calendar] Error:", error);
    return NextResponse.json(
      { error: "カレンダーの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
