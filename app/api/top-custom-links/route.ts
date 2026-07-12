import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { requireKpiProgram, KPI_PROGRAMS } from "@/lib/kpi-permission";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

// テーブルID (AWS Amplify SSR用フォールバック値付き)
const CUSTOM_LINKS_TABLE_ID = process.env.LARK_TABLE_TOP_CUSTOM_LINKS || "tblup7d4meehzX92";

// 共通リンク(全ログインユーザーに表示)のユーザーID。これ以外は個別ユーザー専用。
const COMMON_USER_ID = "ALL";

/** scope("common"=共通/"personal"=個人) と セッションユーザーID から保存先ユーザーIDを決定。既定=共通(ALL)。 */
function resolveOwnerId(scope: unknown, sessionUserId: string): string {
  return scope === "personal" ? sessionUserId : COMMON_USER_ID;
}

/** 指定レコードの所有者(ユーザーID)を取得。存在しなければ null。 */
async function getLinkOwnerId(
  client: NonNullable<ReturnType<typeof getLarkClient>>,
  baseToken: string,
  recordId: string
): Promise<string | null> {
  try {
    const res = await client.bitable.appTableRecord.get({
      path: { app_token: baseToken, table_id: CUSTOM_LINKS_TABLE_ID, record_id: recordId },
    });
    const uid = (res.data?.record?.fields as any)?.[FIELDS.USER_ID];
    if (typeof uid === "string") return uid;
    if (uid && typeof uid === "object") return uid.text ?? null;
    return null;
  } catch {
    return null;
  }
}

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
    console.log("[top-custom-links] LARK_TABLE_TOP_CUSTOM_LINKS not configured");
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

    console.log("[top-custom-links] Fetching links for user:", {
      userId,
      tableId: CUSTOM_LINKS_TABLE_ID,
      baseToken: baseToken.substring(0, 10) + "...",
    });

    const links: CustomLink[] = [];
    let pageToken: string | undefined;

    // 共通(ALL=全ユーザー表示)と本人個別の両方を取得
    const userIdEsc = escapeLarkFilterValue(userId);
    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: baseToken,
          table_id: CUSTOM_LINKS_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: `OR(CurrentValue.[${FIELDS.USER_ID}] = "${COMMON_USER_ID}", CurrentValue.[${FIELDS.USER_ID}] = "${userIdEsc}")`,
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

    console.log("[top-custom-links] Found", links.length, "links for user:", userId);

    return NextResponse.json({
      success: true,
      links,
    });
  } catch (error: any) {
    console.error("[top-custom-links] GET Error:", error);
    return NextResponse.json(
      {
        error: "カスタムリンクの取得に失敗しました",
      },
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
    // セッションからユーザーIDを取得（未ログインは拒否）
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { display_name, url, icon_url, sort_order, scope } = body;

    if (!display_name || !url) {
      return NextResponse.json(
        { error: "表示名とURLは必須です" },
        { status: 400 }
      );
    }

    // 公開範囲: 既定=共通(ALL=全ユーザー表示)。scope="personal" のときのみ本人専用。
    const ownerId = resolveOwnerId(scope, userId);

    // 共通(全員表示)リンクの作成は管理者のみ。誰でも全員向けリンクを作れると
    // フィッシング(全ユーザーに悪意あるリンク表示)が可能になるため。
    if (ownerId === COMMON_USER_ID) {
      const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
      if (!gate.authorized) return gate.response;
    }

    const now = Date.now();

    const response = await client.bitable.appTableRecord.create({
      path: {
        app_token: baseToken,
        table_id: CUSTOM_LINKS_TABLE_ID,
      },
      data: {
        fields: {
          [FIELDS.USER_ID]: ownerId,
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
      { error: "カスタムリンクの作成に失敗しました"},
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
    // 未ログインは拒否
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { record_id, display_name, url, icon_url, sort_order, is_active, scope } = body;

    if (!record_id) {
      return NextResponse.json(
        { error: "record_idは必須です" },
        { status: 400 }
      );
    }

    // 所有権チェック: 対象が共通リンク、または共通へ昇格する場合は管理者のみ。
    // 個人リンクは本人のみ更新可。IDOR(他人/共通リンクの改変)対策。
    const currentOwner = await getLinkOwnerId(client, baseToken, record_id);
    if (currentOwner === null) {
      return NextResponse.json({ error: "対象のリンクが見つかりません" }, { status: 404 });
    }
    const promotingToCommon = scope !== undefined && resolveOwnerId(scope, userId) === COMMON_USER_ID;
    if (currentOwner === COMMON_USER_ID || promotingToCommon) {
      const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
      if (!gate.authorized) return gate.response;
    } else if (currentOwner !== userId) {
      return NextResponse.json({ error: "このリンクを更新する権限がありません" }, { status: 403 });
    }

    const updateFields: any = {
      [FIELDS.UPDATED_AT]: Date.now(),
    };

    if (display_name !== undefined) updateFields[FIELDS.DISPLAY_NAME] = display_name;
    if (url !== undefined) updateFields[FIELDS.URL] = url;
    if (icon_url !== undefined) updateFields[FIELDS.ICON_URL] = icon_url;
    if (sort_order !== undefined) updateFields[FIELDS.SORT_ORDER] = sort_order;
    if (is_active !== undefined) updateFields[FIELDS.IS_ACTIVE] = is_active;
    // 公開範囲(共通/個人)の切替。personal は本人IDを保存先にする。
    if (scope !== undefined) {
      updateFields[FIELDS.USER_ID] = resolveOwnerId(scope, userId);
    }

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
      { error: "カスタムリンクの更新に失敗しました"},
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
    // 未ログインは拒否
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("record_id");

    if (!recordId) {
      return NextResponse.json(
        { error: "record_idは必須です" },
        { status: 400 }
      );
    }

    // 所有権チェック: 共通リンクの削除は管理者のみ、個人リンクは本人のみ。IDOR対策。
    const currentOwner = await getLinkOwnerId(client, baseToken, recordId);
    if (currentOwner === null) {
      return NextResponse.json({ error: "対象のリンクが見つかりません" }, { status: 404 });
    }
    if (currentOwner === COMMON_USER_ID) {
      const gate = await requireKpiProgram(KPI_PROGRAMS.SEISAN_MASTER);
      if (!gate.authorized) return gate.response;
    } else if (currentOwner !== userId) {
      return NextResponse.json({ error: "このリンクを削除する権限がありません" }, { status: 403 });
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
      { error: "カスタムリンクの削除に失敗しました"},
      { status: 500 }
    );
  }
}
