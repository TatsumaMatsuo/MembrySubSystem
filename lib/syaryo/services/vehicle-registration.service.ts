import { VehicleRegistration, LarkAttachment } from "@/types/syaryo";
import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  deleteBaseRecord,
} from "@/lib/syaryo/lark-client";
import { LARK_TABLES, VEHICLE_REGISTRATION_FIELDS } from "@/lib/syaryo/lark-tables";

/**
 * Lark Base添付ファイル配列から最初の添付ファイルを取得
 */
function extractAttachment(attachmentField: any): LarkAttachment | null {
  if (!attachmentField || !Array.isArray(attachmentField) || attachmentField.length === 0) {
    return null;
  }
  const first = attachmentField[0];
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
 * 車検証一覧を取得（削除済みを除外）
 */
export async function getVehicleRegistrations(
  employeeId?: string
): Promise<VehicleRegistration[]> {
  try {
    const filter = employeeId
      ? `CurrentValue.[employee_id]="${employeeId}"`
      : undefined;

    const response = await getBaseRecords(LARK_TABLES.VEHICLE_REGISTRATIONS, {
      filter,
    });

    // デバッグログ: 全レコードを表示
    console.log(`[vehicle-registration] Raw items count: ${response.data?.items?.length || 0}`);
    if (response.data?.items?.[0]) {
      console.log(`[vehicle-registration] Available fields:`, Object.keys(response.data.items[0].fields));
    }
    response.data?.items?.forEach((item: any, index: number) => {
      console.log(`[vehicle-registration] Item ${index}: employee_id=${item.fields[VEHICLE_REGISTRATION_FIELDS.employee_id]}, deleted_flag=${item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_flag]}`);
    });

    const registrations: VehicleRegistration[] =
      response.data?.items
        ?.filter((item: any) => item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_flag] !== true)
        ?.map((item: any) => ({
        id: item.record_id,
        employee_id: item.fields[VEHICLE_REGISTRATION_FIELDS.employee_id],
        vehicle_number: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_number],
        vehicle_type: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_type],
        manufacturer: item.fields[VEHICLE_REGISTRATION_FIELDS.manufacturer],
        model_name: item.fields[VEHICLE_REGISTRATION_FIELDS.model_name],
        inspection_expiration_date: new Date(
          item.fields[VEHICLE_REGISTRATION_FIELDS.expiration_date]
        ),
        owner_name: item.fields[VEHICLE_REGISTRATION_FIELDS.owner_name],
        image_attachment: extractAttachment(item.fields[VEHICLE_REGISTRATION_FIELDS.image_attachment]),
        status: item.fields[VEHICLE_REGISTRATION_FIELDS.status],
        approval_status: item.fields[VEHICLE_REGISTRATION_FIELDS.approval_status],
        rejection_reason: item.fields[VEHICLE_REGISTRATION_FIELDS.rejection_reason],
        // registration_dateをcreated_atとして使用（Larkテーブルにcreated_at/updated_atがない）
        created_at: item.fields[VEHICLE_REGISTRATION_FIELDS.registration_date]
          ? new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.registration_date])
          : new Date(),
        updated_at: item.fields[VEHICLE_REGISTRATION_FIELDS.registration_date]
          ? new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.registration_date])
          : new Date(),
        deleted_flag: item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_flag] || false,
        deleted_at: item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_at]
          ? new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_at])
          : undefined,
      })) || [];

    return registrations;
  } catch (error) {
    console.error("Error fetching vehicle registrations:", error);
    throw error;
  }
}

/**
 * 車検証を新規作成
 */
export async function createVehicleRegistration(
  data: Omit<VehicleRegistration, "id" | "created_at" | "updated_at">
): Promise<VehicleRegistration> {
  try {
    console.log(`[vehicle-registration] Creating with employee_id: ${data.employee_id}`);
    // 車検証データをLark Baseに保存
    // NOTE: vehicle_type フィールドはLark Baseテーブルに存在しないため除外
    const fields: Record<string, any> = {
      [VEHICLE_REGISTRATION_FIELDS.employee_id]: data.employee_id,
      [VEHICLE_REGISTRATION_FIELDS.vehicle_number]: data.vehicle_number,
      [VEHICLE_REGISTRATION_FIELDS.manufacturer]: data.manufacturer || null,
      [VEHICLE_REGISTRATION_FIELDS.model_name]: data.model_name || null,
      [VEHICLE_REGISTRATION_FIELDS.expiration_date]: data.inspection_expiration_date.getTime(),
      [VEHICLE_REGISTRATION_FIELDS.owner_name]: data.owner_name || null,
      [VEHICLE_REGISTRATION_FIELDS.image_attachment]: data.image_attachment ? [data.image_attachment] : [],
      [VEHICLE_REGISTRATION_FIELDS.status]: data.status,
      [VEHICLE_REGISTRATION_FIELDS.approval_status]: data.approval_status,
      [VEHICLE_REGISTRATION_FIELDS.deleted_flag]: false,
    };

    const response = await createBaseRecord(LARK_TABLES.VEHICLE_REGISTRATIONS, fields);

    console.log(`[vehicle-registration] Create response: code=${response.code}, record_id=${response.data?.record?.record_id}`);

    return {
      id: response.data?.record?.record_id || "",
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error) {
    console.error("Error creating vehicle registration:", error);
    throw error;
  }
}

/**
 * 車検証を更新
 */
export async function updateVehicleRegistration(
  id: string,
  data: Partial<Omit<VehicleRegistration, "id" | "created_at">>
): Promise<void> {
  try {
    const fields: Record<string, any> = {};

    if (data.vehicle_number)
      fields[VEHICLE_REGISTRATION_FIELDS.vehicle_number] = data.vehicle_number;
    if (data.manufacturer) fields[VEHICLE_REGISTRATION_FIELDS.manufacturer] = data.manufacturer;
    if (data.model_name) fields[VEHICLE_REGISTRATION_FIELDS.model_name] = data.model_name;
    if (data.inspection_expiration_date)
      fields[VEHICLE_REGISTRATION_FIELDS.expiration_date] = data.inspection_expiration_date.getTime();
    if (data.owner_name) fields[VEHICLE_REGISTRATION_FIELDS.owner_name] = data.owner_name;
    if (data.image_attachment !== undefined)
      fields[VEHICLE_REGISTRATION_FIELDS.image_attachment] = data.image_attachment ? [data.image_attachment] : [];
    if (data.status) fields[VEHICLE_REGISTRATION_FIELDS.status] = data.status;
    if (data.approval_status)
      fields[VEHICLE_REGISTRATION_FIELDS.approval_status] = data.approval_status;
    if (data.rejection_reason !== undefined)
      fields[VEHICLE_REGISTRATION_FIELDS.rejection_reason] = data.rejection_reason;

    await updateBaseRecord(LARK_TABLES.VEHICLE_REGISTRATIONS, id, fields);
  } catch (error) {
    console.error("Error updating vehicle registration:", error);
    throw error;
  }
}

/**
 * 車検証を論理削除
 */
export async function deleteVehicleRegistration(id: string): Promise<void> {
  try {
    await deleteBaseRecord(LARK_TABLES.VEHICLE_REGISTRATIONS, id);
  } catch (error) {
    console.error("Error deleting vehicle registration:", error);
    throw error;
  }
}

/**
 * 車検証の承認
 */
export async function approveVehicleRegistration(id: string): Promise<void> {
  try {
    await updateVehicleRegistration(id, {
      status: "approved",
      approval_status: "approved",
    });
  } catch (error) {
    console.error("Error approving vehicle registration:", error);
    throw error;
  }
}

/**
 * 車検証の却下
 */
export async function rejectVehicleRegistration(id: string, reason: string): Promise<void> {
  try {
    await updateVehicleRegistration(id, {
      approval_status: "rejected",
      rejection_reason: reason,
    });
  } catch (error) {
    console.error("Error rejecting vehicle registration:", error);
    throw error;
  }
}

/**
 * 有効期限が近い車検証を取得
 * @param warningDays 警告日数（デフォルト30日）
 */
export async function getExpiringVehicleRegistrations(warningDays: number = 30): Promise<VehicleRegistration[]> {
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
    const response = await getBaseRecords(LARK_TABLES.VEHICLE_REGISTRATIONS, {});

    const registrations: VehicleRegistration[] = [];

    response.data?.items?.forEach((item: any) => {
      const deletedFlag = item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_flag];
      const status = item.fields[VEHICLE_REGISTRATION_FIELDS.status];
      const approvalStatus = item.fields[VEHICLE_REGISTRATION_FIELDS.approval_status];
      const expDateRaw = item.fields[VEHICLE_REGISTRATION_FIELDS.expiration_date];

      // deleted_flagがtrueの場合はスキップ
      if (deletedFlag === true) return;

      // 承認済みかどうかチェック
      const isApproved = status === "approved" || approvalStatus === "approved";
      if (!isApproved) return;

      // 有効期限の日付を取得
      const expDate = typeof expDateRaw === "number" ? expDateRaw : new Date(expDateRaw).getTime();

      // 今日〜警告日数後の範囲内かチェック
      if (expDate >= todayTime && expDate <= warningDateTime) {
        registrations.push({
          id: item.record_id,
          employee_id: item.fields[VEHICLE_REGISTRATION_FIELDS.employee_id],
          vehicle_number: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_number],
          vehicle_type: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_type],
          manufacturer: item.fields[VEHICLE_REGISTRATION_FIELDS.manufacturer],
          model_name: item.fields[VEHICLE_REGISTRATION_FIELDS.model_name],
          inspection_expiration_date: new Date(expDate),
          owner_name: item.fields[VEHICLE_REGISTRATION_FIELDS.owner_name],
          image_attachment: extractAttachment(item.fields[VEHICLE_REGISTRATION_FIELDS.image_attachment]),
          status: status,
          approval_status: approvalStatus,
          rejection_reason: item.fields[VEHICLE_REGISTRATION_FIELDS.rejection_reason],
          created_at: new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.created_at]),
          updated_at: new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.updated_at]),
          deleted_flag: false,
        });
      }
    });

    return registrations;
  } catch (error) {
    console.error("Error fetching expiring vehicle registrations:", error);
    throw error;
  }
}

/**
 * 有効期限切れの車検証を取得
 */
export async function getExpiredVehicleRegistrations(): Promise<VehicleRegistration[]> {
  try {
    // 今日の日付（0時0分0秒にリセット）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // フィルタなしで全件取得し、JavaScript側でフィルタリング
    const response = await getBaseRecords(LARK_TABLES.VEHICLE_REGISTRATIONS, {});

    const registrations: VehicleRegistration[] = [];

    response.data?.items?.forEach((item: any) => {
      const deletedFlag = item.fields[VEHICLE_REGISTRATION_FIELDS.deleted_flag];
      const status = item.fields[VEHICLE_REGISTRATION_FIELDS.status];
      const approvalStatus = item.fields[VEHICLE_REGISTRATION_FIELDS.approval_status];
      const expDateRaw = item.fields[VEHICLE_REGISTRATION_FIELDS.expiration_date];

      // deleted_flagがtrueの場合はスキップ
      if (deletedFlag === true) return;

      // 承認済みかどうかチェック
      const isApproved = status === "approved" || approvalStatus === "approved";
      if (!isApproved) return;

      // 有効期限の日付を取得
      const expDate = typeof expDateRaw === "number" ? expDateRaw : new Date(expDateRaw).getTime();

      // 期限切れかチェック（今日より前）
      if (expDate < todayTime) {
        registrations.push({
          id: item.record_id,
          employee_id: item.fields[VEHICLE_REGISTRATION_FIELDS.employee_id],
          vehicle_number: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_number],
          vehicle_type: item.fields[VEHICLE_REGISTRATION_FIELDS.vehicle_type],
          manufacturer: item.fields[VEHICLE_REGISTRATION_FIELDS.manufacturer],
          model_name: item.fields[VEHICLE_REGISTRATION_FIELDS.model_name],
          inspection_expiration_date: new Date(expDate),
          owner_name: item.fields[VEHICLE_REGISTRATION_FIELDS.owner_name],
          image_attachment: extractAttachment(item.fields[VEHICLE_REGISTRATION_FIELDS.image_attachment]),
          status: status,
          approval_status: approvalStatus,
          rejection_reason: item.fields[VEHICLE_REGISTRATION_FIELDS.rejection_reason],
          created_at: new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.created_at]),
          updated_at: new Date(item.fields[VEHICLE_REGISTRATION_FIELDS.updated_at]),
          deleted_flag: false,
        });
      }
    });

    return registrations;
  } catch (error) {
    console.error("Error fetching expired vehicle registrations:", error);
    throw error;
  }
}
