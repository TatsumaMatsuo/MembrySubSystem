import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { setChartSeiban } from "@/lib/gantt/store";

// 保存ガント→社内工程表への一括取込（#95 Stage3）
// 工程ごとの開始/終了日を、1回の updateBaseRecord でまとめて更新する（逐次書込のタイムアウト回避）。
export const dynamic = "force-dynamic";

// 社内工程表の固定14工程（売約詳細のSCHED_PROCESSESと一致させる）
const SCHED_PROCESSES = [
  "受注", "計画図作成", "申請必要情報確定", "承認図作成", "図面承認",
  "申請図書作成", "申請期間構造", "申請期間確認済",
  "製作図", "材料手配", "製作期間", "基礎工事", "施工期間", "完了検査",
];
const PROC_SET = new Set(SCHED_PROCESSES);

// "YYYY-MM-DD" -> UTC ms（Lark日付フィールド）
function ymdToUtc(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Date.UTC(parseInt(v.slice(0, 4)), parseInt(v.slice(5, 7)) - 1, parseInt(v.slice(8, 10)));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const seiban = String(body?.seiban || "").trim();
    const dates = body?.dates as Record<string, { start?: string | null; end?: string | null }> | undefined;
    if (!seiban) return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });
    if (!dates || typeof dates !== "object") {
      return NextResponse.json({ success: false, error: "取込データが不正です" }, { status: 400 });
    }

    const tables = getLarkTables();
    const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
    const records = await getBaseRecords(tables.SCHEDULE, { filter });
    const record = records.data?.items?.[0];
    if (!record?.record_id) {
      return NextResponse.json({ success: false, error: "工程表レコードが見つかりません" }, { status: 404 });
    }

    // 更新フィールドを構築（開始/終了が指定された工程のみ）。null は空クリア。
    const fields: Record<string, number | null> = {};
    const applied: string[] = [];
    for (const [proc, d] of Object.entries(dates)) {
      if (!PROC_SET.has(proc) || !d) continue;
      let touched = false;
      if (d.start !== undefined) {
        fields[`社内工程表_${proc}開始日`] = ymdToUtc(d.start);
        touched = true;
      }
      if (d.end !== undefined) {
        fields[`社内工程表_${proc}終了日`] = ymdToUtc(d.end);
        touched = true;
      }
      if (touched) applied.push(proc);
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ success: false, error: "取込対象の工程がありません" }, { status: 400 });
    }

    const result = (await updateBaseRecord(tables.SCHEDULE, record.record_id as string, fields)) as any;
    if (result?.code !== 0 && result?.code !== undefined) {
      return NextResponse.json({ success: false, error: result?.msg || "更新に失敗しました" }, { status: 500 });
    }

    // 取込元ガントに製番を紐付け（chartId指定時。非致命）
    const chartId = body?.chartId ? String(body.chartId) : "";
    if (chartId) {
      try {
        await setChartSeiban(chartId, seiban);
      } catch (e) {
        console.error("[schedule/import] setChartSeiban failed", e);
      }
    }

    return NextResponse.json({ success: true, applied, count: applied.length });
  } catch (e: any) {
    console.error("[schedule/import] error", e);
    return NextResponse.json({ success: false, error: e?.message || "取込に失敗しました" }, { status: 500 });
  }
}
