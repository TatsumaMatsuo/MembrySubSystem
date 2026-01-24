import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getMenuDisplayMaster,
  getFunctionPlacementMaster,
  getGroupPermissions,
  getUserPermissions,
  getEmployeeByEmail,
} from "@/lib/menu-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/menu-debug
 * デバッグ用 - 権限システムの各ステップを確認
 */
export async function GET(request: NextRequest) {
  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasLarkBaseTokenMaster: !!process.env.LARK_BASE_TOKEN_MASTER,
    },
  };

  try {
    // Step 1: セッション確認
    const session = await getServerSession();
    debug.session = {
      hasUser: !!session?.user,
      userId: session?.user?.id || null,
      userName: session?.user?.name || null,
      userEmail: session?.user?.email || null,
    };

    // Step 2: 社員情報検索
    if (session?.user?.email) {
      const employee = await getEmployeeByEmail(session.user.email);
      debug.employee = employee || "NOT_FOUND";
    } else {
      debug.employee = "NO_EMAIL_IN_SESSION";
    }

    // Step 3: グループ権限確認
    const department = typeof debug.employee === "object" ? debug.employee.department : null;
    if (department) {
      const groupPerms = await getGroupPermissions([department]);
      debug.groupPermissions = {
        department,
        count: groupPerms.length,
        sample: groupPerms.slice(0, 5).map(p => ({
          target_type: p.target_type,
          target_id: p.target_id,
          is_allowed: p.is_allowed,
        })),
      };
    } else {
      debug.groupPermissions = "NO_DEPARTMENT";
    }

    // Step 4: メニューマスタ確認
    const menus = await getMenuDisplayMaster();
    debug.menus = {
      total: menus.length,
      level1: menus.filter(m => m.level === 1).length,
      level2: menus.filter(m => m.level === 2).length,
      sample: menus.slice(0, 5).map(m => ({
        menu_id: m.menu_id,
        menu_name: m.menu_name,
        level: m.level,
        parent_menu_id: m.parent_menu_id,
      })),
    };

    // Step 5: プログラムマスタ確認
    const programs = await getFunctionPlacementMaster();
    debug.programs = {
      total: programs.length,
      sample: programs.slice(0, 5).map(p => ({
        program_id: p.program_id,
        program_name: p.program_name,
        menu_id: p.menu_id,
      })),
    };

    // Step 6: 個別権限確認
    const employeeId = typeof debug.employee === "object" ? debug.employee.employeeId : "";
    if (employeeId) {
      const userPerms = await getUserPermissions(employeeId);
      debug.userPermissions = {
        employeeId,
        count: userPerms.length,
      };
    }

    return NextResponse.json({ success: true, debug });
  } catch (error) {
    debug.error = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, debug }, { status: 500 });
  }
}
