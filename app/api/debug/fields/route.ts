import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const tables = getLarkTables();
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("table") || tables.PROJECT_DOCUMENTS;

  try {
    const response = await client.bitable.appTableField.list({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tableId,
      },
    });

    return NextResponse.json({
      tableId,
      fields: response.data?.items?.map((f: any) => ({
        field_id: f.field_id,
        field_name: f.field_name,
        type: f.type,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
