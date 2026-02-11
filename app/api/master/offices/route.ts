import { NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = "force-dynamic";

// コピー経費テーブルの既存レコードから事業所名を抽出
export async function GET() {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ success: false, error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const tables = getLarkTables();
    const tableId = tables.COPY_EXPENSE;
    const baseToken = getLarkBaseToken();

    // コピー経費テーブルから全レコード取得（事業所フィールドのみ必要）
    const officeSet = new Set<string>();
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: { app_token: baseToken, table_id: tableId },
        params: {
          page_size: 500,
          page_token: pageToken,
        },
      });

      if (response.code !== 0) {
        return NextResponse.json(
          { success: false, error: `Lark APIエラー: code=${response.code}, msg=${response.msg}` },
          { status: 500 }
        );
      }

      for (const item of response.data?.items || []) {
        const deptValue = item.fields?.["事業所"] as any;
        if (!deptValue) continue;
        let name = "";
        if (typeof deptValue === "string") {
          name = deptValue.trim();
        } else if (Array.isArray(deptValue) && deptValue.length > 0) {
          const first = deptValue[0];
          name = (typeof first === "object" && first?.text ? first.text : String(first)).trim();
        } else if (typeof deptValue === "object" && deptValue?.text) {
          name = (deptValue.text as string).trim();
        }
        if (name) officeSet.add(name);
      }

      pageToken = response.data?.page_token;
    } while (pageToken);

    const offices = Array.from(officeSet)
      .sort()
      .map((name) => ({ name }));

    return NextResponse.json({
      success: true,
      data: offices,
      total: offices.length,
    });
  } catch (error) {
    console.error("Error fetching offices:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "事業所一覧の取得に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
