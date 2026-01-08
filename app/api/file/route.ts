import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileToken = searchParams.get("file_token");

    if (!fileToken) {
      return NextResponse.json(
        { success: false, error: "file_token is required" },
        { status: 400 }
      );
    }

    console.log("[file-api] Getting download URL for file_token:", fileToken);

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Lark client not initialized" },
        { status: 500 }
      );
    }

    // Bitable添付ファイル用の一時ダウンロードURL取得
    // extraパラメータでbitablePermを指定する必要がある
    const extra = JSON.stringify({
      bitablePerm: {
        tableId: process.env.LARK_TABLE_PROJECT_DOCUMENTS || "",
        rev: 0,
      },
    });

    const response = await client.drive.media.batchGetTmpDownloadUrl({
      params: {
        file_tokens: fileToken,
        extra: extra,
      },
    });

    console.log("[file-api] Lark API response:", JSON.stringify(response, null, 2));

    if (response.code !== 0) {
      console.error("[file-api] Lark API error:", response);
      return NextResponse.json(
        { success: false, error: response.msg || "Failed to get file URL" },
        { status: 500 }
      );
    }

    const tmpUrls = response.data?.tmp_download_urls;
    if (!tmpUrls || tmpUrls.length === 0) {
      console.error("[file-api] No tmp_download_urls in response");
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    console.log("[file-api] Got download URL:", tmpUrls[0].tmp_download_url);

    return NextResponse.json({
      success: true,
      data: {
        url: tmpUrls[0].tmp_download_url,
        file_token: tmpUrls[0].file_token,
      },
    });
  } catch (error) {
    console.error("[file-api] Error getting file URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get file URL" },
      { status: 500 }
    );
  }
}
