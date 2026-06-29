import { NextResponse } from "next/server";
import { isBoxConfigured, resolveFileIdByName, getDownloadUrl } from "@/lib/box-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図面PDF 中継API（Box CCG）。
 *
 * 設計: docs/eigyo-sankou-zu/README.md §8-A / docs/eigyo-sankou-zu/box-setup.md。
 * サーバが Box の固定フォルダ(BOX_FOLDER_ID)内を `name`(ファイル名)で検索し、file_id を解決して
 * ダウンロード用プレッサインドURLへ302する。Boxトークンはサーバ側のみで保持する。
 * 認証はミドルウェアでセッション必須（未認証は401）。
 *
 * Box未設定(環境変数なし)の間は501を返す。設定すると pdfEnabled=true になり画面の「開く」が有効化。
 */
export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") || "").trim();

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
    const url = await getDownloadUrl(fileId);
    if (!url) {
      return NextResponse.json(
        { success: false, error: "ダウンロードURLを取得できませんでした" },
        { status: 502 }
      );
    }
    // プレッサインドURLへリダイレクト（ブラウザが直接Boxから取得）
    return NextResponse.redirect(url, 302);
  } catch (error: any) {
    console.error("[sankou-zu/file] Error:", error);
    return NextResponse.json(
      { success: false, error: "PDFの取得に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
