import type { Permit } from "@/types/syaryo";

/**
 * 免許証・車検証・保険証の有効期限から最小値を取得
 * 許可証の有効期限は3つの書類の中で最も早い期限とする
 */
export function calculatePermitExpiration(
  licenseExpiration: Date,
  vehicleExpiration: Date,
  insuranceExpiration: Date
): Date {
  const dates = [
    licenseExpiration.getTime(),
    vehicleExpiration.getTime(),
    insuranceExpiration.getTime(),
  ];
  return new Date(Math.min(...dates));
}

/**
 * 許可証の有効性チェック
 */
export function isPermitValid(permit: Permit): boolean {
  if (permit.status !== "valid") {
    return false;
  }
  return permit.expiration_date.getTime() > Date.now();
}

/**
 * 許可証の有効期限までの日数を計算
 */
export function getDaysUntilExpiration(expirationDate: Date): number {
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 許可証のステータスラベルを取得
 */
export function getPermitStatusLabel(status: Permit["status"]): string {
  switch (status) {
    case "valid":
      return "有効";
    case "expired":
      return "期限切れ";
    case "revoked":
      return "取消済";
    default:
      return "不明";
  }
}

/**
 * 日付をフォーマット（YYYY年MM月DD日）
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
}

/**
 * 日付をフォーマット（YYYY/MM/DD）
 */
export function formatDateSlash(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * 検証用URLを生成
 */
export function generateVerificationUrl(
  baseUrl: string,
  verificationToken: string
): string {
  return `${baseUrl}/verify/${verificationToken}`;
}
