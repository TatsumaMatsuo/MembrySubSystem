import { getBaseRecords, getLarkBaseTokenForEmployees } from "@/lib/lark-client";
import { getLarkTables, EMPLOYEE_FIELDS } from "@/lib/lark-tables";
import type { Employee } from "@/types";

/**
 * People フィールド配下の属性値を抽出
 * 例: 「社員名 (メンバー ).仕事用メールアドレス」のような派生フィールドは
 * Lark Bitable からは ["string", "string"] の配列で返ることがある
 */
function extractPeopleAttr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          return String(obj.text || obj.name || obj.value || "");
        }
        return String(v);
      })
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.text || obj.name || obj.value || "");
  }
  return String(value);
}

/**
 * 社員マスタ一覧を取得
 * 検索は Lark Bitable の FIND フィルタが People派生フィールドに対応していない
 * ケースがあるため、全件取得 → クライアント側（サーバー側JS）で部分一致を判定する。
 */
export async function getEmployees(searchTerm?: string): Promise<Employee[]> {
  const tables = getLarkTables();

  const response = await getBaseRecords(tables.EMPLOYEES, {
    pageSize: 500,
    baseToken: getLarkBaseTokenForEmployees(),
  });

  if (!response.data?.items) {
    return [];
  }

  const all = response.data.items.map((item) => {
    const deptField = item.fields?.[EMPLOYEE_FIELDS.department];
    const department = Array.isArray(deptField) ? deptField[0] : deptField;
    return {
      record_id: item.record_id || "",
      社員コード: String(item.fields?.[EMPLOYEE_FIELDS.employee_id] || ""),
      社員名: String(item.fields?.[EMPLOYEE_FIELDS.employee_name] || ""),
      メールアドレス: extractPeopleAttr(item.fields?.[EMPLOYEE_FIELDS.email]),
      部署: department ? String(department) : undefined,
    };
  });

  if (!searchTerm || !searchTerm.trim()) {
    return all;
  }

  const q = searchTerm.toLowerCase().trim();
  return all.filter((e) => {
    return (
      e.社員コード.toLowerCase().includes(q) ||
      e.社員名.toLowerCase().includes(q) ||
      e.メールアドレス.toLowerCase().includes(q) ||
      (e.部署 && e.部署.toLowerCase().includes(q))
    );
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
