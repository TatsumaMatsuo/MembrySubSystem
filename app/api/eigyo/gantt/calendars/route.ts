import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";

// ガント: 会社カレンダー特定用。ログインユーザーが保有/購読する全カレンダー一覧を返す（#95）
// 会社の共有カレンダー(会社休日カレンダー等)の calendar_id を見つけるための一覧表示に使う。
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const userAccessToken = session.accessToken;
    if (!userAccessToken) {
      return NextResponse.json({ success: false, error: "カレンダーへのアクセス権限がありません。再ログインしてください。" }, { status: 200 });
    }
    const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";

    // ページングして全カレンダーを取得
    const all: any[] = [];
    let pageToken = "";
    for (let i = 0; i < 10; i++) {
      const url = new URL(`${larkDomain}/open-apis/calendar/v4/calendars`);
      url.searchParams.set("page_size", "50");
      if (pageToken) url.searchParams.set("page_token", pageToken);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.code !== 0) {
        let msg = json.msg || "カレンダーの取得に失敗しました";
        if (json.code === 99991672 || json.msg?.includes("scope")) msg = "カレンダー閲覧権限(calendar:calendar:readonly, 用户身份)が必要です。";
        else if (json.code === 99991663 || json.code === 99991664 || json.code === 99991677) msg = "セッションが切れました。再ログインしてください。";
        return NextResponse.json({ success: false, error: msg, code: json.code }, { status: 200 });
      }
      const list = json.data?.calendar_list || [];
      all.push(...list);
      if (json.data?.has_more && json.data?.page_token) pageToken = json.data.page_token;
      else break;
    }

    const calendars = all.map((c: any) => ({
      id: c.calendar_id,
      name: c.summary || "(無題)",
      description: c.description || "",
      type: c.type, // primary / shared / google / resource / exchange
      role: c.role, // owner / reader / writer / free_busy_reader
    }));

    return NextResponse.json({ success: true, count: calendars.length, calendars });
  } catch (e: any) {
    console.error("[gantt/calendars] error", e);
    return NextResponse.json({ success: false, error: e?.message || "カレンダー一覧の取得に失敗しました" }, { status: 500 });
  }
}
