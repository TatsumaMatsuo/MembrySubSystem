import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getUserPermission,
  isAdmin,
  hasViewPermission,
} from "@/lib/syaryo/services/user-permission.service";
import { MembershipType } from "@/types/syaryo";

/**
 * 現在のユーザーのLark User ID（メールアドレス）を取得
 * MembrySubSystem の JWT セッションをラップ
 */
export async function getCurrentLarkUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    if (!session?.user) return null;
    return session.user.email || null;
  } catch (error) {
    console.error("[syaryo/auth-utils] Failed to get current user ID:", error);
    return null;
  }
}

/**
 * サーバーサイドで現在のユーザー情報を取得
 */
export async function getCurrentUser() {
  try {
    const session = await getServerSession();
    if (!session?.user) return null;
    return {
      id: session.user.id || session.user.email || null,
      name: session.user.name || null,
      email: session.user.email || null,
      image: session.user.image || null,
    };
  } catch (error) {
    console.error("[syaryo/auth-utils] Failed to get current user:", error);
    return null;
  }
}

/**
 * 認証のみチェック（権限は問わない）
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const userId = session.user.email || null;
  return {
    authorized: true as const,
    userId,
    user: session.user,
  };
}

/**
 * 管理者権限をチェック
 */
export async function requireAdmin() {
  const userId = await getCurrentLarkUserId();
  if (!userId) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const adminCheck = await isAdmin(userId);
  if (!adminCheck) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Forbidden - Admin access required" }, { status: 403 }),
    };
  }
  return { authorized: true as const, userId };
}

/**
 * 閲覧権限以上をチェック（管理者または閲覧者）
 */
export async function requireViewPermission() {
  const userId = await getCurrentLarkUserId();
  if (!userId) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const viewPermission = await hasViewPermission(userId);
  if (!viewPermission) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Forbidden - View access required" }, { status: 403 }),
    };
  }
  return { authorized: true as const, userId };
}

/**
 * ユーザーの権限情報を取得
 */
export async function getCurrentUserPermission() {
  const userId = await getCurrentLarkUserId();
  if (!userId) return null;
  return await getUserPermission(userId);
}

/**
 * 現在のユーザーのメンバーシップタイプを取得
 * MembrySubSystem では全員 "internal" として扱う
 */
export async function getCurrentMembershipType(): Promise<MembershipType | null> {
  const session = await getServerSession();
  if (!session?.user) return null;
  return "internal";
}

export async function isInternalMember(): Promise<boolean> {
  return (await getCurrentMembershipType()) === "internal";
}

export async function isExternalMember(): Promise<boolean> {
  const m = await getCurrentMembershipType();
  return m === "external" || m === "contractor";
}

/**
 * 内部社員のみアクセス可能な機能をチェック
 */
export async function requireInternalMember() {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult;
  return {
    authorized: true as const,
    userId: authResult.userId,
    user: authResult.user,
    membershipType: "internal" as MembershipType,
  };
}

export interface MembershipRestrictions {
  canViewAllEmployees: boolean;
  canExportData: boolean;
  canViewAnalytics: boolean;
  canAccessAdminPanel: boolean;
  canViewOtherDepartments: boolean;
}

export function getMembershipRestrictions(membershipType: MembershipType | null): MembershipRestrictions {
  if (membershipType === "internal") {
    return {
      canViewAllEmployees: true,
      canExportData: true,
      canViewAnalytics: true,
      canAccessAdminPanel: true,
      canViewOtherDepartments: true,
    };
  }
  return {
    canViewAllEmployees: false,
    canExportData: false,
    canViewAnalytics: false,
    canAccessAdminPanel: false,
    canViewOtherDepartments: false,
  };
}
