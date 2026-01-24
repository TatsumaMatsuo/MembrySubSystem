import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";

// テーブルID
const CUSTOM_LINKS_TABLE_ID = process.env.LARK_TABLE_TOP_CUSTOM_LINKS || "";

// フィールド名
const FIELDS = {
  USER_ID: "ユーザーID",
  DISPLAY_NAME: "表示名",
  URL: "URL",
  ICON_URL: "アイコンURL",
  SORT_ORDER: "表示順",
  IS_ACTIVE: "有効フラグ",
  CREATED_AT: "作成日時",
  UPDATED_AT: "更新日時",
};

export interface CustomLink {
  record_id?: string;
  user_id: string;
  display_name: string;
  url: string;
  icon_url?: string;
  sort_order: number;
  is_active: boolean;
}

// GET: ユーザーのカスタムリンク一覧を取得
export async function GET(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  if (!CUSTOM_LINKS_TABLE_ID) {
    return NextResponse.json({
      success: true,
      links: [],
      message: "LARK_TABLE_TOP_CUSTOM_LINKS is not configured"
    });
  }

  const baseToken = getLarkBaseToken();

  try {
    // セッションからユーザーIDを取得（社員コード → Lark ID → default）
    const session = await getServerSession();
    const userId = session?.user?.id || "default";

    const links: CustomLink[] = [];
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: CUSTOM_LINKS_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: `CurrentValue.[${FIELDS.USER_ID}] = "${userId}"`,
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const fields = item.fields as any;
          links.push({
            record_id: item.record_id,
            user_id: fields?.[FIELDS.USER_ID] || "",
            display_name: fields?.[FIELDS.DISPLAY_NAME] || "",
            url: fields?.[FIELDS.URL] || "",
            icon_url: fields?.[FIELDS.ICON_URL] || "",
            sort_order: Number(fields?.[FIELDS.SORT_ORDER]) || 0,
            is_active: fields?.[FIELDS.IS_ACTIVE] !== false,
          });
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    // 表示順でソート
    links.sort((a, b) => a.sort_order - b.sort_order);

    return NextResponse.json({
      success: true,
      links,
    });
  } catch (error: any) {
    console.error("[top-custom-links] GET Error:", error);
    return NextResponse.json(
      { error: "カスタムリンクの取得に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// POST: 新規カスタムリンクを作成
export async function POST(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  if (!CUSTOM_LINKS_TABLE_ID) {
    return NextResponse.json(
      { error: "LARK_TABLE_TOP_CUSTOM_LINKS is not configured" },
      { status: 500 }
    );
  }

  const baseToken = getLarkBaseToken();

  try {
    // セッションからユーザーIDを取得（社員コード → Lark ID → default）
    const session = await getServerSession();
    const userId = session?.user?.id || "default";

    const body = await request.json();
    const { display_name, url, icon_url, sort_order } = body;

    if (!display_name || !url) {
      return NextResponse.json(
        { error: "表示名とURLは必須です" },
        { status: 400 }
      );
    }

    const now = Date.now();

    const response = await client.bitable.appTableRecord.create({
      path: {
        app_token: baseToken,
        table_id: CUSTOM_LINKS_TABLE_ID,
      },
      data: {
        fields: {
          [FIELDS.USER_ID]: userId,
          [FIELDS.DISPLAY_NAME]: display_name,
          [FIELDS.URL]: url,
          [FIELDS.ICON_URL]: icon_url || "",
          [FIELDS.SORT_ORDER]: sort_order || 0,
          [FIELDS.IS_ACTIVE]: true,
          [FIELDS.CREATED_AT]: now,
          [FIELDS.UPDATED_AT]: now,
        },
      },
    });

    if (response.code !== 0) {
      return NextResponse.json(
        { error: `作成に失敗しました: ${response.msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      record_id: response.data?.record?.record_id,
    });
  } catch (error: any) {
    console.error("[top-custom-links] POST Error:", error);
    return NextResponse.json(
      { error: "カスタムリンクの作成に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: カスタムリンクを更新
export async function PUT(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  if (!CUSTOM_LINKS_TABLE_ID) {
    return NextResponse.json(
      { error: "LARK_TABLE_TOP_CUSTOM_LINKS is not configured" },
      { status: 500 }
    );
  }

  const baseToken = getLarkBaseToken();

  try {
    const body = await request.json();
    const { record_id, display_name, url, icon_url, sort_order, is_active } = body;

    if (!record_id) {
      return NextResponse.json(
        { error: "record_idは必須です" },
        { status: 400 }
      );
    }

    const updateFields: any = {
      [FIELDS.UPDATED_AT]: Date.now(),
    };

    if (display_name !== undefined) updateFields[FIELDS.DISPLAY_NAME] = display_name;
    if (url !== undefined) updateFields[FIELDS.URL] = url;
    if (icon_url !== undefined) updateFields[FIELDS.ICON_URL] = icon_url;
    if (sort_order !== undefined) updateFields[FIELDS.SORT_ORDER] = sort_order;
    if (is_active !== undefined) updateFields[FIELDS.IS_ACTIVE] = is_active;

    const response = await client.bitable.appTableRecord.update({
      path: {
        app_token: baseToken,
        table_id: CUSTOM_LINKS_TABLE_ID,
        record_id,
      },
      data: {
        fields: updateFields,
      },
    });

    if (response.code !== 0) {
      return NextResponse.json(
        { error: `更新に失敗しました: ${response.msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[top-custom-links] PUT Error:", error);
    return NextResponse.json(
      { error: "カスタムリンクの更新に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: カスタムリンクを削除
export async function DELETE(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  if (!CUSTOM_LINKS_TABLE_ID) {
    return NextResponse.json(
      { error: "LARK_TABLE_TOP_CUSTOM_LINKS is not configured" },
      { status: 500 }
    );
  }

  const baseToken = getLarkBaseToken();

  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("record_id");

    if (!recordId) {
      return NextResponse.json(
        { error: "record_idは必須です" },
        { status: 400 }
      );
    }

    const response = await client.bitable.appTableRecord.delete({
      path: {
        app_token: baseToken,
        table_id: CUSTOM_LINKS_TABLE_ID,
        record_id: recordId,
      },
    });

    if (response.code !== 0) {
      return NextResponse.json(
        { error: `削除に失敗しました: ${response.msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[top-custom-links] DELETE Error:", error);
    return NextResponse.json(
      { error: "カスタムリンクの削除に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
