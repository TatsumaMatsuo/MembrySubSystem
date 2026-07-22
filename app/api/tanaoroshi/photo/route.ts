import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getServerSession } from "@/lib/auth-server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX = 5 * 1024 * 1024; // 5MB

/**
 * 棚卸写真のアップロード（Lark Drive → file_token）。実績レコードの添付列に使う。
 * 生バイナリ(application/octet-stream)で受ける（Base64膨張回避。既存 documents/upload と同方式）。
 *   POST /api/tanaoroshi/photo?name=xxx.jpg   body: 画像バイナリ
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  const client = getLarkClient();
  if (!client) return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return NextResponse.json({ success: false, error: "画像が空です" }, { status: 400 });
    if (buf.length > MAX) return NextResponse.json({ success: false, error: "画像が大きすぎます（5MB以下）" }, { status: 400 });

    const name = (req.nextUrl.searchParams.get("name") || `tanaoroshi_${Date.now()}.jpg`).replace(/[^\w.\-]/g, "_");

    const stream = new Readable({
      read() {
        this.push(buf);
        this.push(null);
      },
    });

    const res: any = await client.drive.media.uploadAll({
      data: {
        file_name: name,
        parent_type: "bitable_file",
        parent_node: getLarkBaseToken(),
        size: buf.length,
        file: stream as any,
      },
    });

    const fileToken = res?.file_token || res?.data?.file_token;
    if (!fileToken) {
      console.error("[tanaoroshi/photo] no file_token", res);
      return NextResponse.json({ success: false, error: "アップロードに失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ success: true, fileToken });
  } catch (e: any) {
    console.error("[tanaoroshi/photo]", e);
    return NextResponse.json({ success: false, error: e?.message || "アップロードに失敗しました" }, { status: 500 });
  }
}
