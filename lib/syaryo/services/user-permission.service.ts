import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  hardDeleteBaseRecord,
} from "@/lib/syaryo/lark-client";
import { LARK_TABLES, USER_PERMISSION_FIELDS } from "@/lib/syaryo/lark-tables";
import { UserPermission, PermissionRole } from "@/types/syaryo";

/**
 * 全てのユーザー権限を取得
 */
export async function getUserPermissions(): Promise<UserPermission[]> {
  try {
    const response = await getBaseRecords(LARK_TABLES.USER_PERMISSIONS);

    if (!response.data?.items) {
      return [];
    }

    const permissions: UserPermission[] = response.data.items.map(
      (item: any) => ({
        id: item.record_id || "",
        lark_user_id: String(
          item.fields[USER_PERMISSION_FIELDS.lark_user_id] || ""
        ),
        user_name: String(item.fields[USER_PERMISSION_FIELDS.user_name] || ""),
        user_email: String(
          item.fields[USER_PERMISSION_FIELDS.user_email] || ""
        ),
        role: (item.fields[USER_PERMISSION_FIELDS.role] as PermissionRole) || "viewer",
        granted_by: String(item.fields[USER_PERMISSION_FIELDS.granted_by] || ""),
        granted_at: new Date(
          Number(item.fields[USER_PERMISSION_FIELDS.granted_at]) || Date.now()
        ),
        created_at: new Date(
          Number(item.fields[USER_PERMISSION_FIELDS.created_at]) || Date.now()
        ),
        updated_at: new Date(
          Number(item.fields[USER_PERMISSION_FIELDS.updated_at]) || Date.now()
        ),
      })
    );

    return permissions;
  } catch (error) {
    console.error("Failed to get user permissions:", error);
    return [];
  }
}

/**
 * 特定ユーザーの権限を取得
 * @param userIdentifier LarkユーザーのOpen IDまたはメールアドレス
 */
export async function getUserPermission(
  userIdentifier: string
): Promise<UserPermission | null> {
  try {
    // まずopen_idで検索
    let response = await getBaseRecords(LARK_TABLES.USER_PERMISSIONS, {
      filter: `CurrentValue.[${USER_PERMISSION_FIELDS.lark_user_id}] = "${userIdentifier}"`,
    });

    // open_idで見つからない場合はメールアドレスで検索
    if (!response.data?.items || response.data.items.length === 0) {
      response = await getBaseRecords(LARK_TABLES.USER_PERMISSIONS, {
        filter: `CurrentValue.[${USER_PERMISSION_FIELDS.user_email}] = "${userIdentifier}"`,
      });
    }

    if (!response.data?.items || response.data.items.length === 0) {
      return null;
    }

    const item = response.data.items[0];
    return {
      id: item.record_id || "",
      lark_user_id: String(
        item.fields[USER_PERMISSION_FIELDS.lark_user_id] || ""
      ),
      user_name: String(item.fields[USER_PERMISSION_FIELDS.user_name] || ""),
      user_email: String(item.fields[USER_PERMISSION_FIELDS.user_email] || ""),
      role: (item.fields[USER_PERMISSION_FIELDS.role] as PermissionRole) || "viewer",
      granted_by: String(item.fields[USER_PERMISSION_FIELDS.granted_by] || ""),
      granted_at: new Date(
        Number(item.fields[USER_PERMISSION_FIELDS.granted_at]) || Date.now()
      ),
      created_at: new Date(
        Number(item.fields[USER_PERMISSION_FIELDS.created_at]) || Date.now()
      ),
      updated_at: new Date(
        Number(item.fields[USER_PERMISSION_FIELDS.updated_at]) || Date.now()
      ),
    };
  } catch (error) {
    console.error("Failed to get user permission:", error);
    return null;
  }
}

/**
 * ユーザー権限を作成
 */
export async function createUserPermission(data: {
  lark_user_id: string;
  user_name: string;
  user_email: string;
  role: PermissionRole;
  granted_by: string;
}): Promise<UserPermission> {
  const now = new Date();

  const fields = {
    [USER_PERMISSION_FIELDS.lark_user_id]: data.lark_user_id,
    [USER_PERMISSION_FIELDS.user_name]: data.user_name,
    [USER_PERMISSION_FIELDS.user_email]: data.user_email,
    [USER_PERMISSION_FIELDS.role]: data.role,
    [USER_PERMISSION_FIELDS.granted_by]: data.granted_by,
    [USER_PERMISSION_FIELDS.granted_at]: now.getTime(),
    [USER_PERMISSION_FIELDS.created_at]: now.getTime(),
    [USER_PERMISSION_FIELDS.updated_at]: now.getTime(),
  };

  const response = await createBaseRecord(LARK_TABLES.USER_PERMISSIONS, fields);

  return {
    id: response.data?.record?.record_id || "",
    lark_user_id: data.lark_user_id,
    user_name: data.user_name,
    user_email: data.user_email,
    role: data.role,
    granted_by: data.granted_by,
    granted_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * ユーザー権限を更新
 */
export async function updateUserPermission(
  id: string,
  data: {
    role?: PermissionRole;
  }
): Promise<void> {
  const fields: any = {
    [USER_PERMISSION_FIELDS.updated_at]: Date.now(),
  };

  if (data.role) {
    fields[USER_PERMISSION_FIELDS.role] = data.role;
  }

  await updateBaseRecord(LARK_TABLES.USER_PERMISSIONS, id, fields);
}

/**
 * ユーザー権限を削除（物理削除）
 */
export async function deleteUserPermission(id: string): Promise<void> {
  console.log('DEBUG deleteUserPermission - id:', id);
  await hardDeleteBaseRecord(LARK_TABLES.USER_PERMISSIONS, id);
  console.log('DEBUG deleteUserPermission - deleted successfully');
}

/**
 * ユーザーが管理者権限を持っているかチェック
 */
export async function isAdmin(larkUserId: string): Promise<boolean> {
  const permission = await getUserPermission(larkUserId);
  return permission?.role === "admin";
}

/**
 * ユーザーが閲覧権限以上を持っているかチェック
 */
export async function hasViewPermission(larkUserId: string): Promise<boolean> {
  const permission = await getUserPermission(larkUserId);
  return permission !== null;
}
