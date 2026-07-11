import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables, SCHEDULE_FIELDS } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

export const dynamic = "force-dynamic";

const DATE_FIELD_ENTRIES = Object.entries(SCHEDULE_FIELDS).filter(
  ([, v]) => v.startsWith("社内工程表_")
);

export async function GET(request: NextRequest) {
  const seiban = new URL(request.url).searchParams.get("seiban");
  if (!seiban) {
    return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });
  }

  const tables = getLarkTables();
  const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
  const records = await getBaseRecords(tables.SCHEDULE, { filter });
  const record = records.data?.items?.[0];

  if (!record) {
    return NextResponse.json({ success: true, data: null });
  }

  const fields = record.fields as Record<string, any>;
  const dates: Record<string, { start: number | null; end: number | null }> = {};

  const processes = [
    "受注", "計画図作成", "申請必要情報確定", "承認図作成", "図面承認",
    "申請図書作成", "申請期間構造", "申請期間確認済",
    "製作図", "材料手配", "製作期間", "基礎工事", "施工期間", "完了検査",
  ];

  for (const proc of processes) {
    const startField = DATE_FIELD_ENTRIES.find(([, v]) => v === `社内工程表_${proc}開始日`);
    const endField = DATE_FIELD_ENTRIES.find(([, v]) => v === `社内工程表_${proc}終了日`);
    dates[proc] = {
      start: startField ? (fields[startField[1]] as number) || null : null,
      end: endField ? (fields[endField[1]] as number) || null : null,
    };
  }

  // 部署別スケジュール（テキスト型フィールド）
  const DEPT_FIELDS = [
    "承認図YMD_FROM", "承認図YMD_TO", "製作図YMD_FROM", "製作図YMD_TO",
    "材料YMD_FROM", "材料YMD_TO", "原寸仮組YMD_FROM", "原寸仮組YMD_TO",
    "本溶接YMD_FROM", "本溶接YMD_TO", "塗装YMD_FROM", "塗装YMD_TO",
    "膜製作YMD_FROM", "膜製作YMD_TO", "施工YMD_FROM", "施工YMD_TO",
    "メッキ出日1", "メッキ出日2", "メッキ出日3",
    "積込日1", "積込日2", "積込日3",
  ];
  const deptFields: Record<string, string | null> = {};
  for (const f of DEPT_FIELDS) {
    const val = fields[f];
    deptFields[f] = typeof val === "string" && val.trim() ? val.trim() : null;
  }

  return NextResponse.json({
    success: true,
    data: { recordId: record.record_id, dates, deptFields },
  });
}

export async function POST(request: NextRequest) {
  const { seiban, field, value, fieldType } = await request.json();
  if (!seiban || !field) {
    return NextResponse.json({ success: false, error: "パラメータ不足" }, { status: 400 });
  }

  const tables = getLarkTables();
  const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
  const records = await getBaseRecords(tables.SCHEDULE, { filter });
  const record = records.data?.items?.[0];
  if (!record) {
    return NextResponse.json({ success: false, error: "レコードが見つかりません" });
  }

  let updateValue: any = null;
  if (value) {
    if (fieldType === "text") {
      updateValue = value;
    } else {
      updateValue = Date.UTC(
        parseInt(value.substring(0, 4)),
        parseInt(value.substring(5, 7)) - 1,
        parseInt(value.substring(8, 10))
      );
    }
  }

  const result = await updateBaseRecord(
    tables.SCHEDULE,
    record.record_id as string,
    { [field]: updateValue }
  );

  const resultAny = result as any;
  if (resultAny?.code !== 0) {
    return NextResponse.json({ success: false, error: resultAny?.msg || "更新失敗" });
  }

  return NextResponse.json({ success: true });
}
