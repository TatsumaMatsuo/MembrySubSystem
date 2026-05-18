import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
} from "@/lib/syaryo/lark-client";
import { LARK_TABLES, SYSTEM_SETTINGS_FIELDS } from "@/lib/syaryo/lark-tables";

export interface SystemSettings {
  // 通知設定
  license_expiry_warning_days: number;
  vehicle_expiry_warning_days: number;
  insurance_expiry_warning_days: number;
  admin_notification_after_days: number;
  // 会社情報（許可証PDF用）
  company_name: string;
  company_postal_code: string;
  company_address: string;
  issuing_department: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  license_expiry_warning_days: 30,
  vehicle_expiry_warning_days: 30,
  insurance_expiry_warning_days: 30,
  admin_notification_after_days: 7,
  company_name: "",
  company_postal_code: "",
  company_address: "",
  issuing_department: "",
};

// 数値型のキー
const NUMERIC_KEYS = [
  "license_expiry_warning_days",
  "vehicle_expiry_warning_days",
  "insurance_expiry_warning_days",
  "admin_notification_after_days",
];

/**
 * システム設定を取得
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const response = await getBaseRecords(LARK_TABLES.SYSTEM_SETTINGS);

    if (!response.data?.items) {
      return DEFAULT_SETTINGS;
    }

    const settings: SystemSettings = { ...DEFAULT_SETTINGS };

    response.data.items.forEach((item: any) => {
      const key = item.fields[SYSTEM_SETTINGS_FIELDS.setting_key];
      const value = item.fields[SYSTEM_SETTINGS_FIELDS.setting_value];

      if (key && value !== undefined && key in settings) {
        if (NUMERIC_KEYS.includes(key)) {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            (settings as any)[key] = numValue;
          }
        } else {
          (settings as any)[key] = String(value);
        }
      }
    });

    return settings;
  } catch (error) {
    console.error("Failed to get system settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 会社情報のみ取得（PDF生成用）
 */
export async function getCompanyInfo(): Promise<{
  company_name: string;
  company_postal_code: string;
  company_address: string;
  issuing_department: string;
}> {
  const settings = await getSystemSettings();
  return {
    company_name: settings.company_name,
    company_postal_code: settings.company_postal_code,
    company_address: settings.company_address,
    issuing_department: settings.issuing_department,
  };
}

/**
 * システム設定を更新
 */
export async function updateSystemSettings(
  settings: Partial<SystemSettings>,
  updatedBy: string
): Promise<void> {
  try {
    const now = Date.now();

    // 既存の設定を取得
    const response = await getBaseRecords(LARK_TABLES.SYSTEM_SETTINGS);
    const existingSettings = new Map<string, string>();

    if (response.data?.items) {
      response.data.items.forEach((item: any) => {
        const key = item.fields[SYSTEM_SETTINGS_FIELDS.setting_key];
        if (key) {
          existingSettings.set(key, item.record_id);
        }
      });
    }

    // 各設定の更新/作成処理を並列で実行
    const updatePromises: Promise<any>[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue;

      const recordId = existingSettings.get(key);

      if (recordId) {
        // 更新
        updatePromises.push(
          updateBaseRecord(LARK_TABLES.SYSTEM_SETTINGS, recordId, {
            [SYSTEM_SETTINGS_FIELDS.setting_value]: String(value),
            [SYSTEM_SETTINGS_FIELDS.updated_at]: now,
            [SYSTEM_SETTINGS_FIELDS.updated_by]: updatedBy,
          })
        );
      } else {
        // 新規作成
        updatePromises.push(
          createBaseRecord(LARK_TABLES.SYSTEM_SETTINGS, {
            [SYSTEM_SETTINGS_FIELDS.setting_key]: key,
            [SYSTEM_SETTINGS_FIELDS.setting_value]: String(value),
            [SYSTEM_SETTINGS_FIELDS.updated_at]: now,
            [SYSTEM_SETTINGS_FIELDS.updated_by]: updatedBy,
          })
        );
      }
    }

    // 全ての更新を並列実行
    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Failed to update system settings:", error);
    throw error;
  }
}
