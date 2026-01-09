import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseTokenForEmployees } from "@/lib/lark-client";
import { getLarkTables } from "@/lib/lark-tables";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const tables = getLarkTables();
  const baseToken = getLarkBaseTokenForEmployees();

  try {
    // まずフィールド一覧を取得
    const fieldsResponse = await client.bitable.appTableField.list({
      path: {
        app_token: baseToken,
        table_id: tables.EMPLOYEES,
      },
    });

    // レコードを取得
    const recordsResponse = await client.bitable.appTableRecord.list({
      path: {
        app_token: baseToken,
        table_id: tables.EMPLOYEES,
      },
      params: {
        page_size: 5,
      },
    });

    return NextResponse.json({
      tableId: tables.EMPLOYEES,
      fieldsCount: fieldsResponse.data?.items?.length || 0,
      fields: fieldsResponse.data?.items?.map((f: any) => ({
        field_id: f.field_id,
        field_name: f.field_name,
        type: f.type,
      })),
      recordsCount: recordsResponse.data?.items?.length || 0,
      sampleRecords: recordsResponse.data?.items?.slice(0, 3).map((r: any) => ({
        record_id: r.record_id,
        fields: r.fields,
      })),
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
