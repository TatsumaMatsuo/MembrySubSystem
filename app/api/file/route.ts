import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileToken = searchParams.get("file_token");
    const tableId = searchParams.get("table_id");
    const source = searchParams.get("source"); // "history" の場合は履歴テーブルを使用

    if (!fileToken) {
      return NextResponse.json(
        { success: false, error: "file_token is required" },
        { status: 400 }
      );
    }

    console.log("[file-api] Getting download URL for file_token:", fileToken, "tableId:", tableId, "source:", source);

    const client = getLarkClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Lark client not initialized" },
        { status: 500 }
      );
    }

    // tableIdの決定: source指定 > tableId指定 > デフォルト
    const tables = getLarkTables();
    let targetTableId: string;
    if (source === "history") {
      targetTableId = tables.DOCUMENT_HISTORY;
    } else {
      targetTableId = tableId || tables.PROJECT_DOCUMENTS || process.env.LARK_TABLE_PROJECT_DOCUMENTS || "";
    }

    // Bitable添付ファイル用の一時ダウンロードURL取得
    // extraパラメータでbitablePermを指定する必要がある
    const extra = JSON.stringify({
      bitablePerm: {
        tableId: targetTableId,
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
