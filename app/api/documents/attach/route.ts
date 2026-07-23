import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 複数の file_token を案件書庫レコードの添付フィールドへ「1回の更新で」追加する。
 *
 * 大量アップロード対策: バイナリの Drive アップロード（file_token 取得）は
 * /api/documents/upload?tokenOnly=true で並列実行し、得た token 群をここでまとめて追加する。
 * 添付列の read-modify-write を1回に集約するため、並列アップロードでも lost update が起きない。
 *
 *   POST { seiban, documentType, fileTokens: string[], replace?: boolean }
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const seiban = String(body?.seiban || "").trim();
  const documentType = String(body?.documentType || "").trim();
  const fileTokens: string[] = Array.isArray(body?.fileTokens) ? body.fileTokens.filter((t: any) => typeof t === "string" && t) : [];
  const replace = body?.replace === true;

  if (!seiban || !documentType) {
    return NextResponse.json({ success: false, error: "必須パラメータが不足しています" }, { status: 400 });
  }
  if (fileTokens.length === 0) {
    return NextResponse.json({ success: false, error: "追加するファイルがありません" }, { status: 400 });
  }

  const client = getLarkClient();
  if (!client) return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });

  try {
    const tables = getLarkTables();

    // 添付フィールドの存在確認
    const fieldRes = await client.bitable.appTableField.list({
      path: { app_token: getLarkBaseToken(), table_id: tables.PROJECT_DOCUMENTS },
    });
    const targetField = fieldRes.data?.items?.find((f: any) => f.field_name === documentType);
    if (!targetField) {
      return NextResponse.json({ success: false, error: `書類種別「${documentType}」に対応するフィールドが見つかりません` }, { status: 400 });
    }

    // レコード検索（＋既存添付の読み取りは1回だけ）
    const filter = `CurrentValue.[製番] = "${escapeLarkFilterValue(seiban)}"`;
    const existingRecords = await getBaseRecords(tables.PROJECT_DOCUMENTS, { filter });
    const record = existingRecords.data?.items?.[0];
    const recordId = record?.record_id as string | undefined;
    if (!recordId) {
      return NextResponse.json({ success: false, error: `製番「${seiban}」の案件書庫レコードが見つかりません` }, { status: 400 });
    }
    const existing = (record?.fields?.[documentType] as { file_token: string }[] | undefined) || [];

    const newAtts = fileTokens.map((t) => ({ file_token: t }));
    const attachments = replace ? newAtts : [...existing, ...newAtts];

    await updateBaseRecord(tables.PROJECT_DOCUMENTS, recordId, { [documentType]: attachments });

    return NextResponse.json({ success: true, added: fileTokens.length, total: attachments.length });
  } catch (e: any) {
    console.error("[documents/attach]", e);
    return NextResponse.json({ success: false, error: e?.message || "添付の追加に失敗しました" }, { status: 500 });
  }
}
