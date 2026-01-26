import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getLarkClient, getLarkBaseToken, getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // アップロードには時間がかかる場合があるため

// ファイルサイズ上限: 5MB (AWS Amplifyの制限に合わせる)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  console.log("[upload] POST request received");

  try {
    // Content-Typeを確認
    const contentType = request.headers.get("content-type") || "";
    console.log("[upload] Content-Type:", contentType);

    let file: File | null = null;
    let seiban: string | null = null;
    let documentType: string | null = null;
    let replaceMode = false;
    let targetFileToken: string | null = null;

    if (contentType.includes("application/json")) {
      // JSON形式 (Base64エンコード)
      const json = await request.json();
      console.log("[upload] JSON payload received:", {
        hasFileData: !!json.fileData,
        fileName: json.fileName,
        seiban: json.seiban,
        documentType: json.documentType
      });

      if (!json.fileData || !json.fileName) {
        return NextResponse.json({ success: false, error: "ファイルデータが指定されていません" }, { status: 400 });
      }

      // Base64デコード
      const base64Data = json.fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({
          success: false,
          error: `ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています`
        }, { status: 400 });
      }

      // File-like objectを作成
      file = new File([buffer], json.fileName, { type: json.mimeType || "application/octet-stream" });
      seiban = json.seiban;
      documentType = json.documentType;
      replaceMode = json.replace === true || json.replace === "true";
      targetFileToken = json.targetFileToken || null;
    } else {
      // FormData形式 (従来の方式)
      const formData = await request.formData();
      file = formData.get("file") as File | null;
      seiban = formData.get("seiban") as string;
      documentType = formData.get("documentType") as string;
      replaceMode = formData.get("replace") === "true";
      targetFileToken = formData.get("targetFileToken") as string | null;
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "ファイルが指定されていません" }, { status: 400 });
    }
    if (!seiban || !documentType) {
      return NextResponse.json({ success: false, error: "必須パラメータが不足しています" }, { status: 400 });
    }

    console.log("[upload] Starting upload:", { fileName: file.name, fileSize: file.size, seiban, documentType });

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });
    }

    const tables = getLarkTables();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // テーブルのフィールド情報を取得
    const tableInfoResponse = await client.bitable.appTableField.list({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tables.PROJECT_DOCUMENTS,
      },
    });

    // documentType（例: "地盤調査"）に対応するフィールドを検索
    const targetField = tableInfoResponse.data?.items?.find(
      (field: any) => field.field_name === documentType
    );

    if (!targetField) {
      return NextResponse.json({
        success: false,
        error: `書類種別「${documentType}」に対応するフィールドが見つかりません`,
      }, { status: 400 });
    }

    console.log("[upload] Target field:", { field_id: targetField.field_id, field_name: targetField.field_name });

    // 1. 製番でレコードを検索
    const filter = `CurrentValue.[製番] = "${seiban}"`;
    console.log("[upload] Searching for existing record with filter:", filter);

    const existingRecords = await getBaseRecords(tables.PROJECT_DOCUMENTS, { filter });
    const recordId = existingRecords.data?.items?.[0]?.record_id as string | undefined;

    if (!recordId) {
      return NextResponse.json({
        success: false,
        error: `製番「${seiban}」の案件書庫レコードが見つかりません。先に案件書庫にレコードを作成してください。`,
      }, { status: 400 });
    }

    console.log("[upload] Found record:", recordId);

    // 2. Drive APIでファイルをアップロード
    console.log("[upload] Uploading file to Drive...", { size: file.size, name: file.name });

    let uploadResponse;
    try {
      // BufferからReadable Streamを作成
      const stream = new Readable({
        read() {
          this.push(fileBuffer);
          this.push(null);
        }
      });

      uploadResponse = await client.drive.media.uploadAll({
        data: {
          file_name: file.name,
          parent_type: "bitable_file",
          parent_node: getLarkBaseToken(),
          size: file.size,
          file: stream as any,
        },
      });
    } catch (uploadError) {
      console.error("[upload] Drive upload error:", uploadError);
      return NextResponse.json({
        success: false,
        error: `ファイルアップロードに失敗しました: ${uploadError instanceof Error ? uploadError.message : "不明なエラー"}`,
      }, { status: 500 });
    }

    console.log("[upload] Drive upload response:", JSON.stringify(uploadResponse, null, 2));

    if (!uploadResponse) {
      return NextResponse.json({
        success: false,
        error: "ファイルアップロードに失敗しました: レスポンスがありません",
      }, { status: 500 });
    }

    // レスポンス形式: { file_token: "xxx" } または { code: 0, data: { file_token: "xxx" } }
    const responseData = uploadResponse as any;
    const fileToken = responseData.file_token || responseData.data?.file_token;
    if (!fileToken) {
      console.error("[upload] No file_token in response:", responseData);
      return NextResponse.json({
        success: false,
        error: `ファイルアップロードに失敗しました: ${responseData.msg || responseData.code || "不明なエラー"}`,
      }, { status: 500 });
    }

    console.log("[upload] Got file_token:", fileToken);

    // 3. レコードを更新して添付フィールドにfile_tokenを設定
    console.log("[upload] Updating record with attachment, replaceMode:", replaceMode, "targetFileToken:", targetFileToken);

    // 既存の添付ファイルを取得
    const existingRecord = existingRecords.data?.items?.[0];
    const existingAttachments = existingRecord?.fields?.[documentType] as { file_token: string }[] | undefined;

    let attachments: { file_token: string }[] = [{ file_token: fileToken }];

    if (replaceMode) {
      // 差替えモード
      if (targetFileToken) {
        // 特定のファイルを差し替え
        if (!existingAttachments || existingAttachments.length === 0) {
          return NextResponse.json({
            success: false,
            error: "差替え対象のファイルが存在しません",
          }, { status: 400 });
        }
        const targetExists = existingAttachments.some(att => att.file_token === targetFileToken);
        if (!targetExists) {
          return NextResponse.json({
            success: false,
            error: "指定された差替え対象のファイルが見つかりません",
          }, { status: 400 });
        }
        // 対象ファイルを新しいファイルに置き換え
        attachments = existingAttachments.map(att =>
          att.file_token === targetFileToken ? { file_token: fileToken } : att
        );
      } else {
        // 全ファイル差替え（targetFileTokenなし）- 既存ファイルがない場合はエラー
        if (!existingAttachments || existingAttachments.length === 0) {
          return NextResponse.json({
            success: false,
            error: "差替え対象のファイルが存在しません。新規アップロードを使用してください。",
          }, { status: 400 });
        }
        // 全て新しいファイルに置き換え
        attachments = [{ file_token: fileToken }];
      }
    } else {
      // 追加モード - 既存のファイルを保持して追加
      if (existingAttachments && existingAttachments.length > 0) {
        attachments = [...existingAttachments, { file_token: fileToken }];
      }
    }

    await updateBaseRecord(tables.PROJECT_DOCUMENTS, recordId, {
      [documentType]: attachments,
    });

    console.log("[upload] Upload completed successfully");

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        fileName: file.name,
        documentType,
        fileToken,
      },
    });

  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "アップロード中にエラーが発生しました",
    }, { status: 500 });
  }
}
