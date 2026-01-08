import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { MembershipType } from "@/types";

/**
 * 現在のユーザーのLark User IDを取得
 */
export async function getCurrentLarkUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return null;
    }

    return session.user.email || null;
  } catch (error) {
    console.error("Failed to get current user ID:", error);
    return null;
  }
}

/**
 * サーバーサイドで現在のユーザー情報を取得
 */
export async function getCurrentUser() {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return null;
    }

    return {
      id: (session.user as any).id || null,
      name: session.user.name || null,
      email: session.user.email || null,
      image: session.user.image || null,
    };
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

/**
 * 認証のみチェック（権限は問わない）
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session || !session.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const userId = session.user.email || null;

  return {
    authorized: true,
    userId,
    user: session.user,
  };
}

/**
 * 現在のユーザーのメンバーシップタイプを取得
 */
export async function getCurrentMembershipType(): Promise<MembershipType | null> {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return null;
    }

    return (session.user as any).membershipType || null;
  } catch (error) {
    console.error("Failed to get membership type:", error);
    return null;
  }
}

/**
 * 内部社員かどうかをチェック
 */
export async function isInternalMember(): Promise<boolean> {
  const membershipType = await getCurrentMembershipType();
  return membershipType === "internal";
}

/**
 * 内部社員のみアクセス可能な機能をチェック
 */
export async function requireInternalMember() {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const membershipType = (authResult.user as any)?.membershipType;

  if (membershipType !== "internal") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: "この機能は内部社員のみ利用可能です",
          errorCode: "EXTERNAL_MEMBER_RESTRICTED"
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    userId: authResult.userId,
    user: authResult.user,
    membershipType: membershipType as MembershipType,
  };
}

/**
 * メンバーシップタイプに基づく機能制限情報を取得
 */
export interface MembershipRestrictions {
  canViewAllData: boolean;
  canExportData: boolean;
  canEditData: boolean;
}

export function getMembershipRestrictions(membershipType: MembershipType | null): MembershipRestrictions {
  if (membershipType === "internal") {
    return {
      canViewAllData: true,
      canExportData: true,
      canEditData: true,
    };
  }

  if (membershipType === "contractor") {
    return {
      canViewAllData: true,
      canExportData: false,
      canEditData: false,
    };
  }

  // external or unknown
  return {
    canViewAllData: false,
    canExportData: false,
    canEditData: false,
  };
}
