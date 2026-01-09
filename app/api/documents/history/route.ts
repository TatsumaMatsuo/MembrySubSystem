import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, createBaseRecord } from "@/lib/lark-client";
import { getLarkTables, DOCUMENT_HISTORY_FIELDS } from "@/lib/lark-tables";
import type { DocumentHistory, OperationType } from "@/types";

export const dynamic = "force-dynamic";

/**
 * 更新履歴を取得
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seiban = searchParams.get("seiban");
  const documentType = searchParams.get("documentType");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番は必須です" },
      { status: 400 }
    );
  }

  try {
    const tables = getLarkTables();

    // フィルター条件を構築
    let filter = `CurrentValue.[${DOCUMENT_HISTORY_FIELDS.seiban}] = "${seiban}"`;
    if (documentType) {
      filter += ` && CurrentValue.[${DOCUMENT_HISTORY_FIELDS.document_type}] = "${documentType}"`;
    }

    const response = await getBaseRecords(tables.DOCUMENT_HISTORY, {
      filter,
      sort: [{ field_name: DOCUMENT_HISTORY_FIELDS.operated_at, desc: true }],
      pageSize: 100,
    });

    if (!response.data?.items) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
      });
    }

    const histories: DocumentHistory[] = response.data.items.map((item) => ({
      record_id: item.record_id || "",
      seiban: String(item.fields?.[DOCUMENT_HISTORY_FIELDS.seiban] || ""),
      document_type: String(item.fields?.[DOCUMENT_HISTORY_FIELDS.document_type] || ""),
      operation_type: item.fields?.[DOCUMENT_HISTORY_FIELDS.operation_type] as OperationType || "追加",
      file_name: String(item.fields?.[DOCUMENT_HISTORY_FIELDS.file_name] || ""),
      operator: String(item.fields?.[DOCUMENT_HISTORY_FIELDS.operator] || ""),
      operated_at: item.fields?.[DOCUMENT_HISTORY_FIELDS.operated_at] as number || Date.now(),
      notes: item.fields?.[DOCUMENT_HISTORY_FIELDS.notes]
        ? String(item.fields[DOCUMENT_HISTORY_FIELDS.notes])
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: histories,
      total: histories.length,
    });
  } catch (error) {
    console.error("Error fetching document history:", error);
    return NextResponse.json(
      { success: false, error: "更新履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 更新履歴を記録
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seiban, documentType, operationType, fileName, operator, notes } = body;

    if (!seiban || !documentType || !operationType || !fileName) {
      return NextResponse.json(
        { success: false, error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    const tables = getLarkTables();
    const fields = {
      [DOCUMENT_HISTORY_FIELDS.seiban]: seiban,
      [DOCUMENT_HISTORY_FIELDS.document_type]: documentType,
      [DOCUMENT_HISTORY_FIELDS.operation_type]: operationType,
      [DOCUMENT_HISTORY_FIELDS.file_name]: fileName,
      [DOCUMENT_HISTORY_FIELDS.operator]: operator || "不明",
      [DOCUMENT_HISTORY_FIELDS.operated_at]: Date.now(),
      [DOCUMENT_HISTORY_FIELDS.notes]: notes || "",
    };

    const response = await createBaseRecord(tables.DOCUMENT_HISTORY, fields);

    return NextResponse.json({
      success: true,
      data: {
        record_id: response.data?.record?.record_id || "",
      },
    });
  } catch (error) {
    console.error("Error creating document history:", error);
    return NextResponse.json(
      { success: false, error: "更新履歴の記録に失敗しました" },
      { status: 500 }
    );
  }
}
