import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/syaryo/auth-utils";
import { uploadAttachmentToBase, LarkAttachment } from "@/lib/syaryo/lark-client";
import crypto from "crypto";

/**
 * Lark Base 添付ファイルアップロードAPI
 * POST /api/upload-attachment
 * 認証済みユーザーのみアップロード可能
 * Lark Base の添付ファイルフィールド用にファイルをアップロード
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authCheck = await requireAuth();
    if (!authCheck.authorized) {
      console.warn("[Upload Attachment API] Unauthorized upload attempt");
      return authCheck.response;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（10MB制限）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "ファイルサイズが大きすぎます（最大10MB）" },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "サポートされていないファイル形式です（JPEG、PNG、PDFのみ）",
        },
        { status: 400 }
      );
    }

    // ファイルをBufferに変換
    const buffer = Buffer.from(await file.arrayBuffer());

    // ユニークなファイル名を生成
    const uniqueId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFilename = `${uniqueId}_${sanitizedName}`;

    console.log(`[Upload Attachment API] Uploading: ${uniqueFilename}, type: ${file.type}, size: ${file.size}, user: ${authCheck.userId}`);

    // Lark Base添付ファイルとしてアップロード
    const attachment = await uploadAttachmentToBase(buffer, uniqueFilename, file.type);

    console.log(`[Upload Attachment API] Upload success - file_token: ${attachment.file_token}`);

    return NextResponse.json({
      success: true,
      attachment,
      message: "ファイルのアップロードに成功しました",
    });
  } catch (error) {
    console.error("[Upload Attachment API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "ファイルのアップロードに失敗しました",
      },
      { status: 500 }
    );
  }
}
