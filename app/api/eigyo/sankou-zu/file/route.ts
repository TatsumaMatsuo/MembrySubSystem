import { NextResponse } from "next/server";
import { isBoxConfigured, resolveFileIdByName, fetchFileContent } from "@/lib/box-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図面PDF 中継API（Box CCG）。
 *
 * サーバが Box の固定フォルダ(BOX_FOLDER_ID)内を `name`(ファイル名)で検索し、file_id を解決して
 * 実体をストリーム中継する。既定は inline（ブラウザ内/PDFビューアで表示、ダウンロードしない）。
 * `?disposition=attachment` でダウンロード。Boxトークンはサーバ側のみ。認証はミドルウェアでセッション必須。
 *
 * 表示は app/pdf-viewer（pdf.js）から本エンドポイントを参照（売約詳細の図面表示と同方式）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();

  if (!isBoxConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "PDF連携(Box)は未設定です。Box Platformアプリと対象フォルダ(folder_id)の手配後に有効化されます。",
      },
      { status: 501 }
    );
  }
  if (!name) {
    return NextResponse.json({ success: false, error: "ファイル名(name)を指定してください" }, { status: 400 });
  }

  try {
    const fileId = await resolveFileIdByName(name);
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: `図面ファイルが見つかりませんでした: ${name}` },
        { status: 404 }
      );
    }
    const res = await fetchFileContent(fileId);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Boxからの取得に失敗しました (status=${res.status})` },
        { status: 502 }
      );
    }
    const buf = await res.arrayBuffer();

    const lower = name.toLowerCase();
    const rawContentType = lower.endsWith(".pdf")
      ? "application/pdf"
      : res.headers.get("content-type") || "application/octet-stream";
    const enc = encodeURIComponent(name);

    // インライン表示は script 実行の恐れが無い型(PDF/画像。svg/html除外)のみ許可し、
    // それ以外は attachment 強制 + octet-stream 化して保存型XSSを遮断する。
    const requested = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const INLINE_SAFE = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp))\b/i;
    const inlineAllowed = requested === "inline" && INLINE_SAFE.test(rawContentType);
    const disposition = inlineAllowed ? "inline" : "attachment";
    const contentType = inlineAllowed ? rawContentType : "application/octet-stream";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buf.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${enc}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("[sankou-zu/file] Error:", error);
    return NextResponse.json(
      { success: false, error: "PDFの取得に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
