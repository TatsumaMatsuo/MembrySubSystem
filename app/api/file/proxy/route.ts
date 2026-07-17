import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileToken = searchParams.get("file_token");
    const source = searchParams.get("source");
    const tableId = searchParams.get("table_id");

    if (!fileToken) {
      return NextResponse.json(
        { success: false, error: "file_token is required" },
        { status: 400 }
      );
    }

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Lark client not initialized" },
        { status: 500 }
      );
    }

    // tableIdの決定: source指定 > table_id指定 > デフォルト(PROJECT_DOCUMENTS)
    const tables = getLarkTables();
    const targetTableId = source === "history"
      ? tables.DOCUMENT_HISTORY
      : tableId || tables.PROJECT_DOCUMENTS || process.env.LARK_TABLE_PROJECT_DOCUMENTS || "";

    const extra = JSON.stringify({
      bitablePerm: {
        tableId: targetTableId,
        rev: 0,
      },
    });

    const response = await client.drive.media.batchGetTmpDownloadUrl({
      params: {
        file_tokens: [fileToken],
        extra: extra,
      },
    });

    if (response.code !== 0) {
      console.error("[file-proxy] Lark API error:", response);
      return NextResponse.json(
        { success: false, error: response.msg || "Failed to get file URL" },
        { status: 500 }
      );
    }

    const tmpUrls = response.data?.tmp_download_urls;
    if (!tmpUrls || tmpUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    const downloadUrl = tmpUrls[0].tmp_download_url;
    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, error: "Download URL not available" },
        { status: 500 }
      );
    }

    // Fetch the actual file content from Lark temp URL
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to download file: ${fileResponse.status}` },
        { status: 502 }
      );
    }

    const rawContentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileResponse.arrayBuffer();

    // disposition: "inline" でブラウザ内表示、"attachment" でダウンロード。
    // インライン表示は script 実行の恐れが無い型(PDF/画像。svg/htmlは除外)のみ許可し、
    // それ以外は attachment 強制 + Content-Type を octet-stream 化して保存型XSSを遮断する。
    const requested = searchParams.get("disposition") || "inline";
    const fileName = searchParams.get("name") || "file";
    const encodedFileName = encodeURIComponent(fileName);
    const INLINE_SAFE = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp))\b/i;
    const inlineAllowed = requested === "inline" && INLINE_SAFE.test(rawContentType);
    const disposition = inlineAllowed ? "inline" : "attachment";
    const contentType = inlineAllowed ? rawContentType : "application/octet-stream";
    const contentDisposition = `${disposition}; filename*=UTF-8''${encodedFileName}`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[file-proxy] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to proxy file" },
      { status: 500 }
    );
  }
}
