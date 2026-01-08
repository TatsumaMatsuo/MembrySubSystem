import * as lark from "@larksuiteoapi/node-sdk";

let _larkClient: lark.Client | null = null;

export function getLarkClient(): lark.Client | null {
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
    console.error("[lark-client] Missing LARK_APP_ID or LARK_APP_SECRET");
    return null;
  }

  if (!_larkClient) {
    _larkClient = new lark.Client({
      appId: process.env.LARK_APP_ID,
      appSecret: process.env.LARK_APP_SECRET,
      appType: lark.AppType.SelfBuild,
      domain: "https://open.feishu.cn",  // 飛書 (Feishu)
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
};

export function getLarkBaseToken(): string {
  return process.env.LARK_BASE_TOKEN || "";
}

export async function getBaseRecords(tableId: string, params?: {
  filter?: string;
  sort?: Array<string | { field_name: string; desc?: boolean }>;
  pageSize?: number;
  pageToken?: string;
}) {
  try {
    console.log("[lark-client] getBaseRecords called:", {
      app_token: getLarkBaseToken(),
      table_id: tableId,
      filter: params?.filter,
    });
    const response = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: getLarkBaseToken(),
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

export async function createBaseRecord(tableId: string, fields: Record<string, any>) {
  try {
    const response = await larkClient.bitable.appTableRecord.create({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tableId,
      },
      data: { fields },
    });

    if (response.code !== 0) {
      throw new Error(`Lark API error: ${response.msg || 'Unknown error'} (code: ${response.code})`);
    }

    return response;
  } catch (error) {
    console.error("Error creating Lark Base record:", error);
    throw error;
  }
}

export async function updateBaseRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
) {
  try {
    const response = await larkClient.bitable.appTableRecord.update({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tableId,
        record_id: recordId,
      },
      data: { fields },
    });

    if (response.code !== 0) {
      throw new Error(`Lark API error: ${response.msg || 'Unknown error'} (code: ${response.code})`);
    }

    return response;
  } catch (error) {
    console.error("Error updating Lark Base record:", error);
    throw error;
  }
}
