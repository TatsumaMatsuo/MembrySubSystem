import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  buildUserPermissions,
  buildPermittedMenuStructure,
  getAllMenuStructure,
  getMenuDisplayMaster,
  getFunctionPlacementMaster,
} from "@/lib/menu-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/menu-permission
 * ユーザーの権限に基づいたメニュー構造を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 開発環境では認証をスキップ
    const isDev = process.env.NODE_ENV === "development";

    // クエリパラメータ
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode"); // "all" で全メニュー取得（管理者用）

    if (mode === "all") {
      // 全メニュー構造を取得（権限設定画面用）
      const menuStructure = await getAllMenuStructure();
      return NextResponse.json({
        success: true,
        data: menuStructure,
      });
    }

    if (mode === "masters") {
      // マスタデータを取得（設定画面用）
      const [menus, programs] = await Promise.all([
        getMenuDisplayMaster(),
        getFunctionPlacementMaster(),
      ]);
      return NextResponse.json({
        success: true,
        data: { menus, programs },
      });
    }

    // セッションからユーザー情報を取得
    const session = await getServerSession();

    let employeeId = "";
    let employeeName = "";
    let groupIds: string[] = [];

    if (session?.user) {
      // 認証済みユーザー
      employeeId = session.user.employeeId || "";
      employeeName = session.user.employeeName || session.user.name || "";

      // 部門をグループIDとして使用（部門名がグループ権限マスタのグループIDに対応）
      if (session.user.department) {
        groupIds = [session.user.department];
      }

      console.log("[menu-permission] User from session:", {
        employeeId,
        employeeName,
        department: session.user.department,
        groupIds,
      });
    } else if (isDev) {
      // 開発環境で未認証の場合はダミーデータを使用
      employeeId = "dev_user";
      employeeName = "開発ユーザー";
      groupIds = ["grp_admin"]; // 管理者グループ
      console.log("[menu-permission] Using dev dummy data");
    } else {
      // 本番環境で未認証の場合
      console.log("[menu-permission] No session found, using empty permissions");
    }

    // 権限情報を構築
    const permissions = await buildUserPermissions(employeeId, employeeName, groupIds);

    // 権限付きメニュー構造を構築
    const menuStructure = await buildPermittedMenuStructure(permissions);

    return NextResponse.json({
      success: true,
      data: {
        permissions,
        menuStructure,
      },
    });
  } catch (error) {
    console.error("[menu-permission] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch menu permissions" },
      { status: 500 }
    );
  }
}
