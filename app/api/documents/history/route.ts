import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, createBaseRecord } from "@/lib/lark-client";
import { getLarkTables, DOCUMENT_HISTORY_FIELDS, getBaseTokenForTable } from "@/lib/lark-tables";
import type { DocumentHistory, OperationType, LarkAttachment } from "@/types";

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

    const baseToken = getBaseTokenForTable("DOCUMENT_HISTORY");
    const response = await getBaseRecords(tables.DOCUMENT_HISTORY, {
      filter,
      pageSize: 100,
      baseToken,
    });

    if (!response.data?.items) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
      });
    }

    const histories: DocumentHistory[] = response.data.items.map((item) => {
      // 添付ファイルフィールドを変換
      const parseAttachments = (fieldValue: unknown): LarkAttachment[] | undefined => {
        if (!fieldValue || !Array.isArray(fieldValue)) return undefined;
        return fieldValue.map((file: { file_token?: string; name?: string; size?: number; type?: string }) => ({
          file_token: file.file_token || "",
          name: file.name || "",
          size: file.size || 0,
          type: file.type || "",
        }));
      };

      return {
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
        before_image: parseAttachments(item.fields?.[DOCUMENT_HISTORY_FIELDS.before_image]),
        after_image: parseAttachments(item.fields?.[DOCUMENT_HISTORY_FIELDS.after_image]),
      };
    });

    // 操作日時で降順ソート（新しい順）
    histories.sort((a, b) => b.operated_at - a.operated_at);

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
    const { seiban, documentType, operationType, fileName, operator, notes, beforeFileToken, afterFileToken } = body;

    if (!seiban || !documentType || !operationType || !fileName) {
      return NextResponse.json(
        { success: false, error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    const tables = getLarkTables();
    const fields: Record<string, unknown> = {
      [DOCUMENT_HISTORY_FIELDS.seiban]: seiban,
      [DOCUMENT_HISTORY_FIELDS.document_type]: documentType,
      [DOCUMENT_HISTORY_FIELDS.operation_type]: operationType,
      [DOCUMENT_HISTORY_FIELDS.file_name]: fileName,
      [DOCUMENT_HISTORY_FIELDS.operator]: operator || "不明",
      [DOCUMENT_HISTORY_FIELDS.operated_at]: Date.now(),
      [DOCUMENT_HISTORY_FIELDS.notes]: notes || "",
    };

    // 変更前/変更後の画像をfile_tokenで添付
    if (beforeFileToken) {
      fields[DOCUMENT_HISTORY_FIELDS.before_image] = [{ file_token: beforeFileToken }];
    }
    if (afterFileToken) {
      fields[DOCUMENT_HISTORY_FIELDS.after_image] = [{ file_token: afterFileToken }];
    }

    const baseToken = getBaseTokenForTable("DOCUMENT_HISTORY");
    const response = await createBaseRecord(tables.DOCUMENT_HISTORY, fields, { baseToken });

    return NextResponse.json({
      success: true,
      data: {
        record_id: response.data?.record?.record_id || "",
      },
    });
  } catch (error) {
    console.error("Error creating document history:", error);

    // Lark API 403権限エラーの検出
    const axiosError = error as { response?: { status?: number; data?: { code?: number; msg?: string } } };
    if (axiosError.response?.status === 403 || axiosError.response?.data?.code === 1254302) {
      return NextResponse.json(
        {
          success: false,
          error: "更新履歴テーブルへの書き込み権限がありません",
          detail: "Lark Base管理画面で更新履歴テーブル(DOCUMENT_HISTORY)の書き込み権限を付与してください",
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "更新履歴の記録に失敗しました" },
      { status: 500 }
    );
  }
}
