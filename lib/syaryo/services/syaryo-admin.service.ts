/**
 * 車両管理システムの管理者ユーザを取得するサービス
 *
 * 管理者 = MS_SYS 機能配置マスタの PGM031（車両管理-管理者操作）が
 * 許可されているユーザ。グループ権限と個別権限をマージして判定する。
 */
import { getBaseRecords, getLarkBaseTokenForEmployees } from "@/lib/lark-client";
import {
  getLarkTables,
  EMPLOYEE_FIELDS,
  getLarkBaseTokenMaster,
} from "@/lib/lark-tables";

const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";
const TABLE_USER_PERMISSION = process.env.LARK_TABLE_USER_PERMISSION || "tbl2hvSUkEe3fn7t";

const PGM_SYARYO_ADMIN = "PGM031";

export interface SyaryoAdmin {
  employeeId: string;
  employeeName: string;
  email: string | null;
  openId: string | null;
  department: string;
}

function extractTextValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(x => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

/**
 * 車両管理システムの管理者一覧を取得
 *
 * 判定ロジック:
 * 1. PGM031 の グループ権限 (target_type=program, target_id=PGM031)
 *    → allowedGroupNames / deniedGroupNames
 * 2. PGM031 の 個別権限
 *    → allowedEmployeeIds / deniedEmployeeIds
 * 3. 各社員について「グループで許可かつグループで拒否されておらず、個別拒否もない」or
 *    「個別許可」をadmin と判定（個別が優先）
 */
export async function getSyaryoAdmins(): Promise<SyaryoAdmin[]> {
  const masterBaseToken = getLarkBaseTokenMaster();

  // Step 1: PGM031 グループ権限を取得
  const groupResp = await getBaseRecords(TABLE_GROUP_PERMISSION, {
    baseToken: masterBaseToken,
    filter: `AND(CurrentValue.[対象種別] = "program", CurrentValue.[対象ID] = "${PGM_SYARYO_ADMIN}")`,
    pageSize: 500,
  });

  const allowedGroupNames = new Set<string>();
  const deniedGroupNames = new Set<string>();
  for (const item of groupResp.data?.items || []) {
    const groupName = extractTextValue(item.fields?.["グループ名"]);
    const allowed = item.fields?.["許可フラグ"] === true || item.fields?.["許可フラグ"] === 1;
    if (groupName) {
      if (allowed) allowedGroupNames.add(groupName);
      else deniedGroupNames.add(groupName);
    }
  }

  // Step 2: PGM031 個別権限を取得
  const userResp = await getBaseRecords(TABLE_USER_PERMISSION, {
    baseToken: masterBaseToken,
    filter: `AND(CurrentValue.[対象種別] = "program", CurrentValue.[対象ID] = "${PGM_SYARYO_ADMIN}")`,
    pageSize: 500,
  });

  const allowedEmployeeIds = new Set<string>();
  const deniedEmployeeIds = new Set<string>();
  for (const item of userResp.data?.items || []) {
    const empId = extractTextValue(item.fields?.["社員ID"]);
    const allowed = item.fields?.["許可フラグ"] === true || item.fields?.["許可フラグ"] === 1;
    if (empId) {
      if (allowed) allowedEmployeeIds.add(empId);
      else deniedEmployeeIds.add(empId);
    }
  }

  // Step 3: 全社員を取得して admin 判定
  const tables = getLarkTables();
  const empResp = await getBaseRecords(tables.EMPLOYEES, {
    baseToken: getLarkBaseTokenForEmployees(),
    pageSize: 500,
  });

  const admins: SyaryoAdmin[] = [];
  for (const item of empResp.data?.items || []) {
    const empId = String(item.fields?.[EMPLOYEE_FIELDS.employee_id] || "");
    if (!empId) continue;

    // 部署
    const deptField = item.fields?.[EMPLOYEE_FIELDS.department];
    const department = Array.isArray(deptField)
      ? String(deptField[0] || "")
      : String(deptField || "");

    // admin 判定: グループでallow→admin、個別が優先で上書き
    let isAdmin = allowedGroupNames.has(department) && !deniedGroupNames.has(department);
    if (allowedEmployeeIds.has(empId)) isAdmin = true;
    if (deniedEmployeeIds.has(empId)) isAdmin = false;

    if (!isAdmin) continue;

    // 通知先 (open_id / email) を抽出
    const memberField = item.fields?.[EMPLOYEE_FIELDS.member];
    let openId: string | null = null;
    let email: string | null = null;
    if (Array.isArray(memberField)) {
      for (const m of memberField) {
        if (m && typeof m === "object") {
          const obj = m as Record<string, unknown>;
          if (!openId && typeof obj.id === "string") openId = obj.id;
          if (!email && typeof obj.email === "string") email = obj.email;
        }
      }
    }

    const employeeName = String(item.fields?.[EMPLOYEE_FIELDS.employee_name] || "");

    admins.push({
      employeeId: empId,
      employeeName,
      email,
      openId,
      department,
    });
  }

  return admins;
}
