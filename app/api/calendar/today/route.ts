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

    // Lark APIドメイン（OAuthと同じドメインを使用）
    const larkDomain = process.env.LARK_DOMAIN || "https://open.feishu.cn";

    // ユーザーのアクセストークンを使用してカレンダーAPIを呼び出す
    const response = await fetch(
      `${larkDomain}/open-apis/calendar/v4/calendars/primary/events?start_time=${start}&end_time=${end}&page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    console.log("[calendar] Response:", {
      code: result.code,
      msg: result.msg,
      items: result.data?.items?.length,
    });

    if (result.code !== 0) {
      console.error("[calendar] API Error:", result);

      // 権限エラーの場合は詳細なメッセージを表示
      let errorMessage = "カレンダーの取得に失敗しました";
      if (result.code === 99991672 || result.msg?.includes("scope")) {
        errorMessage = "カレンダーへのアクセス権限がありません。Lark Appにcalendar:calendar:readonly権限が必要です。";
      } else if (result.code === 99991663 || result.code === 99991664) {
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

    // イベントデータを整形
    const events = (result.data?.items || []).map((event: any) => ({
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
