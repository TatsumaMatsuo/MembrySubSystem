import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { LarkTableField, LARK_FIELD_TYPE_MAP } from "@/types/data-mapping";

// GET: Larkテーブルのフィールド一覧を取得
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("tableId");
  const baseToken = searchParams.get("baseToken");

  if (!tableId) {
    return NextResponse.json(
      { error: "tableIdが必要です" },
      { status: 400 }
    );
  }

  const client = getLarkClient();
  if (!client) {
    return NextResponse.json(
      { error: "Lark client not initialized" },
      { status: 500 }
    );
  }

  try {
    const token = baseToken || getLarkBaseToken();

    const response = await client.bitable.appTableField.list({
      path: {
        app_token: token,
        table_id: tableId,
      },
      params: {
        page_size: 100,
      },
    });

    if (!response.data?.items) {
      return NextResponse.json({ fields: [] });
    }

    const fields: LarkTableField[] = response.data.items.map((item: any) => ({
      field_id: item.field_id,
      field_name: item.field_name,
      type: item.type,
    }));

    // フィールドタイプを追加
    const fieldsWithType = fields.map((field) => ({
      ...field,
      fieldType: LARK_FIELD_TYPE_MAP[field.type] || "text",
    }));

    return NextResponse.json({ fields: fieldsWithType });
  } catch (error: any) {
    console.error("[data-mapping/fields] Error:", error);

    // 権限エラーの場合
    if (error.code === 403 || error.message?.includes("403")) {
      return NextResponse.json(
        { error: "テーブルへのアクセス権限がありません。Base Tokenを確認してください。" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "フィールド情報の取得に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
