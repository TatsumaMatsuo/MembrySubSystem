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
  try {
    const appToken = params?.baseToken || getLarkBaseToken();
    console.log("[lark-client] getBaseRecords called:", {
      app_token: appToken,
      table_id: tableId,
      filter: params?.filter,
    });
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
  } catch (error) {
    console.error("Error fetching Lark Base records:", error);
    throw error;
  }
}

export async function createBaseRecord(
  tableId: string,
  fields: Record<string, any>,
  options?: { baseToken?: string }
) {
  try {
    const appToken = options?.baseToken || getLarkBaseToken();
    const response = await larkClient.bitable.appTableRecord.create({
      path: {
        app_token: appToken,
        table_id: tableId,
      },
      data: { fields },
    });

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

export async function deleteBaseRecord(
  tableId: string,
  recordId: string,
  options?: { baseToken?: string }
) {
  try {
    const appToken = options?.baseToken || getLarkBaseToken();
    const response = await larkClient.bitable.appTableRecord.delete({
      path: {
        app_token: appToken,
        table_id: tableId,
        record_id: recordId,
      },
    });

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
