import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getLarkClient, getLarkBaseToken, getBaseRecords, updateBaseRecord } from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { getLarkTables } from "@/lib/lark-tables";
import { isDangerousUploadName } from "@/lib/upload-validation";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // アップロードには時間がかかる場合があるため

// ファイルサイズ上限: 5MB。
// AWS Amplify(Lambda)のリクエスト本文上限 約6MB が実質的な天井。
// octet-stream(生バイナリ)送信ならBase64膨張(約1.37倍)が無いため、5MBの生ファイルでも本文は約5MBに収まり安全。
// (従来のBase64 JSON送信は膨張のため実質4.3MBが限界だった)
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
    // tokenOnly: Drive へアップロードして file_token だけ返す（レコード更新しない）。
    // 大量アップロードを並列化しても添付列の lost update を起こさないための分離。
    let tokenOnly = false;

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
      tokenOnly = json.tokenOnly === true || json.tokenOnly === "true";
    } else if (contentType.includes("application/octet-stream")) {
      // 生バイナリ形式 (Base64膨張を避け上限を引き上げるため。メタデータはクエリで受け取る)
      const sp = request.nextUrl.searchParams;
      const buffer = Buffer.from(await request.arrayBuffer());
      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({
          success: false,
          error: `ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています`,
        }, { status: 400 });
      }
      const fileName = sp.get("fileName") || "file";
      const mimeType = sp.get("mimeType") || "application/octet-stream";
      file = new File([buffer], fileName, { type: mimeType });
      seiban = sp.get("seiban");
      documentType = sp.get("documentType");
      replaceMode = sp.get("replace") === "true";
      targetFileToken = sp.get("targetFileToken") || null;
      tokenOnly = sp.get("tokenOnly") === "true";
      console.log("[upload] octet-stream payload received:", { fileName, seiban, documentType, size: buffer.length, tokenOnly });
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
    // サイズ上限(両経路共通。FormData経路は従来未チェックだった=メモリ枯渇DoS対策)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています`,
      }, { status: 400 });
    }
    // 危険な拡張子(html/svg/js等)は業務文書に不要のため拒否(保存型XSSの多層防御)
    if (isDangerousUploadName(file.name)) {
      return NextResponse.json({
        success: false,
        error: "この形式のファイルはアップロードできません",
      }, { status: 400 });
    }
    // tokenOnly は Drive にアップロードするだけなので seiban/documentType は不要
    if (!tokenOnly && (!seiban || !documentType)) {
      return NextResponse.json({ success: false, error: "必須パラメータが不足しています" }, { status: 400 });
    }

    console.log("[upload] Starting upload:", { fileName: file.name, fileSize: file.size, seiban, documentType, tokenOnly });

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });
    }

    const tables = getLarkTables();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 添付先レコードの解決は tokenOnly では不要（更新しないため）
    let recordId: string | undefined;
    let existingAttachments: { file_token: string }[] | undefined;

    if (!tokenOnly) {
      // テーブルのフィールド情報を取得
      const tableInfoResponse = await client.bitable.appTableField.list({
        path: { app_token: getLarkBaseToken(), table_id: tables.PROJECT_DOCUMENTS },
      });
      const targetField = tableInfoResponse.data?.items?.find((field: any) => field.field_name === documentType);
      if (!targetField) {
        return NextResponse.json({
          success: false,
          error: `書類種別「${documentType}」に対応するフィールドが見つかりません`,
        }, { status: 400 });
      }

      // 製番でレコードを検索
      const filter = `CurrentValue.[製番] = "${escapeLarkFilterValue(seiban!)}"`;
      const existingRecords = await getBaseRecords(tables.PROJECT_DOCUMENTS, { filter });
      recordId = existingRecords.data?.items?.[0]?.record_id as string | undefined;
      if (!recordId) {
        return NextResponse.json({
          success: false,
          error: `製番「${seiban}」の案件書庫レコードが見つかりません。先に案件書庫にレコードを作成してください。`,
        }, { status: 400 });
      }
      existingAttachments = existingRecords.data?.items?.[0]?.fields?.[documentType!] as { file_token: string }[] | undefined;
      console.log("[upload] Found record:", recordId);
    }

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

    // tokenOnly: file_token だけ返して終了（レコード更新は /api/documents/attach で一括実行）
    if (tokenOnly) {
      return NextResponse.json({ success: true, fileToken, data: { fileToken } });
    }

    // 3. レコードを更新して添付フィールドにfile_tokenを設定
    console.log("[upload] Updating record with attachment, replaceMode:", replaceMode, "targetFileToken:", targetFileToken);

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

    await updateBaseRecord(tables.PROJECT_DOCUMENTS, recordId!, {
      [documentType!]: attachments,
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
