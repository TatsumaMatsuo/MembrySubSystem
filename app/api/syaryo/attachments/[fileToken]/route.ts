import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/syaryo/auth-utils";
import { downloadAttachmentFromBase } from "@/lib/syaryo/lark-client";

/**
 * Lark Base 添付ファイルダウンロードAPI
 * GET /api/attachments/[fileToken]
 * 認証済みユーザーのみダウンロード可能
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileToken: string }> }
) {
  try {
    // 認証チェック
    const authCheck = await requireAuth();
    if (!authCheck.authorized) {
      console.warn("[Attachment Download API] Unauthorized download attempt");
      return authCheck.response;
    }

    // Next.js 15: params は Promise なので await が必要
    const { fileToken } = await params;

    if (!fileToken) {
      return NextResponse.json(
        { success: false, error: "ファイルトークンが指定されていません" },
        { status: 400 }
      );
    }

    // クエリパラメータからダウンロードURLを取得（オプション）
    const searchParams = request.nextUrl.searchParams;
    const downloadUrl = searchParams.get("url");

    console.log(`[Attachment Download API] Downloading: ${fileToken}, user: ${authCheck.userId}, hasUrl: ${!!downloadUrl}`);

    // Lark Base からファイルをダウンロード（URLが提供されている場合はそれを使用）
    const buffer = await downloadAttachmentFromBase(fileToken, downloadUrl || undefined);

    if (!buffer) {
      console.error(`[Attachment Download API] File not found: ${fileToken}`);
      return NextResponse.json(
        { success: false, error: "ファイルが見つかりません" },
        { status: 404 }
      );
    }

    // ファイルのマジックバイトからMIMEタイプを判定
    let contentType = "application/octet-stream";
    if (buffer.length >= 4) {
      const header = buffer.slice(0, 4);
      // PDF: %PDF
      if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
        contentType = "application/pdf";
      }
      // PNG: 89 50 4E 47
      else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        contentType = "image/png";
      }
      // JPEG: FF D8 FF
      else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        contentType = "image/jpeg";
      }
      // GIF: GIF8
      else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
        contentType = "image/gif";
      }
      // WebP: RIFF....WEBP
      else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && buffer.length >= 12) {
        const webpHeader = buffer.slice(8, 12);
        if (webpHeader[0] === 0x57 && webpHeader[1] === 0x45 && webpHeader[2] === 0x42 && webpHeader[3] === 0x50) {
          contentType = "image/webp";
        }
      }
    }

    console.log(`[Attachment Download API] Detected content type: ${contentType}`)

    console.log(`[Attachment Download API] Download success - size: ${buffer.length}`);

    // BufferをUint8Arrayに変換（NextResponseの型互換性のため）
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Attachment Download API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "ファイルのダウンロードに失敗しました",
      },
      { status: 500 }
    );
  }
}
