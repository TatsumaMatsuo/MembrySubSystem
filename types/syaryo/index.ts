// 基本型定義

export type Status = "temporary" | "approved";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type UserRole = "applicant" | "admin";
export type EmploymentStatus = "active" | "resigned";
export type PermissionRole = "admin" | "viewer";
export type MembershipType = "internal" | "external" | "contractor";
export type NotificationType =
  | "expiration_warning"
  | "expiration_alert"
  | "approval"
  | "rejection"
  | "admin_escalation";
export type NotificationStatus = "sent" | "failed";
export type PermitStatus = "valid" | "expired" | "revoked";

// Lark添付ファイル型
export interface LarkAttachment {
  file_token: string;
  name: string;
  size: number;
  type: string;
  tmp_url?: string; // Lark Baseから取得時の一時ダウンロードURL（バッチAPI）
  url?: string; // Lark Baseから取得時の直接ダウンロードURL
}

// 社員型
export interface Employee {
  employee_id: string;
  employee_name: string;
  email: string;
  department?: string;
  role: UserRole;
  membership_type: MembershipType;
  employment_status: EmploymentStatus;
  hire_date?: Date;
  resignation_date?: Date;
  created_at?: Date;
  updated_at?: Date;
}

// 免許証型
export interface DriversLicense {
  id: string;
  employee_id: string;
  license_number: string;
  license_type: string;
  issue_date: Date;
  expiration_date: Date;
  image_attachment: LarkAttachment | null;
  image_attachment_ura: LarkAttachment | null; // 裏面画像
  status: Status;
  approval_status: ApprovalStatus;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  deleted_flag: boolean;
  deleted_at?: Date;
}

// 車検証型
export interface VehicleRegistration {
  id: string;
  employee_id: string;
  vehicle_number: string;
  vehicle_type: string;
  manufacturer: string;
  model_name: string;
  inspection_expiration_date: Date;
  owner_name: string;
  image_attachment: LarkAttachment | null;
  status: Status;
  approval_status: ApprovalStatus;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  deleted_flag: boolean;
  deleted_at?: Date;
}

// 任意保険証型
export interface InsurancePolicy {
  id: string;
  employee_id: string;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  coverage_start_date: Date;
  coverage_end_date: Date;
  insured_amount?: number;
  // 補償内容（会社規定: 対人=無制限、対物≥5000万、搭乗者傷害≥2000万）
  liability_personal_unlimited: boolean; // 対人補償無制限
  liability_property_amount: number; // 対物補償金額（万円単位）
  passenger_injury_amount: number; // 搭乗者傷害金額（万円単位）
  image_attachment: LarkAttachment | null;
  status: Status;
  approval_status: ApprovalStatus;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  deleted_flag: boolean;
  deleted_at?: Date;
}

// 統合ビュー型（管理者画面用）
// 1:多対応: vehicles, insurances は配列
export interface ApplicationOverview {
  employee: Employee;
  license: DriversLicense | null;
  vehicles: VehicleRegistration[];
  insurances: InsurancePolicy[];
}

// 通知履歴型
export interface NotificationHistory {
  id: string;
  recipient_id: string;
  notification_type: NotificationType;
  document_type?: "license" | "vehicle" | "insurance";
  document_id?: string;
  title: string;
  message: string;
  sent_at: Date;
  status: NotificationStatus;
  created_at: Date;
}

// ユーザー権限型
export interface UserPermission {
  id: string;
  lark_user_id: string;
  user_name: string;
  user_email: string;
  role: PermissionRole;
  granted_by: string;
  granted_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Larkユーザー型
export interface LarkUser {
  open_id: string;
  union_id?: string;
  user_id?: string;
  name: string;
  en_name?: string;
  email: string;
  mobile?: string;
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  department_ids?: string[];
}

// 許可証型
export interface Permit {
  id: string;
  employee_id: string;
  employee_name: string;
  vehicle_id: string;
  vehicle_number: string;
  vehicle_model: string; // 後方互換性のため残す（メーカー + 車名）
  manufacturer?: string; // メーカー
  model_name?: string; // 車名
  issue_date: Date;
  expiration_date: Date;
  permit_file_key: string;
  verification_token: string;
  status: PermitStatus;
  created_at: Date;
  updated_at: Date;
}

// 許可証作成入力型
export interface CreatePermitInput {
  employee_id: string;
  employee_name: string;
  vehicle_id: string;
  vehicle_number: string;
  vehicle_model: string;
  manufacturer?: string; // メーカー
  model_name?: string; // 車名
  expiration_date: Date;
}
