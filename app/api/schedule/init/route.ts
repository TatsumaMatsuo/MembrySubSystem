import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables, SCHEDULE_FIELDS } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { unlinkChartsBySeiban } from "@/lib/gantt/store";

// 社内工程表の初期化（#95）: 全工程の開始/終了日をクリアし、当製番に紐づくガントの売約番号も空にする。
// 関連資料(工程表)の削除はクライアント側で /api/documents/delete を使う。
export const dynamic = "force-dynamic";

const SCHEDULE_DATE_FIELD_NAMES = Object.values(SCHEDULE_FIELDS).filter((v) => v.startsWith("社内工程表_"));

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const seiban = String(body?.seiban || "").trim();
    if (!seiban) return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });

    const tables = getLarkTables();
    const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
    const records = await getBaseRecords(tables.SCHEDULE, { filter });
    const record = records.data?.items?.[0];
    if (!record?.record_id) {
      return NextResponse.json({ success: false, error: "工程表レコードが見つかりません" }, { status: 404 });
    }

    // 全工程日付をnullクリア（1回の更新）
    const clearFields: Record<string, null> = {};
    for (const f of SCHEDULE_DATE_FIELD_NAMES) clearFields[f] = null;
    const result = (await updateBaseRecord(tables.SCHEDULE, record.record_id as string, clearFields)) as any;
    if (result?.code !== 0 && result?.code !== undefined) {
      return NextResponse.json({ success: false, error: result?.msg || "初期化に失敗しました" }, { status: 500 });
    }

    // 当製番に紐づくガントの売約番号を空に（非致命）
    let unlinked = 0;
    try {
      unlinked = await unlinkChartsBySeiban(seiban);
    } catch (e) {
      console.error("[schedule/init] unlink failed", e);
    }

    return NextResponse.json({ success: true, unlinked });
  } catch (e: any) {
    console.error("[schedule/init] error", e);
    return NextResponse.json({ success: false, error: e?.message || "初期化に失敗しました" }, { status: 500 });
  }
}
