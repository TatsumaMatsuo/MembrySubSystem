import { getBaseRecords, getLarkBaseTokenForEmployees } from "@/lib/lark-client";
import { getLarkTables, EMPLOYEE_FIELDS } from "@/lib/lark-tables";
import type { Employee } from "@/types";

/**
 * 社員マスタ一覧を取得
 */
export async function getEmployees(searchTerm?: string): Promise<Employee[]> {
  const tables = getLarkTables();
  let filter: string | undefined;

  if (searchTerm) {
    filter = `OR(FIND("${searchTerm}", CurrentValue.[${EMPLOYEE_FIELDS.employee_name}]) > 0, FIND("${searchTerm}", CurrentValue.[${EMPLOYEE_FIELDS.email}]) > 0)`;
  }

  const response = await getBaseRecords(tables.EMPLOYEES, {
    filter,
    pageSize: 500,
    baseToken: getLarkBaseTokenForEmployees(),
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => {
    const deptField = item.fields?.[EMPLOYEE_FIELDS.department];
    const department = Array.isArray(deptField) ? deptField[0] : deptField;
    return {
      record_id: item.record_id || "",
      社員コード: String(item.fields?.[EMPLOYEE_FIELDS.employee_id] || ""),
      社員名: String(item.fields?.[EMPLOYEE_FIELDS.employee_name] || ""),
      メールアドレス: String(item.fields?.[EMPLOYEE_FIELDS.email] || ""),
      部署: department ? String(department) : undefined,
    };
  });
}

/**
 * メールアドレスで社員を取得
 */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${EMPLOYEE_FIELDS.email}] = "${email}"`;

  const response = await getBaseRecords(tables.EMPLOYEES, {
    filter,
    pageSize: 1,
    baseToken: getLarkBaseTokenForEmployees(),
  });

  if (!response.data?.items || response.data.items.length === 0) {
    return null;
  }

  const item = response.data.items[0];
  const deptField = item.fields?.[EMPLOYEE_FIELDS.department];
  const department = Array.isArray(deptField) ? deptField[0] : deptField;
  return {
    record_id: item.record_id || "",
    社員コード: String(item.fields?.[EMPLOYEE_FIELDS.employee_id] || ""),
    社員名: String(item.fields?.[EMPLOYEE_FIELDS.employee_name] || ""),
    メールアドレス: String(item.fields?.[EMPLOYEE_FIELDS.email] || ""),
    部署: department ? String(department) : undefined,
  };
}
