import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図面PDF 中継API（プレースホルダ）。
 *
 * 設計: docs/eigyo-sankou-zu/README.md §8-A。
 * Box Platform アプリ(サーバ認証 CCG/JWT) と対象 folder_id が手配でき次第、
 * サーバが Box フォルダ内を `name`(ファイル名) で検索 → file_id → ダウンロード/プレビューURLへ
 * 302、または /embed プレビューを返すよう実装する。Boxトークンはサーバ側のみで保持する。
 *
 * 手配が済むまでは 501 を返す。必要な環境変数: BOX_FOLDER_ID, BOX_CLIENT_ID/BOX_CLIENT_SECRET
 * (CCGの場合) または BOX_JWT_CONFIG_BASE64(JWTの場合), BOX_ENTERPRISE_ID。
 */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") || "";

  const configured =
    process.env.BOX_FOLDER_ID &&
    (process.env.BOX_CLIENT_ID || process.env.BOX_JWT_CONFIG_BASE64);

  if (!configured) {
    return NextResponse.json(
      {
        success: false,
        error:
          "PDF連携(Box)は未設定です。Box Platformアプリと対象フォルダ(folder_id)の手配後に有効化されます。",
      },
      { status: 501 }
    );
  }

  // TODO: Box API でフォルダ内を name 検索 → file_id → プレビュー/DL URL へ 302。
  return NextResponse.json(
    { success: false, error: "PDF中継は未実装です", name },
    { status: 501 }
  );
}
