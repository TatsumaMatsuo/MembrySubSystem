import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables, SCHEDULE_FIELDS } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { setChartSeiban } from "@/lib/gantt/store";

// 保存ガント→社内工程表への取込（#95）
// 方式: 取込元ガントに製番を紐付け（社内工程表タブは紐づくガントを表示）＋固定14工程の日付をクリア（工程名を削除）。
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
    const chartId = body?.chartId ? String(body.chartId) : "";
    if (!seiban) return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });
    if (!chartId) return NextResponse.json({ success: false, error: "ガントが選択されていません" }, { status: 400 });

    // 取込元ガントに製番を紐付け（この紐付けを社内工程表タブが読んで表示する）
    const linked = await setChartSeiban(chartId, seiban);
    if (!linked) {
      return NextResponse.json({ success: false, error: "選択したガントが見つかりません" }, { status: 404 });
    }

    // 既存の固定14工程の日付をクリア（工程名を削除。表示は紐づくガントに切替）。レコードがあれば。
    const tables = getLarkTables();
    const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
    const records = await getBaseRecords(tables.SCHEDULE, { filter });
    const record = records.data?.items?.[0];
    if (record?.record_id) {
      const clearFields: Record<string, null> = {};
      for (const f of SCHEDULE_DATE_FIELD_NAMES) clearFields[f] = null;
      try {
        await updateBaseRecord(tables.SCHEDULE, record.record_id as string, clearFields);
      } catch (e) {
        console.error("[schedule/import] clear fixed14 failed", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[schedule/import] error", e);
    return NextResponse.json({ success: false, error: e?.message || "取込に失敗しました" }, { status: 500 });
  }
}
