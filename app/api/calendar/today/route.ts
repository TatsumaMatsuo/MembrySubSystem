import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

// 今日の開始・終了タイムスタンプ（秒）
function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

export async function GET() {
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

    const { start, end } = getTodayRange();

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

    // カレンダーの予定を取得
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

    // 今日の日付文字列を取得（終日イベント用）
    const todayStr = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    // 今日のイベントのみをフィルタリングして整形
    const rawEvents = result.data?.items || [];
    console.log("[calendar] Raw events count:", rawEvents.length);

    const events = rawEvents
      .filter((event: any) => {
        // キャンセル・削除されたイベントを除外
        if (event.status === "cancelled" || event.status === "removed") {
          console.log("[calendar] Skipping cancelled event:", event.summary);
          return false;
        }

        // 終日イベントの場合
        if (event.start_time?.date) {
          // 終日イベントの日付が今日と一致するか確認
          return event.start_time.date === todayStr;
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
      .map((event: any) => ({
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
        location: event.location?.name || "",
        status: event.status,
        color: event.color,
      }));

    console.log("[calendar] Filtered events count:", events.length);

    // 開始時間でソート
    events.sort((a: any, b: any) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      return a.start_time.localeCompare(b.start_time);
    });

    return NextResponse.json({
      success: true,
      data: {
        events,
        date: new Date().toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
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
