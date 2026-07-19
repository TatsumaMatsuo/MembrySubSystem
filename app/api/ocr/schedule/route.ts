import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables, SCHEDULE_FIELDS } from "@/lib/lark-tables";
import { AI_MODEL_CHAINS, createMessageWithFallback } from "@/lib/ai-models";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { unlinkChartsBySeiban } from "@/lib/gantt/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEDULE_DATE_FIELD_NAMES = Object.values(SCHEDULE_FIELDS).filter(
  (v) => v.startsWith("社内工程表_")
);

const PROCESS_NAMES = [
  "受注",
  "計画図作成",
  "申請必要情報確定",
  "承認図作成",
  "図面承認",
  "申請図書作成",
  "申請期間（構造）",
  "申請期間（確認済）",
  "製作図",
  "材料手配",
  "製作期間",
  "基礎工事",
  "施工期間",
  "完了検査",
];

function dateToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  const fullMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (fullMatch) {
    const [, year, month, day] = fullMatch;
    return Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  const shortMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (shortMatch) {
    const [, month, day] = shortMatch;
    const year = new Date().getFullYear();
    return Date.UTC(year, parseInt(month) - 1, parseInt(day));
  }
  return null;
}

async function ocrScheduleImage(imageBase64: string): Promise<Record<string, { start: string | null; end: string | null }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

  const anthropic = new Anthropic({ apiKey });
  console.log("[ocr/schedule] Image base64 length:", imageBase64.length);

  const currentYear = new Date().getFullYear();

  const message = await createMessageWithFallback(anthropic, AI_MODEL_CHAINS.OCR_SCHEDULE, {
    max_tokens: 16000,
    // budget_tokens は Sonnet 4.6 では非推奨だが有効。SDK更新後に adaptive へ移行可
    thinking: { type: "enabled", budget_tokens: 8000 },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: imageBase64 },
          },
          {
            type: "text",
            text: `この工程表から、各行の「開始日」列と「終了日」列の数字を正確に読み取ってください。

- TOTAL期間の行は除外し、No.1から順番に読む
- 日付がMM/DD形式なら${currentYear}年として出力。月が前行より小さくなったら${currentYear + 1}年
- YYYY/MM/DD形式ならそのまま使用
- 日付が空欄の行はnullとする
- ガントチャートのバーではなく「開始日」「終了日」列のテキストを読むこと

JSON配列のみ出力:
[{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }, ...]`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
  console.log("[ocr/schedule] Raw OCR output:", text);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("OCR結果からJSONを抽出できませんでした");

  const rows: { start: string | null; end: string | null }[] = JSON.parse(jsonMatch[0]);

  // 行番号で固定マッピング
  const result: Record<string, { start: string | null; end: string | null }> = {};
  for (let i = 0; i < PROCESS_NAMES.length && i < rows.length; i++) {
    result[PROCESS_NAMES[i]] = rows[i];
  }

  return result;
}

function resolveFieldName(process: string): { start: string | null; end: string | null } {
  const stripped = process.replace(/[（(]/g, "").replace(/[）)]/g, "");
  return {
    start: SCHEDULE_DATE_FIELD_NAMES.find((f) => f === `社内工程表_${stripped}開始日` || f === `社内工程表_${process}開始日`) || null,
    end: SCHEDULE_DATE_FIELD_NAMES.find((f) => f === `社内工程表_${stripped}終了日` || f === `社内工程表_${process}終了日`) || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "save") {
      return handleSave(body);
    }
    if (body.action === "clear") {
      return handleClear(body);
    }
    return handleOcr(body);
  } catch (error) {
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error("[ocr/schedule] Error:", msg);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "OCR処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// Step 1: クライアントから画像を受け取りOCR
async function handleOcr(body: { seiban: string; imageBase64: string }) {
  const { seiban, imageBase64 } = body;
  if (!seiban || !imageBase64) {
    return NextResponse.json({ success: false, error: "製番と画像データが必要です" }, { status: 400 });
  }

  console.log("[ocr/schedule] OCR start:", seiban);
  const ocrResult = await ocrScheduleImage(imageBase64);
  console.log("[ocr/schedule] OCR result:", JSON.stringify(ocrResult, null, 2));

  // 全プロセスを網羅（OCR結果にないものはnull）
  const extractedDates: Record<string, { start: string | null; end: string | null; startField: string | null; endField: string | null }> = {};
  for (const process of PROCESS_NAMES) {
    const ocrDates = ocrResult[process] || { start: null, end: null };
    const fields = resolveFieldName(process);
    extractedDates[process] = { start: ocrDates.start, end: ocrDates.end, startField: fields.start, endField: fields.end };
  }

  return NextResponse.json({ success: true, data: { extractedDates } });
}

// Step 2: ユーザー確認後に保存（未設定の項目はnullで上書き）
async function handleSave(body: { seiban: string; dates: Record<string, { start: string | null; end: string | null }> }) {
  const { seiban, dates } = body;
  if (!seiban || !dates) {
    return NextResponse.json({ success: false, error: "製番と日付データが必要です" }, { status: 400 });
  }

  const tables = getLarkTables();
  const updateFields: Record<string, number | null> = {};

  for (const [process, values] of Object.entries(dates)) {
    const fields = resolveFieldName(process);
    if (fields.start) {
      updateFields[fields.start] = values.start ? dateToTimestamp(values.start) : null;
    }
    if (fields.end) {
      updateFields[fields.end] = values.end ? dateToTimestamp(values.end) : null;
    }
  }

  const record = await findScheduleRecord(seiban, tables.SCHEDULE);
  if (!record) {
    return NextResponse.json({ success: false, error: `製番「${seiban}」のレコードが工程管理テーブルに見つかりません` });
  }

  const recordId = record.record_id as string;
  console.log("[ocr/schedule] Saving to record:", recordId, "fields:", JSON.stringify(updateFields));
  const result = await updateBaseRecord(tables.SCHEDULE, recordId, updateFields);
  const resultAny = result as any;
  if (resultAny?.code !== 0) {
    console.error("[ocr/schedule] Lark update failed:", JSON.stringify(resultAny));
    return NextResponse.json({
      success: false,
      error: `Lark更新エラー: ${resultAny?.msg || "不明"} (code: ${resultAny?.code})`,
    });
  }

  const setCount = Object.values(updateFields).filter((v) => v !== null).length;
  console.log("[ocr/schedule] Saved", setCount, "dates for", seiban);

  // OCR取込で社内工程表を上書きしたため、以前ガントから取り込んで紐付いていたガントは
  // 実データと不整合になる。当製番に紐づくガントの売約番号を空にする（非致命）。
  try {
    await unlinkChartsBySeiban(seiban);
  } catch (e) {
    console.error("[ocr/schedule] unlinkChartsBySeiban failed", e);
  }

  return NextResponse.json({
    success: true,
    data: { seiban, recordId, updatedFields: setCount },
  });
}

// 削除時: 全日付フィールドをクリア
async function handleClear(body: { seiban: string }) {
  const { seiban } = body;
  if (!seiban) {
    return NextResponse.json({ success: false, error: "製番が必要です" }, { status: 400 });
  }

  const tables = getLarkTables();
  const record = await findScheduleRecord(seiban, tables.SCHEDULE);
  if (!record) {
    return NextResponse.json({ success: false, error: `製番「${seiban}」のレコードが工程管理テーブルに見つかりません` });
  }

  const clearFields: Record<string, null> = {};
  for (const fieldName of SCHEDULE_DATE_FIELD_NAMES) {
    clearFields[fieldName] = null;
  }

  const recordId = record.record_id as string;
  console.log("[ocr/schedule] Clearing", SCHEDULE_DATE_FIELD_NAMES.length, "fields for record:", recordId);
  const result = await updateBaseRecord(tables.SCHEDULE, recordId, clearFields);
  const resultAny = result as any;
  if (resultAny?.code !== 0) {
    console.error("[ocr/schedule] Lark clear failed:", JSON.stringify(resultAny));
    return NextResponse.json({
      success: false,
      error: `Larkクリアエラー: ${resultAny?.msg || "不明"} (code: ${resultAny?.code})`,
    });
  }
  console.log("[ocr/schedule] Cleared all schedule dates for", seiban);

  return NextResponse.json({
    success: true,
    data: { seiban, recordId, clearedFields: SCHEDULE_DATE_FIELD_NAMES.length },
  });
}

async function findScheduleRecord(seiban: string, tableId: string) {
  const filter = `CurrentValue.[製番2] = "${escapeLarkFilterValue(seiban)}"`;
  const records = await getBaseRecords(tableId, { filter });
  return records.data?.items?.[0] || null;
}
