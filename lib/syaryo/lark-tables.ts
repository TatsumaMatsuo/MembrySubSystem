/**
 * Lark Base テーブルID定義
 *
 * サーバーレス環境での遅延初期化に対応
 */

/**
 * ユーザ検索専用テーブルID（社員マスタ）
 */
export const USER_SEARCH_TABLE_ID = "tblFj7MnxF3svRcu";

/**
 * テーブルIDを取得（遅延初期化対応）
 */
export function getLarkTables() {
  return {
    DRIVERS_LICENSES: process.env.LARK_TABLE_DRIVERS_LICENSES || "",
    VEHICLE_REGISTRATIONS: process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || "",
    INSURANCE_POLICIES: process.env.LARK_TABLE_INSURANCE_POLICIES || "",
    EMPLOYEES: process.env.LARK_TABLE_EMPLOYEES || "",
    USER_PERMISSIONS: process.env.LARK_TABLE_USER_PERMISSIONS || "",
    NOTIFICATION_HISTORY: process.env.LARK_TABLE_NOTIFICATION_HISTORY || "",
    SYSTEM_SETTINGS: process.env.LARK_TABLE_SYSTEM_SETTINGS || "",
    APPROVAL_HISTORY: process.env.LARK_APPROVAL_HISTORY_TABLE_ID || "",
    PERMITS: process.env.LARK_TABLE_PERMITS || "",
  };
}

// 後方互換性のため（非推奨: getLarkTables()を使用してください）
export const LARK_TABLES = {
  get DRIVERS_LICENSES() { return process.env.LARK_TABLE_DRIVERS_LICENSES || ""; },
  get VEHICLE_REGISTRATIONS() { return process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || ""; },
  get INSURANCE_POLICIES() { return process.env.LARK_TABLE_INSURANCE_POLICIES || ""; },
  get EMPLOYEES() { return process.env.LARK_TABLE_EMPLOYEES || ""; },
  get USER_PERMISSIONS() { return process.env.LARK_TABLE_USER_PERMISSIONS || ""; },
  get NOTIFICATION_HISTORY() { return process.env.LARK_TABLE_NOTIFICATION_HISTORY || ""; },
  get SYSTEM_SETTINGS() { return process.env.LARK_TABLE_SYSTEM_SETTINGS || ""; },
  get APPROVAL_HISTORY() { return process.env.LARK_APPROVAL_HISTORY_TABLE_ID || ""; },
  get PERMITS() { return process.env.LARK_TABLE_PERMITS || ""; },
};

/**
 * テーブルフィールド定義
 */

export const DRIVERS_LICENSE_FIELDS = {
  id: "id",
  employee_id: "employee_id",
  license_number: "license_number",
  license_type: "license_type",
  issue_date: "issue_date",
  expiration_date: "expiration_date",
  image_attachment: "image_attachment",
  image_attachment_ura: "image_attachment_ura", // 裏面画像
  status: "status",
  approval_status: "approval_status",
  rejection_reason: "rejection_reason",
  created_at: "created_at",
  updated_at: "updated_at",
  deleted_flag: "deleted_flag",
  deleted_at: "deleted_at",
} as const;

export const VEHICLE_REGISTRATION_FIELDS = {
  id: "id",
  employee_id: "employee_id",
  vehicle_number: "vehicle_number",
  vehicle_type: "vehicle_type",
  manufacturer: "manufacturer",
  model_name: "model_name",
  expiration_date: "expiration_date",  // 実際のフィールド名
  registration_date: "registration_date",
  owner_name: "owner_name",
  image_attachment: "image_attachment",
  status: "status",
  approval_status: "approval_status",
  rejection_reason: "rejection_reason",
  created_at: "created_at",
  updated_at: "updated_at",
  deleted_flag: "deleted_flag",
  deleted_at: "deleted_at",
} as const;

export const INSURANCE_POLICY_FIELDS = {
  id: "id",
  employee_id: "employee_id",
  policy_number: "policy_number",
  insurance_company: "insurance_company",
  policy_type: "policy_type",
  coverage_start_date: "coverage_start_date",
  coverage_end_date: "coverage_end_date",
  insured_amount: "insured_amount",
  // 補償内容フィールド（会社規定: 対人=無制限、対物≥5000万、搭乗者傷害≥2000万）
  liability_personal_unlimited: "liability_personal_unlimited", // 対人補償無制限（チェックボックス）
  liability_property_amount: "liability_property_amount", // 対物補償金額（万円単位）
  passenger_injury_amount: "passenger_injury_amount", // 搭乗者傷害金額（万円単位）
  image_attachment: "image_attachment",
  status: "status",
  approval_status: "approval_status",
  rejection_reason: "rejection_reason",
  created_at: "created_at",
  updated_at: "updated_at",
  deleted_flag: "deleted_flag",
  deleted_at: "deleted_at",
} as const;

export const EMPLOYEE_FIELDS = {
  employee_id: "社員コード",
  employee_name: "社員名 (メンバー )",
  email: "社員名 (メンバー ).仕事用メールアドレス",
  department: "社員名 (メンバー ).部署",
  role: "role",
  membership_type: "membership_type",
  employment_status: "employment_status",
  hire_date: "hire_date",
  resignation_date: "resignation_date",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

/**
 * 社員マスタテーブル（USER_SEARCH_TABLE_ID）のフィールド定義
 */
export const EMPLOYEE_MASTER_FIELDS = {
  employee_id: "社員コード",
  employee_name: "社員名",
  people_field: "社員名 (メンバー )",
  email: "社員名 (メンバー ).仕事用メールアドレス",
  department: "社員名 (メンバー ).部署",
  resigned_flag: "退職者フラグ",
} as const;

export const USER_PERMISSION_FIELDS = {
  id: "id",
  lark_user_id: "lark_user_id",
  user_name: "user_name",
  user_email: "user_email",
  role: "role",
  granted_by: "granted_by",
  granted_at: "granted_at",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

export const NOTIFICATION_HISTORY_FIELDS = {
  id: "id",
  recipient_id: "recipient_id",
  notification_type: "notification_type",
  document_type: "document_type",
  document_id: "document_id",
  title: "title",
  message: "message",
  sent_at: "sent_at",
  status: "status",
  created_at: "created_at",
} as const;

export const SYSTEM_SETTINGS_FIELDS = {
  id: "id",
  setting_key: "setting_key",
  setting_value: "setting_value",
  updated_at: "updated_at",
  updated_by: "updated_by",
} as const;

export const APPROVAL_HISTORY_FIELDS = {
  id: "id",
  application_type: "application_type",
  application_id: "application_id",
  employee_id: "employee_id",
  employee_name: "employee_name",
  action: "action",
  approver_id: "approver_id",
  approver_name: "approver_name",
  reason: "reason",
  timestamp: "timestamp",
  created_at: "created_at",
} as const;

export const PERMIT_FIELDS = {
  id: "id",
  employee_id: "employee_id",
  employee_name: "employee_name",
  vehicle_id: "vehicle_id",
  vehicle_number: "vehicle_number",
  vehicle_model: "vehicle_model", // 後方互換性のため残す（メーカー + 車名）
  manufacturer: "manufacturer", // メーカー（新規追加）
  model_name: "model_name", // 車名（新規追加）
  issue_date: "issue_date",
  expiration_date: "expiration_date",
  permit_file_key: "permit_file_key",
  verification_token: "verification_token",
  status: "status",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;
