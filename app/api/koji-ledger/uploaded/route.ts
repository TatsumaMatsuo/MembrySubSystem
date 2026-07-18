import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords } from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { getLarkTables } from "@/lib/lark-tables";

// 工事写真台帳: 案件書庫「工事写真アップロード」列の写真(ローカル追加分)を取得(#94)
// GET ?seiban=XXX → { success, tableId(案件書庫), photos: [{file_token, name}] }
// 追加(アップロード)自体は /api/documents/upload を documentType="工事写真アップロード" で利用する。
// ※ディレクトリ名は .gitignore の "uploads/" 除外を避けるため "uploaded" とする。
export const dynamic = "force-dynamic";

const UPLOAD_FIELD = "工事写真アップロード";

export async function GET(request: NextRequest) {
  try {
    const seiban = request.nextUrl.searchParams.get("seiban")?.trim();
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番が指定されていません" }, { status: 400 });
    }
    const tables = getLarkTables();
    const filter = `CurrentValue.[製番] = "${escapeLarkFilterValue(seiban)}"`;
    const res = await getBaseRecords(tables.PROJECT_DOCUMENTS, { filter, pageSize: 1 });
    const rec = res.data?.items?.[0];
    const atts = (rec?.fields?.[UPLOAD_FIELD] as any[]) || [];
    const photos = atts
      .filter((a) => a?.file_token)
      .map((a) => ({ file_token: a.file_token as string, name: (a.name as string) || "photo" }));
    return NextResponse.json({ success: true, tableId: tables.PROJECT_DOCUMENTS, photos });
  } catch (e: any) {
    console.error("[koji-ledger/uploaded] GET error", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
