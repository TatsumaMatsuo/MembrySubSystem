import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseToken } from "@/lib/lark-client";
import { DataMappingConfig, FieldMapping } from "@/types/data-mapping";

// マッピング設定テーブルID
const MAPPING_TABLE_ID = "tbl9Vuq1DizM400V";

// Larkレコードから設定オブジェクトに変換
function recordToConfig(record: any): DataMappingConfig {
  const fields = record.fields || {};

  // マッピング定義をパース
  let mappings: FieldMapping[] = [];
  try {
    if (fields["マッピング定義"]) {
      const parsed = JSON.parse(fields["マッピング定義"]);
      if (Array.isArray(parsed)) {
        mappings = parsed;
      }
    }
  } catch (e) {
    console.error("[data-mapping] Failed to parse mappings:", e);
  }

  return {
    id: fields["設定ID"] || record.record_id,
    name: fields["設定名"] || "",
    description: fields["説明"] || "",
    tableId: fields["テーブルID"] || "",
    baseToken: fields["BaseToken"] || undefined,
    keyField: fields["キー項目"] || "",
    mappings,
    createdAt: fields["作成日時"] ? new Date(fields["作成日時"]).toISOString() : "",
    updatedAt: fields["更新日時"] ? new Date(fields["更新日時"]).toISOString() : "",
  };
}

// GET: マッピング設定一覧を取得
export async function GET(request: NextRequest): Promise<NextResponse> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get("id");

    const configs: DataMappingConfig[] = [];
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: MAPPING_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          // 有効フラグがtrueのものだけ取得（または全て）
        },
      });

      if (response.data?.items) {
        for (const item of response.data.items) {
          const config = recordToConfig(item);
          // 特定のIDが指定されている場合はそれだけ返す
          if (configId) {
            if (config.id === configId) {
              return NextResponse.json({ config });
            }
          } else {
            // 有効フラグがfalseでないものを追加
            const isEnabled = (item.fields as any)?.["有効フラグ"];
            if (isEnabled !== false) {
              configs.push(config);
            }
          }
        }
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    if (configId) {
      return NextResponse.json({ error: "設定が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ configs });
  } catch (error: any) {
    console.error("[data-mapping] GET error:", error);
    return NextResponse.json(
      { error: "設定の取得に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// POST: 新規マッピング設定を作成
export async function POST(request: NextRequest): Promise<NextResponse> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, description, tableId, baseToken, keyField, mappings } = body;

    if (!name || !tableId || !keyField || !mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: "必須項目が不足しています（name, tableId, keyField, mappings）" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const configId = `mapping_${now}`;

    const fields: Record<string, any> = {
      "設定ID": configId,
      "設定名": name,
      "説明": description || "",
      "テーブルID": tableId,
      "BaseToken": baseToken || "",
      "キー項目": keyField,
      "マッピング定義": JSON.stringify(mappings),
      "有効フラグ": true,
      "作成日時": now,
      "更新日時": now,
    };

    const response = await client.bitable.appTableRecord.create({
      path: {
        app_token: getLarkBaseToken(),
        table_id: MAPPING_TABLE_ID,
      },
      data: { fields },
    });

    if (!response.data?.record) {
      return NextResponse.json({ error: "レコード作成に失敗しました" }, { status: 500 });
    }

    const newConfig: DataMappingConfig = {
      id: configId,
      name,
      description: description || "",
      tableId,
      baseToken: baseToken || undefined,
      keyField,
      mappings,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    return NextResponse.json({ config: newConfig }, { status: 201 });
  } catch (error: any) {
    console.error("[data-mapping] POST error:", error);
    return NextResponse.json(
      { error: "設定の作成に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: マッピング設定を更新
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { id, name, description, tableId, baseToken, keyField, mappings } = body;

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    // 既存レコードを検索
    let recordId: string | undefined;
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: MAPPING_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: `CurrentValue.[設定ID] = "${id}"`,
        },
      });

      if (response.data?.items && response.data.items.length > 0) {
        recordId = response.data.items[0].record_id;
        break;
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    if (!recordId) {
      return NextResponse.json({ error: "指定されたIDの設定が見つかりません" }, { status: 404 });
    }

    const now = Date.now();
    const fields: Record<string, any> = {
      "更新日時": now,
    };

    if (name !== undefined) fields["設定名"] = name;
    if (description !== undefined) fields["説明"] = description;
    if (tableId !== undefined) fields["テーブルID"] = tableId;
    if (baseToken !== undefined) fields["BaseToken"] = baseToken || "";
    if (keyField !== undefined) fields["キー項目"] = keyField;
    if (mappings !== undefined) fields["マッピング定義"] = JSON.stringify(mappings);

    await client.bitable.appTableRecord.update({
      path: {
        app_token: getLarkBaseToken(),
        table_id: MAPPING_TABLE_ID,
        record_id: recordId,
      },
      data: { fields },
    });

    return NextResponse.json({
      success: true,
      config: {
        id,
        name,
        description,
        tableId,
        baseToken,
        keyField,
        mappings,
        updatedAt: new Date(now).toISOString(),
      }
    });
  } catch (error: any) {
    console.error("[data-mapping] PUT error:", error);
    return NextResponse.json(
      { error: "設定の更新に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: マッピング設定を削除（論理削除：有効フラグをfalseに）
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    // 既存レコードを検索
    let recordId: string | undefined;
    let pageToken: string | undefined;

    do {
      const response = await client.bitable.appTableRecord.list({
        path: {
          app_token: getLarkBaseToken(),
          table_id: MAPPING_TABLE_ID,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: `CurrentValue.[設定ID] = "${id}"`,
        },
      });

      if (response.data?.items && response.data.items.length > 0) {
        recordId = response.data.items[0].record_id;
        break;
      }
      pageToken = response.data?.page_token;
    } while (pageToken);

    if (!recordId) {
      return NextResponse.json({ error: "指定されたIDの設定が見つかりません" }, { status: 404 });
    }

    // 論理削除（有効フラグをfalseに）
    await client.bitable.appTableRecord.update({
      path: {
        app_token: getLarkBaseToken(),
        table_id: MAPPING_TABLE_ID,
        record_id: recordId,
      },
      data: {
        fields: {
          "有効フラグ": false,
          "更新日時": Date.now(),
        },
      },
    });

    return NextResponse.json({ deleted: { id } });
  } catch (error: any) {
    console.error("[data-mapping] DELETE error:", error);
    return NextResponse.json(
      { error: "設定の削除に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
