import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  buildUserPermissions,
  buildPermittedMenuStructure,
  getAllMenuStructure,
  getMenuDisplayMaster,
  getFunctionPlacementMaster,
  getEmployeeByEmail,
  getEmployeeByLarkId,
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
      const userEmail = session.user.email || "";
      const larkId = session.user.id || "";

      console.log("[menu-permission] User from session:", {
        larkId,
        name: session.user.name,
        email: userEmail,
      });

      // 社員情報を検索（メールまたはLark IDで）
      let employeeInfo = null;

      // 1. メールアドレスがある場合はメールで検索
      if (userEmail) {
        employeeInfo = await getEmployeeByEmail(userEmail);
      }

      // 2. メールで見つからない場合はLark open_idで検索
      if (!employeeInfo && larkId) {
        console.log("[menu-permission] Email lookup failed, trying Lark ID lookup");
        employeeInfo = await getEmployeeByLarkId(larkId);
      }

      if (employeeInfo) {
        // 社員情報が見つかった場合
        employeeId = employeeInfo.employeeId;
        employeeName = employeeInfo.employeeName || session.user.name || "";
        // 部署をグループIDとして使用
        if (employeeInfo.department) {
          groupIds = [employeeInfo.department];
        }

        console.log("[menu-permission] Employee info found:", {
          employeeId,
          employeeName,
          groupIds,
        });
      } else {
        // 社員情報が見つからない場合はLark IDを使用
        employeeId = larkId;
        employeeName = session.user.name || "";
        console.log("[menu-permission] Employee not found by email or Lark ID, using Lark ID:", employeeId);
      }
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
