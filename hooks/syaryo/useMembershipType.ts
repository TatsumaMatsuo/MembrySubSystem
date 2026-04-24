"use client";

import { useSession } from "next-auth/react";
import { MembershipType } from "@/types";

/**
 * メンバーシップタイプに基づく機能制限情報
 */
export interface MembershipRestrictions {
  canViewAllEmployees: boolean;      // 全社員データ閲覧
  canExportData: boolean;            // データエクスポート
  canViewAnalytics: boolean;         // 分析ダッシュボード
  canAccessAdminPanel: boolean;      // 管理画面アクセス
  canViewOtherDepartments: boolean;  // 他部署データ閲覧
}

/**
 * メンバーシップタイプに基づく制限を取得
 */
function getRestrictions(membershipType: MembershipType | null | undefined): MembershipRestrictions {
  // 内部社員: 全機能利用可能
  if (membershipType === "internal") {
    return {
      canViewAllEmployees: true,
      canExportData: true,
      canViewAnalytics: true,
      canAccessAdminPanel: true,
      canViewOtherDepartments: true,
    };
  }

  // 業務委託・外部メンバー: 制限あり
  return {
    canViewAllEmployees: false,
    canExportData: false,
    canViewAnalytics: false,
    canAccessAdminPanel: false,
    canViewOtherDepartments: false,
  };
}

/**
 * 現在のユーザーのメンバーシップタイプと制限情報を取得するフック
 */
export function useMembershipType() {
  const { data: session, status } = useSession();

  const membershipType = (session?.user as any)?.membershipType as MembershipType | null | undefined;
  const restrictions = getRestrictions(membershipType);

  return {
    membershipType,
    isLoading: status === "loading",
    isInternal: membershipType === "internal",
    isExternal: membershipType === "external",
    isContractor: membershipType === "contractor",
    isExternalOrContractor: membershipType === "external" || membershipType === "contractor",
    restrictions,
  };
}

/**
 * メンバーシップタイプのラベルを取得
 */
export function getMembershipTypeLabel(membershipType: MembershipType | null | undefined): string {
  switch (membershipType) {
    case "internal":
      return "内部社員";
    case "external":
      return "外部メンバー";
    case "contractor":
      return "業務委託";
    default:
      return "不明";
  }
}

/**
 * メンバーシップタイプのバッジカラーを取得
 */
export function getMembershipTypeBadgeColor(membershipType: MembershipType | null | undefined): string {
  switch (membershipType) {
    case "internal":
      return "bg-green-100 text-green-800";
    case "external":
      return "bg-blue-100 text-blue-800";
    case "contractor":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
