import { getBaseRecords, createBaseRecord, updateBaseRecord, getLarkBaseTokenForMaster } from "@/lib/lark-client";
import {
  getLarkTables,
  FEATURE_MASTER_FIELDS,
  USER_PERMISSION_FIELDS,
  ROLE_MASTER_FIELDS,
  ROLE_PERMISSION_FIELDS,
  USER_ROLE_FIELDS,
} from "@/lib/lark-tables";
import type {
  FeatureMaster,
  UserPermission,
  RoleMaster,
  RolePermission,
  UserRole,
  PermissionLevel,
  PermissionCheckResult,
} from "@/types";

/**
 * 機能マスタ一覧を取得
 */
export async function getFeatures(): Promise<FeatureMaster[]> {
  const tables = getLarkTables();
  const response = await getBaseRecords(tables.FEATURE_MASTER, {
    pageSize: 500,
    baseToken: getLarkBaseTokenForMaster(),
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    機能ID: String(item.fields?.[FEATURE_MASTER_FIELDS.feature_id] || ""),
    機能名: String(item.fields?.[FEATURE_MASTER_FIELDS.feature_name] || ""),
    所属メニューグループ: item.fields?.[FEATURE_MASTER_FIELDS.menu_group] as any,
    機能タイプ: item.fields?.[FEATURE_MASTER_FIELDS.feature_type] as any,
    親機能ID: item.fields?.[FEATURE_MASTER_FIELDS.parent_feature_id]
      ? String(item.fields[FEATURE_MASTER_FIELDS.parent_feature_id])
      : undefined,
    表示順: Number(item.fields?.[FEATURE_MASTER_FIELDS.sort_order] || 0),
    機能説明: item.fields?.[FEATURE_MASTER_FIELDS.description]
      ? String(item.fields[FEATURE_MASTER_FIELDS.description])
      : undefined,
    有効フラグ: Boolean(item.fields?.[FEATURE_MASTER_FIELDS.is_active]),
  }));
}

/**
 * 機能マスタを作成
 */
export async function createFeature(feature: Omit<FeatureMaster, "record_id">): Promise<FeatureMaster> {
  const tables = getLarkTables();
  const fields = {
    [FEATURE_MASTER_FIELDS.feature_id]: feature.機能ID,
    [FEATURE_MASTER_FIELDS.feature_name]: feature.機能名,
    [FEATURE_MASTER_FIELDS.menu_group]: feature.所属メニューグループ,
    [FEATURE_MASTER_FIELDS.feature_type]: feature.機能タイプ,
    [FEATURE_MASTER_FIELDS.parent_feature_id]: feature.親機能ID,
    [FEATURE_MASTER_FIELDS.sort_order]: feature.表示順,
    [FEATURE_MASTER_FIELDS.description]: feature.機能説明,
    [FEATURE_MASTER_FIELDS.is_active]: feature.有効フラグ,
  };

  const response = await createBaseRecord(tables.FEATURE_MASTER, fields);
  return {
    record_id: response.data?.record?.record_id || "",
    ...feature,
  };
}

/**
 * ロールマスタ一覧を取得
 */
export async function getRoles(): Promise<RoleMaster[]> {
  const tables = getLarkTables();
  const response = await getBaseRecords(tables.ROLE_MASTER, {
    pageSize: 100,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    ロールID: String(item.fields?.[ROLE_MASTER_FIELDS.role_id] || ""),
    ロール名: String(item.fields?.[ROLE_MASTER_FIELDS.role_name] || ""),
    説明: item.fields?.[ROLE_MASTER_FIELDS.description]
      ? String(item.fields[ROLE_MASTER_FIELDS.description])
      : undefined,
    有効フラグ: Boolean(item.fields?.[ROLE_MASTER_FIELDS.is_active]),
  }));
}

/**
 * ロールマスタを作成
 */
export async function createRole(role: Omit<RoleMaster, "record_id">): Promise<RoleMaster> {
  const tables = getLarkTables();
  const fields = {
    [ROLE_MASTER_FIELDS.role_id]: role.ロールID,
    [ROLE_MASTER_FIELDS.role_name]: role.ロール名,
    [ROLE_MASTER_FIELDS.description]: role.説明,
    [ROLE_MASTER_FIELDS.is_active]: role.有効フラグ,
  };

  const response = await createBaseRecord(tables.ROLE_MASTER, fields);
  return {
    record_id: response.data?.record?.record_id || "",
    ...role,
  };
}

/**
 * ユーザー権限一覧を取得
 */
export async function getUserPermissions(userEmail?: string): Promise<UserPermission[]> {
  const tables = getLarkTables();
  let filter: string | undefined;

  if (userEmail) {
    filter = `CurrentValue.[${USER_PERMISSION_FIELDS.user_email}] = "${userEmail}"`;
  }

  const response = await getBaseRecords(tables.USER_PERMISSIONS, {
    filter,
    pageSize: 500,
    baseToken: getLarkBaseTokenForMaster(),
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    権限ID: item.fields?.[USER_PERMISSION_FIELDS.permission_id]
      ? String(item.fields[USER_PERMISSION_FIELDS.permission_id])
      : undefined,
    ユーザーメール: String(item.fields?.[USER_PERMISSION_FIELDS.user_email] || ""),
    ユーザー名: String(item.fields?.[USER_PERMISSION_FIELDS.user_name] || ""),
    対象機能: item.fields?.[USER_PERMISSION_FIELDS.feature_id] as string[] || [],
    権限レベル: mapPermissionLevel(item.fields?.[USER_PERMISSION_FIELDS.permission_level]),
    付与者: item.fields?.[USER_PERMISSION_FIELDS.granted_by]
      ? String(item.fields[USER_PERMISSION_FIELDS.granted_by])
      : undefined,
    付与日時: item.fields?.[USER_PERMISSION_FIELDS.granted_at] as number | undefined,
    有効期限: item.fields?.[USER_PERMISSION_FIELDS.expires_at] as number | undefined,
    備考: item.fields?.[USER_PERMISSION_FIELDS.notes]
      ? String(item.fields[USER_PERMISSION_FIELDS.notes])
      : undefined,
  }));
}

/**
 * ユーザー権限を作成
 */
export async function createUserPermission(
  permission: Omit<UserPermission, "record_id" | "権限ID">
): Promise<UserPermission> {
  const tables = getLarkTables();
  // 対象機能を配列からカンマ区切り文字列に変換
  const featureIdStr = Array.isArray(permission.対象機能)
    ? permission.対象機能.join(",")
    : permission.対象機能;

  const fields = {
    [USER_PERMISSION_FIELDS.user_email]: permission.ユーザーメール,
    [USER_PERMISSION_FIELDS.user_name]: permission.ユーザー名,
    [USER_PERMISSION_FIELDS.feature_id]: featureIdStr,
    [USER_PERMISSION_FIELDS.permission_level]: mapPermissionLevelToJapanese(permission.権限レベル),
    [USER_PERMISSION_FIELDS.granted_by]: permission.付与者,
    [USER_PERMISSION_FIELDS.granted_at]: permission.付与日時 || Date.now(),
    [USER_PERMISSION_FIELDS.expires_at]: permission.有効期限,
    [USER_PERMISSION_FIELDS.notes]: permission.備考,
  };

  const response = await createBaseRecord(tables.USER_PERMISSIONS, fields, getLarkBaseTokenForMaster());
  return {
    record_id: response.data?.record?.record_id || "",
    ...permission,
  };
}

/**
 * ユーザー権限を更新
 */
export async function updateUserPermission(
  recordId: string,
  permission: Partial<UserPermission>
): Promise<void> {
  const tables = getLarkTables();
  const fields: Record<string, any> = {};

  if (permission.ユーザーメール) fields[USER_PERMISSION_FIELDS.user_email] = permission.ユーザーメール;
  if (permission.ユーザー名) fields[USER_PERMISSION_FIELDS.user_name] = permission.ユーザー名;
  if (permission.対象機能) fields[USER_PERMISSION_FIELDS.feature_id] = permission.対象機能;
  if (permission.権限レベル) fields[USER_PERMISSION_FIELDS.permission_level] = mapPermissionLevelToJapanese(permission.権限レベル);
  if (permission.付与者) fields[USER_PERMISSION_FIELDS.granted_by] = permission.付与者;
  if (permission.有効期限) fields[USER_PERMISSION_FIELDS.expires_at] = permission.有効期限;
  if (permission.備考 !== undefined) fields[USER_PERMISSION_FIELDS.notes] = permission.備考;

  await updateBaseRecord(tables.USER_PERMISSIONS, recordId, fields);
}

/**
 * ロール権限一覧を取得
 */
export async function getRolePermissions(): Promise<RolePermission[]> {
  const tables = getLarkTables();
  const response = await getBaseRecords(tables.ROLE_PERMISSIONS, {
    pageSize: 500,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    ロール: item.fields?.[ROLE_PERMISSION_FIELDS.role_id] as string[] || [],
    対象機能: item.fields?.[ROLE_PERMISSION_FIELDS.feature_id] as string[] || [],
    権限レベル: mapPermissionLevel(item.fields?.[ROLE_PERMISSION_FIELDS.permission_level]),
  }));
}

/**
 * ユーザーロール一覧を取得
 */
export async function getUserRoles(userEmail?: string): Promise<UserRole[]> {
  const tables = getLarkTables();
  let filter: string | undefined;

  if (userEmail) {
    filter = `CurrentValue.[${USER_ROLE_FIELDS.user_email}] = "${userEmail}"`;
  }

  const response = await getBaseRecords(tables.USER_ROLES, {
    filter,
    pageSize: 500,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    ユーザーメール: String(item.fields?.[USER_ROLE_FIELDS.user_email] || ""),
    割当ロール: item.fields?.[USER_ROLE_FIELDS.role_id] as string[] || [],
    割当日: item.fields?.[USER_ROLE_FIELDS.assigned_at] as number | undefined,
  }));
}

/**
 * ユーザーの機能に対する権限をチェック
 */
export async function checkPermission(
  userEmail: string,
  featureId: string
): Promise<PermissionCheckResult> {
  // 1. ユーザー個別権限をチェック
  const userPermissions = await getUserPermissions(userEmail);
  const directPermission = userPermissions.find(
    (p) => p.対象機能.includes(featureId) && (!p.有効期限 || p.有効期限 > Date.now())
  );

  if (directPermission) {
    return createPermissionResult(featureId, directPermission.権限レベル);
  }

  // 2. ロールベースの権限をチェック
  const userRoles = await getUserRoles(userEmail);
  if (userRoles.length > 0) {
    const rolePermissions = await getRolePermissions();
    for (const userRole of userRoles) {
      for (const roleId of userRole.割当ロール) {
        const rolePermission = rolePermissions.find(
          (rp) => rp.ロール.includes(roleId) && rp.対象機能.includes(featureId)
        );
        if (rolePermission) {
          return createPermissionResult(featureId, rolePermission.権限レベル);
        }
      }
    }
  }

  // 3. デフォルト権限（編集可能）
  return createPermissionResult(featureId, "edit");
}

/**
 * ユーザーの全機能に対する権限を取得
 */
export async function getAllPermissionsForUser(
  userEmail: string
): Promise<PermissionCheckResult[]> {
  const features = await getFeatures();
  const results: PermissionCheckResult[] = [];

  for (const feature of features) {
    if (feature.有効フラグ) {
      const permission = await checkPermission(userEmail, feature.機能ID);
      results.push(permission);
    }
  }

  return results;
}

// Helper functions
function mapPermissionLevel(value: any): PermissionLevel {
  if (typeof value === "string") {
    if (value === "編集" || value === "edit") return "edit";
    if (value === "表示のみ" || value === "view") return "view";
    if (value === "非表示" || value === "hidden") return "hidden";
  }
  return "edit"; // default
}

function mapPermissionLevelToJapanese(level: PermissionLevel): string {
  switch (level) {
    case "edit":
      return "編集";
    case "view":
      return "表示のみ";
    case "hidden":
      return "非表示";
  }
}

function createPermissionResult(
  featureId: string,
  level: PermissionLevel
): PermissionCheckResult {
  return {
    featureId,
    level,
    canEdit: level === "edit",
    canView: level === "edit" || level === "view",
    isHidden: level === "hidden",
  };
}
