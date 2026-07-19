import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";

// ガント: 会社カレンダー(共有)の休日(終日予定)を取得して返す（#95）
// 画面/PDFの背景色に反映する。calendar_id は env 優先＋フォールバック定数(Amplify SSR実行時対策)。
export const dynamic = "force-dynamic";

// 会社休日カレンダー(共有)。env 未設定時のフォールバック。
const HOLIDAY_CALENDAR_ID =
  process.env.LARK_HOLIDAY_CALENDAR_ID || "feishu.cn_jiBkYHardKzYSa9jYqlfEa@group.calendar.feishu.cn";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDayStr(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + 1);
  return ymd(dt);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const userAccessToken = session.accessToken;
    if (!userAccessToken) {
      return NextResponse.json({ success: true, holidays: [], message: "カレンダー権限がありません（再ログイン）" });
    }
    const from = request.nextUrl.searchParams.get("from") || "";
    const to = request.nextUrl.searchParams.get("to") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ success: false, error: "from/to(YYYY-MM-DD)が必要です" }, { status: 400 });
    }
    // JST基準で範囲をunix秒に（前後1日余裕）
    const startSec = Math.floor(new Date(`${from}T00:00:00+09:00`).getTime() / 1000) - 86400;
    const endSec = Math.floor(new Date(`${to}T23:59:59+09:00`).getTime() / 1000) + 86400;

    const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
    const calId = encodeURIComponent(HOLIDAY_CALENDAR_ID);

    const events: any[] = [];
    let pageToken = "";
    for (let i = 0; i < 20; i++) {
      const url = new URL(`${larkDomain}/open-apis/calendar/v4/calendars/${calId}/events`);
      url.searchParams.set("start_time", String(startSec));
      url.searchParams.set("end_time", String(endSec));
      url.searchParams.set("page_size", "500");
      if (pageToken) url.searchParams.set("page_token", pageToken);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.code !== 0) {
        let msg = json.msg || "会社カレンダーの取得に失敗しました";
        if (json.code === 99991672 || json.msg?.includes("scope")) msg = "カレンダー閲覧権限(calendar:calendar:readonly)が必要です。";
        else if (json.code === 99991663 || json.code === 99991664 || json.code === 99991677) msg = "セッションが切れました。再ログインしてください。";
        else if (json.code === 195100 || json.code === 190002) msg = "会社カレンダーが見つかりません（calendar_id設定を確認）。";
        return NextResponse.json({ success: true, holidays: [], message: msg, code: json.code });
      }
      const items = json.data?.items || [];
      events.push(...items);
      if (json.data?.has_more && json.data?.page_token) pageToken = json.data.page_token;
      else break;
    }

    // 終日予定を日付展開（end.date は排他的＝翌日）。[from,to]にクランプ・重複排除。
    const map = new Map<string, string>(); // date -> name
    for (const ev of events) {
      if (ev.status === "cancelled" || ev.status === "removed") continue;
      const sd = ev.start_time?.date as string | undefined; // 終日のみ date を持つ
      if (!sd) continue; // 時間指定予定は休日扱いしない
      const ed = (ev.end_time?.date as string | undefined) || addDayStr(sd);
      const name = ev.summary || "休日";
      let d = sd;
      let guard = 0;
      while (d < ed && guard < 400) {
        if (d >= from && d <= to && !map.has(d)) map.set(d, name);
        d = addDayStr(d);
        guard++;
      }
      // 単日で end<=start の防御
      if (sd >= ed && sd >= from && sd <= to && !map.has(sd)) map.set(sd, name);
    }
    const holidays = Array.from(map.entries())
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ success: true, holidays });
  } catch (e: any) {
    console.error("[gantt/holidays] error", e);
    return NextResponse.json({ success: false, error: e?.message || "休日の取得に失敗しました" }, { status: 500 });
  }
}
