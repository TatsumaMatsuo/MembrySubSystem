import { NextRequest, NextResponse } from "next/server";
import { getBaseRecords, createBaseRecord, updateBaseRecord, deleteBaseRecord, getLarkBaseTokenForMaster } from "@/lib/lark-client";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";

export const dynamic = "force-dynamic";

// テーブルID (AWS Amplify SSR用フォールバック値付き)
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";
const TABLE_USER_PERMISSION = process.env.LARK_TABLE_USER_PERMISSION || "tbl2hvSUkEe3fn7t";

/**
 * Lark Bitable から指定テーブルの全レコードを取得 (ページネーション対応)
 * 1回の API では最大 500 件しか返らないため、has_more が false になるまで繰り返す。
 */
async function getAllRecords(tableId: string, baseToken: string): Promise<any[]> {
  const items: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const response: any = await getBaseRecords(tableId, {
      baseToken,
      pageSize: 500,
      pageToken,
    });
    items.push(...(response.data?.items || []));
    pageToken = response.data?.has_more ? response.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

type TableType = "menu" | "program" | "group" | "user";

function getTableId(type: TableType): string {
  switch (type) {
    case "menu":
      return TABLE_MENU_DISPLAY;
    case "program":
      return TABLE_FUNCTION_PLACEMENT;
    case "group":
      return TABLE_GROUP_PERMISSION;
    case "user":
      return TABLE_USER_PERMISSION;
    default:
      throw new Error("Invalid table type");
  }
}

/**
 * GET /api/master/menu-permissions
 * マスタデータ取得
 */
export async function GET(request: NextRequest) {
  // 権限マスタは認可の土台。マスタ管理(PGM040)権限を必須化(権限昇格対策)
  const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
  if (!gate.authorized) return gate.response;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TableType;

    if (!type) {
      // 全テーブルのデータを取得 (各テーブル全件、ページネーションで取得)
      const baseToken = getLarkBaseTokenForMaster();
      const [menus, programs, groups, users] = await Promise.all([
        getAllRecords(TABLE_MENU_DISPLAY, baseToken),
        getAllRecords(TABLE_FUNCTION_PLACEMENT, baseToken),
        getAllRecords(TABLE_GROUP_PERMISSION, baseToken),
        getAllRecords(TABLE_USER_PERMISSION, baseToken),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          menus,
          programs,
          groups,
          users,
        },
      });
    }

    const tableId = getTableId(type);
    const baseToken = getLarkBaseTokenForMaster();
    const items = await getAllRecords(tableId, baseToken);

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("[menu-permissions] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/menu-permissions
 * レコード新規作成
 */
export async function POST(request: NextRequest) {
  const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
  if (!gate.authorized) return gate.response;
  try {
    const body = await request.json();
    const { type, fields } = body;

    if (!type || !fields) {
      return NextResponse.json(
        { success: false, error: "type と fields は必須です" },
        { status: 400 }
      );
    }

    const tableId = getTableId(type as TableType);
    const baseToken = getLarkBaseTokenForMaster();

    const response = await createBaseRecord(tableId, fields, { baseToken });

    if (response.code !== 0) {
      return NextResponse.json(
        { success: false, error: response.msg || "作成に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data?.record,
    });
  } catch (error) {
    console.error("[menu-permissions] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "レコードの作成に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/master/menu-permissions
 * レコード更新
 */
export async function PUT(request: NextRequest) {
  const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
  if (!gate.authorized) return gate.response;
  try {
    const body = await request.json();
    const { type, record_id, fields } = body;

    if (!type || !record_id || !fields) {
      return NextResponse.json(
        { success: false, error: "type, record_id, fields は必須です" },
        { status: 400 }
      );
    }

    const tableId = getTableId(type as TableType);
    const baseToken = getLarkBaseTokenForMaster();

    const response = await updateBaseRecord(tableId, record_id, fields, { baseToken });

    if (response.code !== 0) {
      return NextResponse.json(
        { success: false, error: response.msg || "更新に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data?.record,
    });
  } catch (error) {
    console.error("[menu-permissions] PUT Error:", error);
    return NextResponse.json(
      { success: false, error: "レコードの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master/menu-permissions
 * レコード削除
 */
export async function DELETE(request: NextRequest) {
  const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
  if (!gate.authorized) return gate.response;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TableType;
    const record_id = searchParams.get("record_id");

    if (!type || !record_id) {
      return NextResponse.json(
        { success: false, error: "type と record_id は必須です" },
        { status: 400 }
      );
    }

    const tableId = getTableId(type);
    const baseToken = getLarkBaseTokenForMaster();

    const response = await deleteBaseRecord(tableId, record_id, { baseToken });

    if (response.code !== 0) {
      return NextResponse.json(
        { success: false, error: response.msg || "削除に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[menu-permissions] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "レコードの削除に失敗しました" },
      { status: 500 }
    );
  }
}
