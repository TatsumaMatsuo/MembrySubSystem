import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    // Lark Baseの全テーブル一覧を取得
    const response = await client.bitable.appTable.list({
      path: {
        app_token: getLarkBaseToken(),
      },
    });

    return NextResponse.json({
      success: true,
      tables: response.data?.items?.map((t: any) => ({
        table_id: t.table_id,
        name: t.name,
        revision: t.revision,
      })),
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
