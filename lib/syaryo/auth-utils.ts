import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getEmployeeByEmail,
  getEmployeeByLarkId,
  buildUserPermissions,
} from "@/lib/menu-permission";
import { MembershipType } from "@/types/syaryo";

/**
 * 車両管理システム関連のプログラムID（MS_SYS機能配置マスタと連動）
 * - PGM030: 閲覧権限（旧 viewer）
 * - PGM031: 管理者操作権限（旧 admin・サイドバー非表示）
 */
const PGM_SYARYO_VIEW = "PGM030";
const PGM_SYARYO_ADMIN = "PGM031";

/**
 * 現在のユーザーの社員情報と許可プログラムを取得（内部用）
 */
async function resolveUserPermissions(): Promise<{
  email: string | null;
  employeeId: string;
  employeeName: string;
  department: string;
  permittedPrograms: string[];
} | null> {
  const session = await getServerSession();
  if (!session?.user) return null;

  const email = session.user.email || null;
  const larkId = (session.user as any).id || null;

  let employee = email ? await getEmployeeByEmail(email) : null;
  if (!employee && larkId) {
    employee = await getEmployeeByLarkId(larkId);
  }
  if (!employee) return null;

  const perms = await buildUserPermissions(
    employee.employeeId,
    employee.employeeName,
    [employee.department]
  );

  return {
    email,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    department: employee.department,
    permittedPrograms: perms.permitted_programs,
  };
}

/**
 * 現在のユーザーの社員情報を取得
 * email → Lark Open ID の順で社員マスタを検索する
 *
 * Lark OIDCがemailを返さないアカウントでも社員IDを解決できるようにする共通ヘルパー
 */
export async function getCurrentEmployeeInfo(): Promise<{
  email: string | null;
  employeeId: string;
  employeeName: string;
  department: string;
} | null> {
  const session = await getServerSession();
  if (!session?.user) return null;

  const email = session.user.email || null;
  const larkId = (session.user as any).id || null;

  let employee = email ? await getEmployeeByEmail(email) : null;
  if (!employee && larkId) {
    employee = await getEmployeeByLarkId(larkId);
  }
  if (!employee) return null;

  return {
    email,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    department: employee.department,
  };
}

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
      id: (session.user as any).id || session.user.email || null,
      name: session.user.name || null,
      email: session.user.email || null,
      image: (session.user as any).image || null,
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
 * MembrySub の機能配置マスタで PGM031 (車両管理-管理者操作) が許可されているかで判定
 */
export async function requireAdmin() {
  const result = await resolveUserPermissions();
  if (!result) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!result.permittedPrograms.includes(PGM_SYARYO_ADMIN)) {
    console.log("[syaryo/auth-utils] Admin check failed for:", result.email, "permitted:", result.permittedPrograms);
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Forbidden - Admin access required" }, { status: 403 }),
    };
  }
  return { authorized: true as const, userId: result.email };
}

/**
 * 閲覧権限以上をチェック（管理者または閲覧者）
 * PGM030 または PGM031 のいずれかが許可されていれば閲覧可
 */
export async function requireViewPermission() {
  const result = await resolveUserPermissions();
  if (!result) {
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const ok =
    result.permittedPrograms.includes(PGM_SYARYO_VIEW) ||
    result.permittedPrograms.includes(PGM_SYARYO_ADMIN);
  if (!ok) {
    console.log("[syaryo/auth-utils] View check failed for:", result.email, "permitted:", result.permittedPrograms);
    return {
      authorized: false as const,
      response: NextResponse.json({ success: false, error: "Forbidden - View access required" }, { status: 403 }),
    };
  }
  return { authorized: true as const, userId: result.email };
}

/**
 * ユーザーの権限情報を取得
 * 旧 UserPermission 形式互換のレスポンスを返す（移行期間中の後方互換）
 */
export async function getCurrentUserPermission() {
  const result = await resolveUserPermissions();
  if (!result) return null;

  const isAdmin = result.permittedPrograms.includes(PGM_SYARYO_ADMIN);
  const hasView = isAdmin || result.permittedPrograms.includes(PGM_SYARYO_VIEW);
  if (!hasView) return null;

  return {
    id: result.employeeId,
    lark_user_id: result.email || "",
    user_name: result.employeeName,
    user_email: result.email || "",
    role: (isAdmin ? "admin" : "viewer") as "admin" | "viewer",
    granted_by: "menu-permission",
    granted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
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
