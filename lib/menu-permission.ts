/**
 * メニュー権限システム ライブラリ
 */
import { getBaseRecords, getLarkBaseTokenForMaster } from "./lark-client";
import {
  MenuDisplayMaster,
  FunctionPlacementMaster,
  GroupPermissionMaster,
  UserPermissionMaster,
  PermittedMenuStructure,
  UserMenuPermissions,
} from "@/types";
import { getLarkTables, getBaseTokenForTable, EMPLOYEE_FIELDS, getLarkBaseTokenMaster } from "./lark-tables";

// テーブルID (AWS Amplify SSR用フォールバック値付き)
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";
const TABLE_USER_PERMISSION = process.env.LARK_TABLE_USER_PERMISSION || "tbl2hvSUkEe3fn7t";

/**
 * 社員情報
 */
export interface EmployeeInfo {
  employeeId: string;
  employeeName: string;
  email: string;
  department: string;
}

/**
 * メールアドレスから社員情報を取得
 */
export async function getEmployeeByEmail(email: string): Promise<EmployeeInfo | null> {
  if (!email) return null;

  try {
    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("EMPLOYEES");

    console.log("[menu-permission] Looking up employee by email:", email);

    // メールアドレスでフィルタ
    const response = await getBaseRecords(tables.EMPLOYEES, {
      baseToken,
      filter: `CurrentValue.[${EMPLOYEE_FIELDS.email}] = "${email}"`,
      pageSize: 1,
    });

    if (!response.data?.items || response.data.items.length === 0) {
      console.log("[menu-permission] Employee not found for email:", email);
      return null;
    }

    const item = response.data.items[0] as { fields: Record<string, any> };
    const employeeInfo: EmployeeInfo = {
      employeeId: String(item.fields[EMPLOYEE_FIELDS.employee_id] || ""),
      employeeName: String(item.fields[EMPLOYEE_FIELDS.employee_name] || ""),
      email: email,
      department: String(item.fields[EMPLOYEE_FIELDS.department] || ""),
    };

    console.log("[menu-permission] Employee found:", {
      employeeId: employeeInfo.employeeId,
      employeeName: employeeInfo.employeeName,
      department: employeeInfo.department,
    });

    return employeeInfo;
  } catch (error) {
    console.error("[menu-permission] Error looking up employee:", error);
    return null;
  }
}

/**
 * Lark open_id から社員情報を取得
 * メールアドレスがセッションに含まれていない場合のフォールバック
 */
export async function getEmployeeByLarkId(larkOpenId: string): Promise<EmployeeInfo | null> {
  if (!larkOpenId) return null;

  try {
    const tables = getLarkTables();
    const baseToken = getBaseTokenForTable("EMPLOYEES");

    console.log("[menu-permission] Looking up employee by Lark open_id:", larkOpenId);

    // 全社員を取得して、メンバーフィールド内のidで検索
    // Note: Lark Bitable APIでは配列内のフィールドを直接フィルタできないため、
    // 全件取得して検索する
    const response = await getBaseRecords(tables.EMPLOYEES, {
      baseToken,
      pageSize: 500,
    });

    if (!response.data?.items) {
      console.log("[menu-permission] No employees found");
      return null;
    }

    // メンバーフィールド内のidでマッチする社員を検索
    for (const item of response.data.items as Array<{ fields: Record<string, any> }>) {
      const memberField = item.fields[EMPLOYEE_FIELDS.member];
      if (Array.isArray(memberField)) {
        for (const member of memberField) {
          if (member.id === larkOpenId) {
            const employeeInfo: EmployeeInfo = {
              employeeId: String(item.fields[EMPLOYEE_FIELDS.employee_id] || ""),
              employeeName: String(item.fields[EMPLOYEE_FIELDS.employee_name] || member.name || ""),
              email: member.email || "",
              department: Array.isArray(item.fields[EMPLOYEE_FIELDS.department])
                ? item.fields[EMPLOYEE_FIELDS.department][0] || ""
                : String(item.fields[EMPLOYEE_FIELDS.department] || ""),
            };

            console.log("[menu-permission] Employee found by Lark ID:", {
              employeeId: employeeInfo.employeeId,
              employeeName: employeeInfo.employeeName,
              email: employeeInfo.email,
              department: employeeInfo.department,
            });

            return employeeInfo;
          }
        }
      }
    }

    console.log("[menu-permission] Employee not found for Lark open_id:", larkOpenId);
    return null;
  } catch (error) {
    console.error("[menu-permission] Error looking up employee by Lark ID:", error);
    return null;
  }
}

/**
 * メニュー表示マスタを取得
 */
export async function getMenuDisplayMaster(): Promise<MenuDisplayMaster[]> {
  const baseToken = getLarkBaseTokenForMaster();
  console.log("[menu-permission] Fetching menus from table:", TABLE_MENU_DISPLAY);
  const response = await getBaseRecords(TABLE_MENU_DISPLAY, {
    baseToken,
    pageSize: 100,
  });
  console.log("[menu-permission] Menu response:", JSON.stringify(response.data?.items?.length || 0), "items");

  if (!response.data?.items) return [];

  const menus = response.data.items.map((item: any) => ({
    record_id: item.record_id,
    menu_id: item.fields["メニューID"] || "",
    menu_name: item.fields["メニュー名"] || "",
    level: Number(item.fields["階層レベル"]) || 1,
    parent_menu_id: item.fields["親メニューID"] || undefined,
    sort_order: Number(item.fields["表示順"]) || 0,
    icon: item.fields["アイコン"] || undefined,
    is_active: item.fields["有効フラグ"] ?? true,
  }));

  // 表示順でソート
  return menus.sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * 機能配置マスタを取得
 */
export async function getFunctionPlacementMaster(): Promise<FunctionPlacementMaster[]> {
  const baseToken = getLarkBaseTokenForMaster();
  console.log("[menu-permission] Fetching programs from table:", TABLE_FUNCTION_PLACEMENT);
  const response = await getBaseRecords(TABLE_FUNCTION_PLACEMENT, {
    baseToken,
    pageSize: 100,
  });
  console.log("[menu-permission] Program response:", JSON.stringify(response.data?.items?.length || 0), "items");

  if (!response.data?.items) return [];

  const programs = response.data.items.map((item: any) => ({
    record_id: item.record_id,
    program_id: item.fields["プログラムID"] || "",
    program_name: item.fields["プログラム名称"] || "",
    menu_id: item.fields["配置メニューID"] || "",
    url_path: item.fields["URLパス"] || "",
    sort_order: Number(item.fields["表示順"]) || 0,
    description: item.fields["説明"] || undefined,
    is_active: item.fields["有効フラグ"] ?? true,
  }));

  // 表示順でソート
  return programs.sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * グループ権限マスタを取得
 * @param groupNames - グループ名（部署名）の配列
 */
export async function getGroupPermissions(groupNames: string[]): Promise<GroupPermissionMaster[]> {
  if (groupNames.length === 0) return [];

  const baseToken = getLarkBaseTokenForMaster();
  // グループ名でフィルタ（社員マスタから取得する部署名と一致させる）
  const filterConditions = groupNames.map(name => `CurrentValue.[グループ名] = "${name}"`).join(" OR ");

  console.log("[menu-permission] Querying group permissions for:", groupNames);
  console.log("[menu-permission] Filter:", filterConditions);

  const response = await getBaseRecords(TABLE_GROUP_PERMISSION, {
    baseToken,
    filter: filterConditions,
    pageSize: 500,
  });

  console.log("[menu-permission] Group permissions found:", response.data?.items?.length || 0);

  if (!response.data?.items) return [];

  return response.data.items.map((item: any) => ({
    record_id: item.record_id,
    group_id: item.fields["グループID"] || "",
    group_name: item.fields["グループ名"] || "",
    target_type: item.fields["対象種別"] || "menu",
    target_id: item.fields["対象ID"] || "",
    is_allowed: item.fields["許可フラグ"] ?? true,
    updated_at: item.fields["更新日時"],
  }));
}

/**
 * 個別権限マスタを取得
 */
export async function getUserPermissions(employeeId: string): Promise<UserPermissionMaster[]> {
  const baseToken = getLarkBaseTokenForMaster();
  const response = await getBaseRecords(TABLE_USER_PERMISSION, {
    baseToken,
    filter: `CurrentValue.[社員ID] = "${employeeId}"`,
    pageSize: 500,
  });

  if (!response.data?.items) return [];

  return response.data.items.map((item: any) => ({
    record_id: item.record_id,
    employee_id: item.fields["社員ID"] || "",
    employee_name: item.fields["社員名"] || "",
    target_type: item.fields["対象種別"] || "menu",
    target_id: item.fields["対象ID"] || "",
    is_allowed: item.fields["許可フラグ"] ?? true,
    updated_at: item.fields["更新日時"],
  }));
}

/**
 * ユーザーの権限情報を構築
 * @param employeeId - 社員ID
 * @param employeeName - 社員名
 * @param groupNames - グループ名（部署名）の配列
 */
export async function buildUserPermissions(
  employeeId: string,
  employeeName: string,
  groupNames: string[]
): Promise<UserMenuPermissions> {
  console.log("[menu-permission] Building permissions for:", {
    employeeId,
    employeeName,
    groupNames,
  });

  // 個別権限を優先チェック
  const userPerms = await getUserPermissions(employeeId);
  console.log("[menu-permission] User permissions found:", userPerms.length);

  const result: UserMenuPermissions = {
    employee_id: employeeId,
    employee_name: employeeName,
    group_ids: groupNames,
    permitted_menus: [],
    permitted_programs: [],
    denied_menus: [],
    denied_programs: [],
    source: userPerms.length > 0 ? "user" : "group",
  };

  if (userPerms.length > 0) {
    // 個別権限が存在する場合は個別権限を使用
    console.log("[menu-permission] Using user permissions");
    for (const perm of userPerms) {
      if (perm.target_type === "menu") {
        if (perm.is_allowed) {
          result.permitted_menus.push(perm.target_id);
        } else {
          result.denied_menus.push(perm.target_id);
        }
      } else if (perm.target_type === "program") {
        if (perm.is_allowed) {
          result.permitted_programs.push(perm.target_id);
        } else {
          result.denied_programs.push(perm.target_id);
        }
      }
    }
  } else {
    // グループ権限を使用
    console.log("[menu-permission] Using group permissions for groups:", groupNames);
    const groupPerms = await getGroupPermissions(groupNames);
    console.log("[menu-permission] Group permissions loaded:", groupPerms.length);
    for (const perm of groupPerms) {
      if (perm.target_type === "menu") {
        if (perm.is_allowed) {
          result.permitted_menus.push(perm.target_id);
        } else {
          result.denied_menus.push(perm.target_id);
        }
      } else if (perm.target_type === "program") {
        if (perm.is_allowed) {
          result.permitted_programs.push(perm.target_id);
        } else {
          result.denied_programs.push(perm.target_id);
        }
      }
    }
  }

  // 重複を除去
  result.permitted_menus = [...new Set(result.permitted_menus)];
  result.permitted_programs = [...new Set(result.permitted_programs)];
  result.denied_menus = [...new Set(result.denied_menus)];
  result.denied_programs = [...new Set(result.denied_programs)];

  console.log("[menu-permission] Final permissions:", {
    permitted_menus: result.permitted_menus,
    permitted_programs: result.permitted_programs,
    source: result.source,
  });

  return result;
}

/**
 * 権限付きメニュー構造を構築
 */
export async function buildPermittedMenuStructure(
  permissions: UserMenuPermissions
): Promise<PermittedMenuStructure[]> {
  const menus = await getMenuDisplayMaster();
  const programs = await getFunctionPlacementMaster();

  console.log("[menu-permission] Building menu structure");
  console.log("[menu-permission] Total menus:", menus.length);
  console.log("[menu-permission] Total programs:", programs.length);

  // 第1階層メニューを取得
  const level1Menus = menus.filter(m => m.level === 1);
  // 第2階層メニューを取得
  const level2Menus = menus.filter(m => m.level === 2);

  console.log("[menu-permission] Level 1 menus:", level1Menus.length);
  console.log("[menu-permission] Level 2 menus:", level2Menus.length);
  console.log("[menu-permission] Sample level2 menus:", level2Menus.slice(0, 3).map(m => ({ id: m.menu_id, parent: m.parent_menu_id })));
  console.log("[menu-permission] Sample programs:", programs.slice(0, 5).map(p => ({ id: p.program_id, menu: p.menu_id })));

  const result: PermittedMenuStructure[] = [];

  // 開発環境または権限が空の場合は全メニュー表示
  const isDev = process.env.NODE_ENV === "development";
  const hasNoPermissions = permissions.permitted_menus.length === 0 && permissions.permitted_programs.length === 0;
  const showAll = isDev && hasNoPermissions;

  console.log("[menu-permission] isDev:", isDev, "hasNoPermissions:", hasNoPermissions, "showAll:", showAll);

  for (const menu1 of level1Menus) {
    // 権限チェック（開発環境で権限がない場合はスキップ）
    if (!showAll) {
      const isMenu1Permitted = permissions.permitted_menus.includes(menu1.menu_id);
      const isMenu1Denied = permissions.denied_menus.includes(menu1.menu_id);

      if (!isMenu1Permitted || isMenu1Denied) {
        continue; // 許可されていないか、明示的に拒否されている
      }
    }

    // 第2階層メニューをフィルタ
    const childMenus = level2Menus.filter(m => m.parent_menu_id === menu1.menu_id);
    const permittedChildren: { menu: MenuDisplayMaster; programs: FunctionPlacementMaster[] }[] = [];

    for (const menu2 of childMenus) {
      // 権限チェック
      if (!showAll) {
        const isMenu2Denied = permissions.denied_menus.includes(menu2.menu_id);
        if (isMenu2Denied) {
          continue;
        }
      }

      // プログラムをフィルタ
      const menuPrograms = programs.filter(p => p.menu_id === menu2.menu_id);
      const permittedPrograms = showAll
        ? menuPrograms
        : menuPrograms.filter(p => {
            return !permissions.denied_programs.includes(p.program_id);
          });

      if (permittedPrograms.length > 0) {
        permittedChildren.push({
          menu: menu2,
          programs: permittedPrograms,
        });
      } else {
        console.log("[menu-permission] No programs for menu:", menu2.menu_id, "- menuPrograms:", menuPrograms.length);
      }
    }

    console.log("[menu-permission] Menu", menu1.menu_id, "has", permittedChildren.length, "children");

    // 2階層がなくても1階層目は表示（権限があれば）
    result.push({
      menu: menu1,
      children: permittedChildren,
    });
  }

  console.log("[menu-permission] Final menu structure:", result.length, "top-level menus");
  result.forEach(m => {
    console.log("[menu-permission]  -", m.menu.menu_id, ":", m.menu.menu_name, "children:", m.children.length);
  });

  return result;
}

/**
 * 全メニュー構造を取得（管理者用）
 */
export async function getAllMenuStructure(): Promise<PermittedMenuStructure[]> {
  const menus = await getMenuDisplayMaster();
  const programs = await getFunctionPlacementMaster();

  const level1Menus = menus.filter(m => m.level === 1);
  const level2Menus = menus.filter(m => m.level === 2);

  const result: PermittedMenuStructure[] = [];

  for (const menu1 of level1Menus) {
    const childMenus = level2Menus.filter(m => m.parent_menu_id === menu1.menu_id);
    const children = childMenus.map(menu2 => ({
      menu: menu2,
      programs: programs.filter(p => p.menu_id === menu2.menu_id),
    }));

    result.push({
      menu: menu1,
      children,
    });
  }

  return result;
}
