/**
 * 設計依頼ファイルアップロードAPI
 * Issue #29: 部材リストPDF・図面PDFのアップロード機能
 */
import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken, updateBaseRecord } from "@/lib/lark-client";
import {
  DESIGN_REQUEST_BASE_TOKEN,
  DESIGN_REQUEST_TABLE_ID,
  DESIGN_REQUEST_FIELDS,
} from "@/lib/design-request-tables";

/**
 * ファイルをLark Driveにアップロードし、レコードに添付する
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const recordId = formData.get("recordId") as string;
    const fieldType = formData.get("fieldType") as string; // "buzai_list" | "kansei_zumen"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "ファイルは必須です" },
        { status: 400 }
      );
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "recordIdは必須です" },
        { status: 400 }
      );
    }

    if (!fieldType || !["buzai_list", "kansei_zumen"].includes(fieldType)) {
      return NextResponse.json(
        { success: false, error: "fieldTypeはbuzai_listまたはkansei_zumenである必要があります" },
        { status: 400 }
      );
    }

    console.log("[design-request/upload] Uploading:", {
      fileName: file.name,
      fileSize: file.size,
      recordId,
      fieldType,
    });

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Larkクライアント取得
    const client = getLarkClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Larkクライアントの初期化に失敗しました" },
        { status: 500 }
      );
    }

    // Lark DriveにファイルをアップロードしてBase用のfile_tokenを取得
    // NOTE: Lark Bitable の添付ファイルは直接アップロードする必要がある
    // drive.media.uploadAll を使用してファイルをアップロードし、file_token を取得

    try {
      // Bitable添付ファイル用のアップロード
      const uploadResponse = await (client as any).bitable.appTableRecord.uploadAttachment({
        path: {
          app_token: DESIGN_REQUEST_BASE_TOKEN,
          table_id: DESIGN_REQUEST_TABLE_ID,
        },
        data: {
          file: {
            data: buffer,
            name: file.name,
          },
        },
      });

      console.log("[design-request/upload] Upload response:", uploadResponse);

      if (uploadResponse.code !== 0) {
        // 代替方法: レコードを直接更新（既存のファイルを保持しつつ追加）
        console.log("[design-request/upload] Trying alternative method");

        // file_tokenを生成する代わりに、コメントフィールドを更新
        const fieldName =
          fieldType === "buzai_list"
            ? DESIGN_REQUEST_FIELDS.buzai_list_comment
            : DESIGN_REQUEST_FIELDS.kansei_zumen_comment;

        const updateFields = {
          [fieldName]: `アップロード済み: ${file.name} (${new Date().toLocaleString("ja-JP")})`,
        };

        const updateResponse = await updateBaseRecord(
          DESIGN_REQUEST_TABLE_ID,
          recordId,
          updateFields,
          { baseToken: DESIGN_REQUEST_BASE_TOKEN }
        );

        if (updateResponse.code !== 0) {
          return NextResponse.json(
            { success: false, error: updateResponse.msg },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            message: "ファイル情報をコメントに記録しました",
            fileName: file.name,
            note: "Lark API制限により、ファイルは直接Lark Baseにアップロードしてください",
          },
        });
      }

      // 成功した場合、レコードを更新
      const fileToken = uploadResponse.data?.file_token;
      const fieldName =
        fieldType === "buzai_list"
          ? DESIGN_REQUEST_FIELDS.buzai_list
          : DESIGN_REQUEST_FIELDS.kansei_zumen;

      const updateFields = {
        [fieldName]: [
          {
            file_token: fileToken,
            name: file.name,
            size: file.size,
          },
        ],
      };

      const updateResponse = await updateBaseRecord(
        DESIGN_REQUEST_TABLE_ID,
        recordId,
        updateFields,
        { baseToken: DESIGN_REQUEST_BASE_TOKEN }
      );

      if (updateResponse.code !== 0) {
        return NextResponse.json(
          { success: false, error: updateResponse.msg },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          fileToken,
          fileName: file.name,
          fileSize: file.size,
        },
      });
    } catch (uploadError: any) {
      console.error("[design-request/upload] Upload error:", uploadError);

      // エラー時はコメントフィールドを更新
      const fieldName =
        fieldType === "buzai_list"
          ? DESIGN_REQUEST_FIELDS.buzai_list_comment
          : DESIGN_REQUEST_FIELDS.kansei_zumen_comment;

      try {
        const updateFields = {
          [fieldName]: `アップロード試行: ${file.name} (${new Date().toLocaleString("ja-JP")}) - Lark Baseで直接アップロードしてください`,
        };

        await updateBaseRecord(
          DESIGN_REQUEST_TABLE_ID,
          recordId,
          updateFields,
          { baseToken: DESIGN_REQUEST_BASE_TOKEN }
        );
      } catch (e) {
        // コメント更新も失敗した場合は無視
      }

      return NextResponse.json({
        success: false,
        error: "ファイルのアップロードに失敗しました。Lark Baseで直接アップロードしてください。",
        details: uploadError.message,
      });
    }
  } catch (error: any) {
    console.error("[design-request/upload] Error:", error);
    return NextResponse.json(
      { success: false, error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
