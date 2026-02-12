import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileToken = searchParams.get("file_token");
    const source = searchParams.get("source");

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

    const tables = getLarkTables();
    const targetTableId = source === "history"
      ? tables.DOCUMENT_HISTORY
      : tables.PROJECT_DOCUMENTS || process.env.LARK_TABLE_PROJECT_DOCUMENTS || "";

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

    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileResponse.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "private, max-age=300",
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
