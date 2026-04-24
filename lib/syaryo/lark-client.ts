import * as lark from "@larksuiteoapi/node-sdk";
import { Readable } from "stream";

// Larkクライアント（遅延初期化）
let _larkClient: lark.Client | null = null;

/**
 * Larkクライアントを取得（遅延初期化）
 * ランタイム時に環境変数を読み込む
 */
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
      domain: lark.Domain.Feishu,
    });
  }

  return _larkClient;
}

// 後方互換性のためのエクスポート（非推奨）
export const larkClient = {
  get bitable() {
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");
    return client.bitable;
  },
  get im() {
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");
    return client.im;
  },
  get contact() {
    const client = getLarkClient();
    if (!client) throw new Error("Lark client not initialized");
    return client.contact;
  },
};

/**
 * Lark Base トークンを取得（ランタイム時に環境変数から取得）
 */
export function getLarkBaseToken(): string {
  return process.env.LARK_SYARYO_BASE_TOKEN || "NNLCbCdohajZpYsHCrkjy1adpNX";
}

// 後方互換性のためのエクスポート（非推奨）
export const LARK_BASE_TOKEN = process.env.LARK_SYARYO_BASE_TOKEN || "NNLCbCdohajZpYsHCrkjy1adpNX";

/**
 * Lark Baseからレコードを取得
 */
export async function getBaseRecords(tableId: string, params?: {
  filter?: string;
  sort?: Array<string | { field_name: string; desc?: boolean }>;
  pageSize?: number;
  pageToken?: string;
}) {
  try {
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

    // デバッグログ（承認履歴テーブル）
    if (tableId === process.env.LARK_APPROVAL_HISTORY_TABLE_ID) {
      console.log("[lark-client] getBaseRecords APPROVAL_HISTORY response:", {
        code: response.code,
        msg: response.msg,
        total: response.data?.total,
        itemsCount: response.data?.items?.length || 0,
      });
    }

    return response;
  } catch (error) {
    console.error("Error fetching Lark Base records:", error);
    throw error;
  }
}

/**
 * Lark Baseにレコードを作成
 */
export async function createBaseRecord(tableId: string, fields: Record<string, any>) {
  try {
    // テーブルIDの改行文字を除去
    const cleanTableId = tableId.trim().replace(/\\n/g, '').replace(/\n/g, '');
    const cleanAppToken = getLarkBaseToken().trim().replace(/\\n/g, '').replace(/\n/g, '');

    console.log(`[lark-client] createBaseRecord - tableId: "${cleanTableId}", appToken: "${cleanAppToken.substring(0, 10)}...", fields:`, JSON.stringify(fields, null, 2));

    if (!cleanTableId) {
      throw new Error("Table ID is empty or not configured");
    }

    if (!cleanAppToken) {
      throw new Error("Lark Base Token is empty or not configured");
    }

    const response = await larkClient.bitable.appTableRecord.create({
      path: {
        app_token: cleanAppToken,
        table_id: cleanTableId,
      },
      data: {
        fields,
      },
    });

    if (response.code !== 0) {
      console.error(`[lark-client] createBaseRecord FAILED - code: ${response.code}, msg: ${response.msg}`);
      throw new Error(`Lark API error: ${response.msg || 'Unknown error'} (code: ${response.code})`);
    }

    console.log(`[lark-client] createBaseRecord SUCCESS - record_id: ${response.data?.record?.record_id}`);
    return response;
  } catch (error) {
    console.error("Error creating Lark Base record:", error);
    throw error;
  }
}

/**
 * Lark Baseのレコードを更新
 */
export async function updateBaseRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
) {
  try {
    console.log('DEBUG updateBaseRecord:', {
      tableId,
      recordId,
      fields: JSON.stringify(fields, null, 2),
    });

    const response = await larkClient.bitable.appTableRecord.update({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tableId,
        record_id: recordId,
      },
      data: {
        fields,
      },
    });

    console.log('DEBUG updateBaseRecord response:', {
      code: response.code,
      msg: response.msg,
      success: response.code === 0,
    });

    if (response.code !== 0) {
      console.error(`[lark-client] updateBaseRecord FAILED - code: ${response.code}, msg: ${response.msg}`);
      throw new Error(`Lark API error: ${response.msg || 'Unknown error'} (code: ${response.code})`);
    }

    return response;
  } catch (error) {
    console.error("Error updating Lark Base record:", error);
    throw error;
  }
}

/**
 * Lark Baseのレコードを削除（論理削除）
 */
export async function deleteBaseRecord(tableId: string, recordId: string) {
  try {
    // 論理削除：deleted_flagを更新
    const response = await updateBaseRecord(tableId, recordId, {
      deleted_flag: true,
      deleted_at: new Date().toISOString(),
    });

    return response;
  } catch (error) {
    console.error("Error deleting Lark Base record:", error);
    throw error;
  }
}

/**
 * Lark Baseのレコードを物理削除
 */
export async function hardDeleteBaseRecord(tableId: string, recordId: string) {
  try {
    const response = await larkClient.bitable.appTableRecord.delete({
      path: {
        app_token: getLarkBaseToken(),
        table_id: tableId,
        record_id: recordId,
      },
    });

    return response;
  } catch (error) {
    console.error("Error hard deleting Lark Base record:", error);
    throw error;
  }
}

/**
 * Lark Baseのテーブル一覧を取得
 */
export async function getBaseTables() {
  try {
    const response = await larkClient.bitable.appTable.list({
      path: {
        app_token: getLarkBaseToken(),
      },
    });

    return response;
  } catch (error) {
    console.error("Error fetching Lark Base tables:", error);
    throw error;
  }
}

/**
 * Lark添付ファイル型
 */
export interface LarkAttachment {
  file_token: string;
  name: string;
  size: number;
  type: string;
  tmp_url?: string; // Lark Baseから取得時の一時ダウンロードURL（バッチAPI）
  url?: string; // Lark Baseから取得時の直接ダウンロードURL
}

/**
 * Lark Base 添付ファイルとしてファイルをアップロード（Drive API使用）
 * Bitable の添付ファイルフィールドに保存するためのアップロード
 * @param fileBuffer ファイルのBuffer
 * @param filename ファイル名
 * @param mimeType MIMEタイプ
 * @returns アタッチメントオブジェクト（file_token, name, size, type）
 */
export async function uploadAttachmentToBase(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<LarkAttachment> {
  try {
    console.log(`[lark-client] uploadAttachmentToBase - filename: ${filename}, mimeType: ${mimeType}, size: ${fileBuffer.length}`);

    const client = getLarkClient();
    if (!client) {
      throw new Error("Lark client not initialized");
    }

    // BufferをReadable Streamに変換
    const stream = Readable.from(fileBuffer);

    // Drive API を使用してファイルをアップロード
    // upload_all は小さいファイル（<20MB）向け
    const response = await client.drive.media.uploadAll({
      data: {
        file_name: filename,
        parent_type: "bitable_file", // Bitable添付ファイル用
        parent_node: getLarkBaseToken(), // Base App Token
        size: fileBuffer.length,
        file: stream as any,
      },
    });

    console.log(`[lark-client] uploadAttachmentToBase response:`, {
      file_token: response?.file_token,
    });

    // Drive APIはcodeを返さない場合があるため、file_tokenの存在のみチェック
    if (!response?.file_token) {
      throw new Error(`Lark Drive upload failed: No file_token returned`);
    }

    return {
      file_token: response.file_token,
      name: filename,
      size: fileBuffer.length,
      type: mimeType,
    };
  } catch (error) {
    console.error("[lark-client] Error uploading attachment to Lark Base:", error);
    throw error;
  }
}

/**
 * Lark Base 添付ファイルをダウンロード
 * @param fileToken 添付ファイルのfile_token
 * @param downloadUrl 添付ファイルのダウンロードURL（オプション、Larkレコードから取得）
 * @returns ファイルデータ（Buffer）
 */
export async function downloadAttachmentFromBase(fileToken: string, downloadUrl?: string): Promise<Buffer | null> {
  try {
    console.log(`[lark-client] downloadAttachmentFromBase - fileToken: ${fileToken}`);

    const client = getLarkClient();
    if (!client) {
      throw new Error("Lark client not initialized");
    }

    // アクセストークンを取得
    let accessToken: string | undefined;
    try {
      // @ts-ignore - 内部APIにアクセス
      const tokenManager = client.tokenManager;
      console.log(`[lark-client] tokenManager exists: ${!!tokenManager}`);
      if (tokenManager) {
        // @ts-ignore
        const tenantAccessToken = await tokenManager.getTenantAccessToken();
        console.log(`[lark-client] tenantAccessToken type:`, typeof tenantAccessToken);
        // トークンは文字列またはオブジェクトとして返される可能性がある
        if (typeof tenantAccessToken === 'string') {
          accessToken = tenantAccessToken;
        } else {
          accessToken = tenantAccessToken?.tenant_access_token || tenantAccessToken?.token;
        }
      }
    } catch (tokenError) {
      console.error("[lark-client] Error getting access token:", tokenError);
    }

    console.log(`[lark-client] accessToken available: ${!!accessToken}`);

    // 方法1: downloadUrl が提供されている場合はそれを使用
    if (downloadUrl && accessToken) {
      try {
        console.log(`[lark-client] Downloading from provided URL with auth...`);
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`[lark-client] Download success via provided URL - size: ${buffer.length}`);
          return buffer;
        } else {
          console.log(`[lark-client] Download via provided URL failed: ${response.status}`);
        }
      } catch (urlError) {
        console.log(`[lark-client] Download via provided URL error:`, urlError);
      }
    }

    // 方法2: bitable_perm付きのダウンロードURLを構築
    const baseToken = getLarkBaseToken();
    const constructedUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download?extra=${encodeURIComponent(JSON.stringify({ bitablePerm: { tableId: "*", rev: 0 } }))}`;

    if (accessToken) {
      try {
        console.log(`[lark-client] Downloading from constructed URL...`);
        const response = await fetch(constructedUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`[lark-client] Download success via constructed URL - size: ${buffer.length}`);
          return buffer;
        } else {
          const errorText = await response.text();
          console.log(`[lark-client] Download via constructed URL failed: ${response.status}`, errorText);
        }
      } catch (constructedError) {
        console.log(`[lark-client] Download via constructed URL error:`, constructedError);
      }
    }

    // 方法3: drive.media.download を試行
    try {
      const response = await client.drive.media.download({
        path: {
          file_token: fileToken,
        },
        params: {
          extra: JSON.stringify({ bitablePerm: { tableId: "*", rev: 0 } }),
        },
      });

      if (response) {
        const chunks: Buffer[] = [];

        // @ts-ignore
        if (typeof response[Symbol.asyncIterator] === 'function') {
          // @ts-ignore
          for await (const chunk of response) {
            chunks.push(Buffer.from(chunk));
          }
          if (chunks.length > 0) {
            const buffer = Buffer.concat(chunks);
            console.log(`[lark-client] Download success via SDK - size: ${buffer.length}`);
            return buffer;
          }
        }

        if (Buffer.isBuffer(response)) {
          console.log(`[lark-client] Download success - direct buffer - size: ${response.length}`);
          return response;
        }
      }
    } catch (downloadError) {
      console.log(`[lark-client] drive.media.download failed:`, downloadError);
    }

    console.error("[lark-client] All download methods failed");
    return null;
  } catch (error) {
    console.error("[lark-client] Error downloading attachment from Lark Base:", error);
    throw error;
  }
}

/**
 * 承認履歴を記録
 * @param data 承認履歴データ
 * @returns 作成されたレコード
 */
export async function createApprovalHistory(data: {
  application_type: "license" | "vehicle" | "insurance";
  application_id: string;
  employee_id: string;
  employee_name: string;
  action: "approved" | "rejected";
  approver_id: string;
  approver_name: string;
  reason?: string;
}) {
  try {
    const historyTableId = process.env.LARK_APPROVAL_HISTORY_TABLE_ID;

    if (!historyTableId) {
      console.warn("LARK_APPROVAL_HISTORY_TABLE_ID not configured, skipping history recording");
      return { success: false, message: "History table not configured" };
    }

    const fields = {
      application_type: data.application_type,
      application_id: data.application_id,
      employee_id: data.employee_id,
      employee_name: data.employee_name,
      action: data.action,
      approver_id: data.approver_id,
      approver_name: data.approver_name,
      reason: data.reason || "",
      timestamp: Date.now(),
      created_at: Date.now(),
    };

    console.log('DEBUG createApprovalHistory - fields:', JSON.stringify(fields, null, 2));

    const response = await createBaseRecord(historyTableId, fields);

    console.log('DEBUG createApprovalHistory - response:', {
      code: response.code,
      msg: response.msg,
      record_id: response.data?.record?.record_id,
    });

    return {
      success: true,
      record_id: response.data?.record?.record_id,
    };
  } catch (error) {
    console.error("Error creating approval history:", error);
    // 履歴記録失敗してもエラーを投げずにログのみ
    // 承認・却下処理自体は成功させる
    return { success: false, error };
  }
}

/**
 * 承認履歴を取得
 * @param params フィルター条件
 * @returns 履歴レコード一覧
 */
export async function getApprovalHistory(params?: {
  employee_id?: string;
  approver_id?: string;
  action?: "approved" | "rejected";
  start_date?: number;
  end_date?: number;
  pageSize?: number;
  pageToken?: string;
}) {
  try {
    const historyTableId = process.env.LARK_APPROVAL_HISTORY_TABLE_ID;

    if (!historyTableId) {
      throw new Error("LARK_APPROVAL_HISTORY_TABLE_ID not configured");
    }

    // フィルター条件を構築
    const filters: string[] = [];

    if (params?.employee_id) {
      filters.push(`CurrentValue.[employee_id] = "${params.employee_id}"`);
    }

    if (params?.approver_id) {
      filters.push(`CurrentValue.[approver_id] = "${params.approver_id}"`);
    }

    if (params?.action) {
      filters.push(`CurrentValue.[action] = "${params.action}"`);
    }

    if (params?.start_date) {
      filters.push(`CurrentValue.[timestamp] >= ${params.start_date}`);
    }

    if (params?.end_date) {
      filters.push(`CurrentValue.[timestamp] <= ${params.end_date}`);
    }

    const filter = filters.length > 0 ? filters.join(" AND ") : undefined;

    const response = await getBaseRecords(historyTableId, {
      filter,
      pageSize: params?.pageSize || 50,
      pageToken: params?.pageToken,
    });

    return response;
  } catch (error) {
    console.error("Error fetching approval history:", error);
    throw error;
  }
}
