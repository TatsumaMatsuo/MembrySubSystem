import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seiban, documentType, fileToken } = body;

    if (!seiban || !documentType || !fileToken) {
      return NextResponse.json({
        success: false,
        error: "必須パラメータが不足しています（seiban, documentType, fileToken）",
      }, { status: 400 });
    }

    console.log("[delete] Starting delete:", { seiban, documentType, fileToken });

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });
    }

    const tables = getLarkTables();

    // 1. 製番でレコードを検索
    const filter = `CurrentValue.[製番] = "${seiban}"`;
    console.log("[delete] Searching for record with filter:", filter);

    const existingRecords = await getBaseRecords(tables.PROJECT_DOCUMENTS, { filter });
    const recordId = existingRecords.data?.items?.[0]?.record_id as string | undefined;

    if (!recordId) {
      return NextResponse.json({
        success: false,
        error: `製番「${seiban}」の案件書庫レコードが見つかりません`,
      }, { status: 400 });
    }

    // 2. 既存の添付ファイルを取得
    const existingRecord = existingRecords.data?.items?.[0];
    const existingAttachments = existingRecord?.fields?.[documentType] as { file_token: string }[] | undefined;

    if (!existingAttachments || existingAttachments.length === 0) {
      return NextResponse.json({
        success: false,
        error: "削除対象のファイルが存在しません",
      }, { status: 400 });
    }

    // 3. 対象ファイルが存在するか確認
    const targetExists = existingAttachments.some(att => att.file_token === fileToken);
    if (!targetExists) {
      return NextResponse.json({
        success: false,
        error: "指定された削除対象のファイルが見つかりません",
      }, { status: 400 });
    }

    // 4. 対象ファイルを除外した配列を作成
    const newAttachments = existingAttachments.filter(att => att.file_token !== fileToken);

    console.log("[delete] Updating record, removing file. Remaining:", newAttachments.length);

    // 5. レコードを更新（空の場合はnullを設定）
    await updateBaseRecord(tables.PROJECT_DOCUMENTS, recordId, {
      [documentType]: newAttachments.length > 0 ? newAttachments : null,
    });

    console.log("[delete] Delete completed successfully");

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        documentType,
        deletedFileToken: fileToken,
        remainingCount: newAttachments.length,
      },
    });

  } catch (error) {
    console.error("[delete] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "削除中にエラーが発生しました",
    }, { status: 500 });
  }
}
