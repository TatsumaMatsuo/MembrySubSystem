import { NextResponse } from "next/server";
import { isBoxConfigured, uploadFile } from "@/lib/box-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図面PDF アップロードAPI（Box）。
 * 登録画面から multipart で図面ファイルを受け取り、Boxの固定フォルダへ保存する。
 * 同名は新バージョンで上書き。戻り値の name を台帳の「ファイル名」に記録する。
 * 認証はミドルウェアでセッション必須。
 */
export async function POST(request: Request) {
  if (!isBoxConfigured()) {
    return NextResponse.json(
      { success: false, error: "PDF連携(Box)が未設定のためアップロードできません" },
      { status: 501 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "ファイルが指定されていません" }, { status: 400 });
    }
    // ファイル名は指定があれば優先（台帳の命名規則に合わせるため）。無ければ元ファイル名。
    const name = ((form.get("name") as string) || file.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "ファイル名が不正です" }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const result = await uploadFile(name, buf, file.type || "application/octet-stream");
    return NextResponse.json({ success: true, name: result.name, id: result.id });
  } catch (error: any) {
    console.error("[sankou-zu/upload] Error:", error);
    return NextResponse.json(
      { success: false, error: "アップロードに失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
