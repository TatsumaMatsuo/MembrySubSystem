import { DriversLicense, LarkAttachment } from "@/types/syaryo";
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  deleteBaseRecord,
} from "@/lib/syaryo/lark-client";
import { LARK_TABLES, DRIVERS_LICENSE_FIELDS } from "@/lib/syaryo/lark-tables";

/**
 * Lark Base添付ファイル配列から最初の添付ファイルを取得
 */
function extractAttachment(attachmentField: any): LarkAttachment | null {
  if (!attachmentField || !Array.isArray(attachmentField) || attachmentField.length === 0) {
    return null;
  }
  const first = attachmentField[0];
  console.log("[drivers-license] Attachment data:", JSON.stringify(first, null, 2));
  return {
    file_token: first.file_token || first.token || "",
    name: first.name || "",
    size: first.size || 0,
    type: first.type || first.mime_type || "",
    tmp_url: first.tmp_url || "",
    url: first.url || "",
  };
}

/**
 * 免許証一覧を取得（削除済みを除外）
 */
export async function getDriversLicenses(employeeId?: string): Promise<DriversLicense[]> {
  try {
    const filter = employeeId
      ? `CurrentValue.[employee_id]="${employeeId}"`
      : undefined;

    const response = await getBaseRecords(LARK_TABLES.DRIVERS_LICENSES, {
      filter,
    });

    // Lark Baseのレスポンスを型に変換（deleted_flag=trueを除外）
    const licenses: DriversLicense[] =
      response.data?.items
        ?.filter((item: any) => item.fields[DRIVERS_LICENSE_FIELDS.deleted_flag] !== true)
        ?.map((item: any) => ({
        id: item.record_id,
        employee_id: item.fields[DRIVERS_LICENSE_FIELDS.employee_id],
        license_number: item.fields[DRIVERS_LICENSE_FIELDS.license_number],
        license_type: item.fields[DRIVERS_LICENSE_FIELDS.license_type],
        issue_date: new Date(item.fields[DRIVERS_LICENSE_FIELDS.issue_date]),
        expiration_date: new Date(item.fields[DRIVERS_LICENSE_FIELDS.expiration_date]),
        image_attachment: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment]),
        image_attachment_ura: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment_ura]),
        status: item.fields[DRIVERS_LICENSE_FIELDS.status],
        approval_status: item.fields[DRIVERS_LICENSE_FIELDS.approval_status],
        rejection_reason: item.fields[DRIVERS_LICENSE_FIELDS.rejection_reason],
        created_at: item.fields[DRIVERS_LICENSE_FIELDS.created_at]
          ? new Date(item.fields[DRIVERS_LICENSE_FIELDS.created_at])
          : new Date(),
        updated_at: item.fields[DRIVERS_LICENSE_FIELDS.updated_at]
          ? new Date(item.fields[DRIVERS_LICENSE_FIELDS.updated_at])
          : new Date(),
        deleted_flag: item.fields[DRIVERS_LICENSE_FIELDS.deleted_flag] || false,
        deleted_at: item.fields[DRIVERS_LICENSE_FIELDS.deleted_at]
          ? new Date(item.fields[DRIVERS_LICENSE_FIELDS.deleted_at])
          : undefined,
      })) || [];

    return licenses;
  } catch (error) {
    console.error("Error fetching drivers licenses:", error);
    throw error;
  }
}

/**
 * 免許証を新規作成
 */
export async function createDriversLicense(
  data: Omit<DriversLicense, "id" | "created_at" | "updated_at">
): Promise<DriversLicense> {
  try {
    // テーブルに存在する最小限のフィールドのみを送信
    const fields: Record<string, any> = {
      [DRIVERS_LICENSE_FIELDS.employee_id]: data.employee_id,
      [DRIVERS_LICENSE_FIELDS.license_number]: data.license_number,
      [DRIVERS_LICENSE_FIELDS.license_type]: data.license_type,
      [DRIVERS_LICENSE_FIELDS.expiration_date]: data.expiration_date.getTime(), // Unixタイムスタンプ（ミリ秒）
      [DRIVERS_LICENSE_FIELDS.image_attachment]: data.image_attachment ? [data.image_attachment] : [],
      [DRIVERS_LICENSE_FIELDS.image_attachment_ura]: data.image_attachment_ura ? [data.image_attachment_ura] : [],
      [DRIVERS_LICENSE_FIELDS.status]: data.status,
      [DRIVERS_LICENSE_FIELDS.approval_status]: data.approval_status,
      [DRIVERS_LICENSE_FIELDS.deleted_flag]: false,
    };

    const response = await createBaseRecord(LARK_TABLES.DRIVERS_LICENSES, fields);

    return {
      id: response.data?.record?.record_id || "",
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error) {
    console.error("Error creating drivers license:", error);
    throw error;
  }
}

/**
 * 免許証を更新
 */
export async function updateDriversLicense(
  id: string,
  data: Partial<Omit<DriversLicense, "id" | "created_at">>
): Promise<void> {
  try {
    const fields: Record<string, any> = {};

    if (data.license_number) fields[DRIVERS_LICENSE_FIELDS.license_number] = data.license_number;
    if (data.license_type) fields[DRIVERS_LICENSE_FIELDS.license_type] = data.license_type;
    if (data.issue_date) fields[DRIVERS_LICENSE_FIELDS.issue_date] = data.issue_date.getTime();
    if (data.expiration_date)
      fields[DRIVERS_LICENSE_FIELDS.expiration_date] = data.expiration_date.getTime();
    if (data.image_attachment !== undefined)
      fields[DRIVERS_LICENSE_FIELDS.image_attachment] = data.image_attachment ? [data.image_attachment] : [];
    if (data.image_attachment_ura !== undefined)
      fields[DRIVERS_LICENSE_FIELDS.image_attachment_ura] = data.image_attachment_ura ? [data.image_attachment_ura] : [];
    if (data.status) fields[DRIVERS_LICENSE_FIELDS.status] = data.status;
    if (data.approval_status)
      fields[DRIVERS_LICENSE_FIELDS.approval_status] = data.approval_status;
    if (data.rejection_reason !== undefined)
      fields[DRIVERS_LICENSE_FIELDS.rejection_reason] = data.rejection_reason;

    await updateBaseRecord(LARK_TABLES.DRIVERS_LICENSES, id, fields);
  } catch (error) {
    console.error("Error updating drivers license:", error);
    throw error;
  }
}

/**
 * 免許証を論理削除
 */
export async function deleteDriversLicense(id: string): Promise<void> {
  try {
    await deleteBaseRecord(LARK_TABLES.DRIVERS_LICENSES, id);
  } catch (error) {
    console.error("Error deleting drivers license:", error);
    throw error;
  }
}

/**
 * 免許証の承認
 */
export async function approveDriversLicense(id: string): Promise<void> {
  try {
    await updateDriversLicense(id, {
      status: "approved",
      approval_status: "approved",
    });
  } catch (error) {
    console.error("Error approving drivers license:", error);
    throw error;
  }
}

/**
 * 免許証の却下
 */
export async function rejectDriversLicense(id: string, reason: string): Promise<void> {
  try {
    await updateDriversLicense(id, {
      approval_status: "rejected",
      rejection_reason: reason,
    });
  } catch (error) {
    console.error("Error rejecting drivers license:", error);
    throw error;
  }
}

/**
 * 有効期限が近い免許証を取得
 * @param warningDays 警告日数（デフォルト30日）
 */
export async function getExpiringDriversLicenses(warningDays: number = 30): Promise<DriversLicense[]> {
  try {
    // 今日の日付（0時0分0秒にリセット）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // 警告日数後の終わり（23時59分59秒）
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + warningDays);
    warningDate.setHours(23, 59, 59, 999);
    const warningDateTime = warningDate.getTime();

    // フィルタなしで全件取得し、JavaScript側でフィルタリング
    const response = await getBaseRecords(LARK_TABLES.DRIVERS_LICENSES, {});

    const licenses: DriversLicense[] = [];

    response.data?.items?.forEach((item: any) => {
      const deletedFlag = item.fields[DRIVERS_LICENSE_FIELDS.deleted_flag];
      const status = item.fields[DRIVERS_LICENSE_FIELDS.status];
      const approvalStatus = item.fields[DRIVERS_LICENSE_FIELDS.approval_status];
      const expDateRaw = item.fields[DRIVERS_LICENSE_FIELDS.expiration_date];

      // deleted_flagがtrueの場合はスキップ
      if (deletedFlag === true) return;

      // 承認済みかどうかチェック
      const isApproved = status === "approved" || approvalStatus === "approved";
      if (!isApproved) return;

      // 有効期限の日付を取得
      const expDate = typeof expDateRaw === "number" ? expDateRaw : new Date(expDateRaw).getTime();

      // 今日〜警告日数後の範囲内かチェック
      if (expDate >= todayTime && expDate <= warningDateTime) {
        licenses.push({
          id: item.record_id,
          employee_id: item.fields[DRIVERS_LICENSE_FIELDS.employee_id],
          license_number: item.fields[DRIVERS_LICENSE_FIELDS.license_number],
          license_type: item.fields[DRIVERS_LICENSE_FIELDS.license_type],
          issue_date: new Date(item.fields[DRIVERS_LICENSE_FIELDS.issue_date]),
          expiration_date: new Date(expDate),
          image_attachment: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment]),
          image_attachment_ura: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment_ura]),
          status: status,
          approval_status: approvalStatus,
          rejection_reason: item.fields[DRIVERS_LICENSE_FIELDS.rejection_reason],
          created_at: new Date(item.fields[DRIVERS_LICENSE_FIELDS.created_at]),
          updated_at: new Date(item.fields[DRIVERS_LICENSE_FIELDS.updated_at]),
          deleted_flag: false,
        });
      }
    });

    return licenses;
  } catch (error) {
    console.error("Error fetching expiring drivers licenses:", error);
    throw error;
  }
}

/**
 * 有効期限切れの免許証を取得
 */
export async function getExpiredDriversLicenses(): Promise<DriversLicense[]> {
  try {
    // 今日の日付（0時0分0秒にリセット）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // フィルタなしで全件取得し、JavaScript側でフィルタリング
    const response = await getBaseRecords(LARK_TABLES.DRIVERS_LICENSES, {});

    const licenses: DriversLicense[] = [];

    response.data?.items?.forEach((item: any) => {
      const deletedFlag = item.fields[DRIVERS_LICENSE_FIELDS.deleted_flag];
      const status = item.fields[DRIVERS_LICENSE_FIELDS.status];
      const approvalStatus = item.fields[DRIVERS_LICENSE_FIELDS.approval_status];
      const expDateRaw = item.fields[DRIVERS_LICENSE_FIELDS.expiration_date];

      // deleted_flagがtrueの場合はスキップ
      if (deletedFlag === true) return;

      // 承認済みかどうかチェック
      const isApproved = status === "approved" || approvalStatus === "approved";
      if (!isApproved) return;

      // 有効期限の日付を取得
      const expDate = typeof expDateRaw === "number" ? expDateRaw : new Date(expDateRaw).getTime();

      // 期限切れかチェック（今日より前）
      if (expDate < todayTime) {
        licenses.push({
          id: item.record_id,
          employee_id: item.fields[DRIVERS_LICENSE_FIELDS.employee_id],
          license_number: item.fields[DRIVERS_LICENSE_FIELDS.license_number],
          license_type: item.fields[DRIVERS_LICENSE_FIELDS.license_type],
          issue_date: new Date(item.fields[DRIVERS_LICENSE_FIELDS.issue_date]),
          expiration_date: new Date(expDate),
          image_attachment: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment]),
          image_attachment_ura: extractAttachment(item.fields[DRIVERS_LICENSE_FIELDS.image_attachment_ura]),
          status: status,
          approval_status: approvalStatus,
          rejection_reason: item.fields[DRIVERS_LICENSE_FIELDS.rejection_reason],
          created_at: new Date(item.fields[DRIVERS_LICENSE_FIELDS.created_at]),
          updated_at: new Date(item.fields[DRIVERS_LICENSE_FIELDS.updated_at]),
          deleted_flag: false,
        });
      }
    });

    return licenses;
  } catch (error) {
    console.error("Error fetching expired drivers licenses:", error);
    throw error;
  }
}
