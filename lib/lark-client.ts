import * as lark from "@larksuiteoapi/node-sdk";

// AWS Amplify SSR では環境変数にアクセスできない場合があるため、フォールバック値を設定
const FALLBACK_APP_ID = "cli_a9d79d0bbf389e1c";
const FALLBACK_APP_SECRET = "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE";
const FALLBACK_BASE_TOKEN = "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const FALLBACK_BASE_TOKEN_MASTER = "J09zbrPDxa5QR8sEgU9jqLlxpxg";

let _larkClient: lark.Client | null = null;

export function getLarkClient(): lark.Client | null {
  const appId = process.env.LARK_APP_ID || FALLBACK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET || FALLBACK_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("[lark-client] Missing LARK_APP_ID or LARK_APP_SECRET");
    return null;
  }

  if (!_larkClient) {
    // ドメイン判定: 環境変数で指定可能、デフォルトは国際版Lark
    const larkDomain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
    console.log("[lark-client] Using domain:", larkDomain, "appId:", appId?.substring(0, 10) + "...");

    _larkClient = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: larkDomain,
    });
  }

  return _larkClient;
}

export const larkClient = {
  get bitable() {
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");
    return client.bitable;
  },
  get contact() {
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");
    return client.contact;
  },
};

export function getLarkBaseToken(): string {
  return process.env.LARK_BASE_TOKEN || FALLBACK_BASE_TOKEN;
}

export function getLarkBaseTokenForEmployees(): string {
  return process.env.LARK_BASE_TOKEN_MASTER || FALLBACK_BASE_TOKEN_MASTER;
}

export function getLarkBaseTokenForMaster(): string {
  return process.env.LARK_BASE_TOKEN_MASTER || FALLBACK_BASE_TOKEN_MASTER;
}

export async function getBaseRecords(tableId: string, params?: {
  filter?: string;
  sort?: Array<string | { field_name: string; desc?: boolean }>;
  pageSize?: number;
  pageToken?: string;
  baseToken?: string;
}) {
  const appToken = params?.baseToken || getLarkBaseToken();
  console.log("[lark-client] getBaseRecords called:", {
    app_token: appToken,
    table_id: tableId,
    filter: params?.filter,
  });
  let lastError: any;
  // 一過性エラー(頻度制限/5xx/ネットワーク)は短い待機で最大3回リトライ。読み取りのみなので安全。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await larkClient.bitable.appTableRecord.list({
        path: {
          app_token: appToken,
          table_id: tableId,
        },
        params: {
          filter: params?.filter,
          sort: params?.sort ? JSON.stringify(params.sort) : undefined,
          page_size: params?.pageSize || 100,
          page_token: params?.pageToken,
        },
      });
      console.log("[lark-client] Response:", {
        code: response.code,
        msg: response.msg,
        total: response.data?.total,
        items_count: response.data?.items?.length,
      });
      return response;
    } catch (error: any) {
      lastError = error;
      const status = error?.status ?? error?.response?.status;
      const detail = error?.response?.data ?? error?.data;
      const code = detail?.code;
      const msg: string = detail?.msg ?? "";
      // Lark頻度制限は HTTP 400/429 + 特定code/メッセージで返ることがある
      const rateLimited =
        [1254607, 1254290, 1254291, 99991400, 99991661].includes(code) ||
        /frequenc|rate.?limit|too many|limit exceeded|限流|限频|频繁/i.test(msg);
      const transient =
        status === 429 || (typeof status === "number" && status >= 500 && status < 600) ||
        error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND" ||
        rateLimited;
      if (transient && attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  // 恒久エラー: Larkの詳細(table/status/code/msg)を含めて投げ直し、真因を特定できるようにする。
  const detail = lastError?.response?.data ?? lastError?.data;
  const status = lastError?.status ?? lastError?.response?.status;
  console.error("Error fetching Lark Base records:", {
    table_id: tableId,
    filter: params?.filter,
    status,
    detail: detail ? JSON.stringify(detail).slice(0, 500) : undefined,
  });
  if (detail?.code != null || detail?.msg) {
    throw new Error(`Lark取得失敗 table=${tableId} status=${status ?? "?"} code=${detail?.code ?? "?"} msg=${detail?.msg ?? "?"}`);
  }
  throw lastError;
}

/**
 * search API で全ページ取得(ビュー/フィールド絞り込み対応)。
 * list と違い Lookup/参照フィールドを**テキスト展開**して返すため、参照値の名称が必要な集計で使う。
 * 返り値は全ページ結合済みの items 配列。読み取りのみのため一過性エラーは短い待機で最大3回リトライ。
 */
export async function searchBaseRecordsAll(tableId: string, opts?: {
  baseToken?: string;
  viewId?: string;
  fieldNames?: string[];
  filter?: any;
  sort?: any;
  pageSize?: number;
}): Promise<any[]> {
  const appToken = opts?.baseToken || getLarkBaseToken();
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    let response: any;
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await larkClient.bitable.appTableRecord.search({
          path: { app_token: appToken, table_id: tableId },
          params: { page_size: opts?.pageSize || 500, page_token: pageToken },
          data: {
            view_id: opts?.viewId,
            field_names: opts?.fieldNames,
            filter: opts?.filter,
            sort: opts?.sort,
          },
        });
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        const status = error?.status ?? error?.response?.status;
        const transient = status === 429 || (typeof status === "number" && status >= 500 && status < 600) ||
          error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND";
        if (transient && attempt < 2) { await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); continue; }
        break;
      }
    }
    if (lastError) {
      const detail = lastError?.response?.data ?? lastError?.data;
      const status = lastError?.status ?? lastError?.response?.status;
      throw new Error(`Lark検索失敗 table=${tableId} status=${status ?? "?"} code=${detail?.code ?? "?"} msg=${detail?.msg ?? "?"}`);
    }
    for (const it of response.data?.items ?? []) items.push(it);
    pageToken = response.data?.has_more ? response.data.page_token : undefined;
  } while (pageToken);
  return items;
}

export async function createBaseRecord(
  tableId: string,
  fields: Record<string, any>,
  options?: { baseToken?: string; userAccessToken?: string }
) {
  try {
    const appToken = options?.baseToken || getLarkBaseToken();
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");

    const requestArgs = {
      path: {
        app_token: appToken,
        table_id: tableId,
      },
      data: { fields },
    };

    // user_access_tokenが指定されている場合はユーザー認証で実行
    const response = options?.userAccessToken
      ? await client.bitable.appTableRecord.create(requestArgs, lark.withUserAccessToken(options.userAccessToken))
      : await client.bitable.appTableRecord.create(requestArgs);

    return response;
  } catch (error) {
    console.error("Error creating Lark Base record:", error);
    throw error;
  }
}

export async function updateBaseRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>,
  options?: { baseToken?: string }
) {
  try {
    const appToken = options?.baseToken || getLarkBaseToken();
    const response = await larkClient.bitable.appTableRecord.update({
      path: {
        app_token: appToken,
        table_id: tableId,
        record_id: recordId,
      },
      data: { fields },
    });

    return response;
  } catch (error) {
    console.error("Error updating Lark Base record:", error);
    throw error;
  }
}

/**
 * 複数レコードを一括作成(Lark Bitable batch_create)。
 * 逐次 create を避け、API 呼び出し回数を大幅に削減する。
 * 1リクエスト最大500件のため500件ごとに分割送信する。
 */
export async function batchCreateBaseRecords(
  tableId: string,
  records: Record<string, any>[],
  options?: { baseToken?: string }
) {
  const appToken = options?.baseToken || getLarkBaseToken();
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await client.bitable.appTableRecord.batchCreate({
        path: { app_token: appToken, table_id: tableId },
        data: { records: chunk.map((fields) => ({ fields })) },
      });
      // SDKはAPIエラーでも例外を投げず {code,msg} を返すため、明示的にcodeを検査する
      // (未検査だとフィールド名不一致等で全件失敗してもサイレントに「成功」扱いになる)。
      if (res.code !== 0) {
        throw new Error(`Lark batchCreate失敗 table=${tableId} code=${res.code} msg=${res.msg}`);
      }
    } catch (error) {
      console.error("Error batch-creating Lark Base records:", error);
      throw error;
    }
  }
}

/**
 * 複数レコードを一括更新(Lark Bitable batch_update)。
 * 1リクエスト最大500件のため500件ごとに分割送信する。
 */
export async function batchUpdateBaseRecords(
  tableId: string,
  records: { record_id: string; fields: Record<string, any> }[],
  options?: { baseToken?: string }
) {
  const appToken = options?.baseToken || getLarkBaseToken();
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await client.bitable.appTableRecord.batchUpdate({
        path: { app_token: appToken, table_id: tableId },
        data: { records: chunk },
      });
      if (res.code !== 0) {
        throw new Error(`Lark batchUpdate失敗 table=${tableId} code=${res.code} msg=${res.msg}`);
      }
    } catch (error) {
      console.error("Error batch-updating Lark Base records:", error);
      throw error;
    }
  }
}

/**
 * 複数レコードを一括削除(Lark Bitable batch_delete)。
 * 1リクエスト最大500件のため500件ごとに分割送信する。
 */
export async function batchDeleteBaseRecords(
  tableId: string,
  recordIds: string[],
  options?: { baseToken?: string }
) {
  const appToken = options?.baseToken || getLarkBaseToken();
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const CHUNK = 500;
  for (let i = 0; i < recordIds.length; i += CHUNK) {
    const chunk = recordIds.slice(i, i + CHUNK);
    try {
      const res = await client.bitable.appTableRecord.batchDelete({
        path: { app_token: appToken, table_id: tableId },
        data: { records: chunk },
      });
      if (res.code !== 0) {
        throw new Error(`Lark batchDelete失敗 table=${tableId} code=${res.code} msg=${res.msg}`);
      }
    } catch (error) {
      console.error("Error batch-deleting Lark Base records:", error);
      throw error;
    }
  }
}

export async function deleteBaseRecord(
  tableId: string,
  recordId: string,
  options?: { baseToken?: string; userAccessToken?: string }
) {
  try {
    const appToken = options?.baseToken || getLarkBaseToken();
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");

    const requestArgs = {
      path: {
        app_token: appToken,
        table_id: tableId,
        record_id: recordId,
      },
    };

    // user_access_tokenが指定されている場合はユーザー認証で実行
    const response = options?.userAccessToken
      ? await client.bitable.appTableRecord.delete(requestArgs, lark.withUserAccessToken(options.userAccessToken))
      : await client.bitable.appTableRecord.delete(requestArgs);

    return response;
  } catch (error) {
    console.error("Error deleting Lark Base record:", error);
    throw error;
  }
}

/**
 * Lark Bitable テーブルのフィールドメタデータを取得
 * 複数選択フィールドのオプションID→テキストマッピング取得用
 */
export async function getTableFields(tableId: string, baseToken?: string) {
  try {
    const appToken = baseToken || getLarkBaseToken();
    const response = await larkClient.bitable.appTableField.list({
      path: {
        app_token: appToken,
        table_id: tableId,
      },
      params: {
        page_size: 100,
      },
    });

    console.log("[lark-client] getTableFields Response:", {
      code: response.code,
      msg: response.msg,
      items_count: response.data?.items?.length,
    });

    return response;
  } catch (error) {
    console.error("Error fetching Lark table fields:", error);
    throw error;
  }
}

/**
 * 複数選択フィールドのオプションマッピングを取得
 */
export async function getMultiSelectOptions(
  tableId: string,
  fieldName: string,
  baseToken?: string
): Promise<Map<string, string>> {
  const optionMap = new Map<string, string>();
  try {
    const response = await getTableFields(tableId, baseToken);
    if (response.code === 0 && response.data?.items) {
      // デバッグ: 全フィールド名を出力
      const fieldNames = response.data.items.map((f: any) => f.field_name);
      console.log("[lark-client] Available fields:", fieldNames.slice(0, 20));

      const field = response.data.items.find((f: any) => f.field_name === fieldName);
      if (field) {
        console.log("[lark-client] Found field:", {
          name: field.field_name,
          type: field.type,
          property: field.property,
        });
        if (field.property?.options) {
          for (const option of field.property.options) {
            if (option.id && option.name) {
              optionMap.set(option.id, option.name);
            }
          }
        }
      } else {
        console.log("[lark-client] Field not found:", fieldName);
      }
    }
    console.log("[lark-client] getMultiSelectOptions:", {
      fieldName,
      optionCount: optionMap.size,
    });
  } catch (error) {
    console.error("Error getting multi-select options:", error);
  }
  return optionMap;
}

/**
 * Lark部門一覧を取得（子部門取得）
 */
export async function getDepartments(parentDepartmentId?: string) {
  try {
    // department_idはパスパラメータとして必要
    const parentId = parentDepartmentId || "0";

    const response = await larkClient.contact.department.children({
      path: {
        department_id: parentId,
      },
      params: {
        department_id_type: "open_department_id",
        page_size: 50,
        fetch_child: true, // 全ての子孫部門を取得
      },
    });

    console.log("[lark-client] getDepartments Response:", {
      code: response.code,
      msg: response.msg,
      items_count: response.data?.items?.length,
      parent_id: parentId,
    });

    // code 0 でなければエラーメッセージを詳細に出力
    if (response.code !== 0) {
      console.error("[lark-client] getDepartments Error:", response);
    }

    return response;
  } catch (error) {
    console.error("Error fetching Lark departments:", error);
    throw error;
  }
}

/**
 * Lark部門一覧を取得（listメソッド使用）
 */
export async function listAllDepartments() {
  try {
    // 全部門をリストで取得
    const allDepartments: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await larkClient.contact.department.list({
        params: {
          department_id_type: "open_department_id",
          parent_department_id: "0",
          fetch_child: true,
          page_size: 50,
          page_token: pageToken,
        },
      });

      console.log("[lark-client] listAllDepartments Response:", {
        code: response.code,
        msg: response.msg,
        items_count: response.data?.items?.length,
        has_more: response.data?.has_more,
      });

      if (response.code === 0 && response.data?.items) {
        allDepartments.push(...response.data.items);
        pageToken = response.data.has_more ? response.data.page_token : undefined;
      } else {
        console.error("[lark-client] listAllDepartments Error:", response);
        break;
      }
    } while (pageToken);

    return {
      code: 0,
      data: { items: allDepartments },
    };
  } catch (error) {
    console.error("Error listing Lark departments:", error);
    throw error;
  }
}

/**
 * Lark部門詳細を取得
 */
export async function getDepartmentInfo(departmentId: string) {
  try {
    const response = await larkClient.contact.department.get({
      path: {
        department_id: departmentId,
      },
      params: {
        department_id_type: "open_department_id",
      },
    });

    return response;
  } catch (error) {
    console.error("Error fetching Lark department info:", error);
    throw error;
  }
}

/**
 * Larkグループ一覧を取得
 */
export async function getGroups(pageSize: number = 100) {
  try {
    const response = await (larkClient.contact.group as any).list({
      params: {
        page_size: pageSize,
        type: 1, // 1: 普通グループ
      },
    });

    console.log("[lark-client] getGroups Response:", {
      code: response.code,
      msg: response.msg,
      items_count: response.data?.grouplist?.length,
    });

    return response;
  } catch (error) {
    console.error("Error fetching Lark groups:", error);
    throw error;
  }
}
