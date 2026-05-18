import {
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
} from "@/lib/syaryo/lark-client";
import { LARK_TABLES, EMPLOYEE_FIELDS, USER_SEARCH_TABLE_ID, EMPLOYEE_MASTER_FIELDS } from "@/lib/syaryo/lark-tables";
import { Employee, EmploymentStatus, MembershipType } from "@/types/syaryo";

/**
 * Peopleフィールドから名前を抽出
 */
function extractNameFromPeopleField(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field) && field[0]?.name) return field[0].name;
  if (typeof field === "object" && field.name) return field.name;
  return String(field);
}

/**
 * Peopleフィールドからメールを抽出
 */
function extractEmailFromPeopleField(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field) && field[0]?.email) return field[0].email;
  if (typeof field === "object" && field.email) return field.email;
  return "";
}

/**
 * 全ての社員を取得（社員マスタテーブルから）
 */
export async function getEmployees(
  includeResigned: boolean = false
): Promise<Employee[]> {
  try {
    // 退職者フラグでフィルタリング
    const filter = includeResigned
      ? undefined
      : `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.resigned_flag}] != true`;

    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter,
      pageSize: 500,
    });

    if (!response.data?.items) {
      return [];
    }

    const employees: Employee[] = response.data.items.map((item: any) => {
      // 社員名（直接フィールドまたはPeopleフィールドから取得）
      const directName = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
      const peopleName = extractNameFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
      const employeeName = directName || peopleName || "";

      // メール（Peopleフィールドまたは直接フィールドから取得）
      const peopleEmail = extractEmailFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
      const directEmail = item.fields[EMPLOYEE_MASTER_FIELDS.email];
      const email = peopleEmail || directEmail || "";

      // 部署
      const department = item.fields[EMPLOYEE_MASTER_FIELDS.department];
      const departmentStr = Array.isArray(department) ? department[0] || "" : String(department || "");

      // 退職フラグ
      const isResigned = item.fields[EMPLOYEE_MASTER_FIELDS.resigned_flag] === true;

      return {
        employee_id: String(item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || ""),
        employee_name: employeeName,
        email: email,
        department: departmentStr,
        role: "applicant" as any,
        membership_type: (item.fields[EMPLOYEE_FIELDS.membership_type] || "internal") as MembershipType,
        employment_status: (isResigned ? "resigned" : "active") as EmploymentStatus,
        hire_date: new Date(),
        resignation_date: undefined,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    return employees;
  } catch (error) {
    console.error("Failed to get employees:", error);
    return [];
  }
}

/**
 * メールアドレスから社員を取得（社員マスタテーブルから）
 */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  try {
    // 全社員を取得してメールアドレスで検索
    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      pageSize: 500,
    });

    if (!response.data?.items) {
      return null;
    }

    // メールアドレスで検索
    const normalizedEmail = email.toLowerCase().trim();
    const item = response.data.items.find((item: any) => {
      const peopleEmail = extractEmailFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
      const directEmail = item.fields[EMPLOYEE_MASTER_FIELDS.email] || "";
      const itemEmail = peopleEmail || directEmail;
      return itemEmail.toLowerCase().trim() === normalizedEmail;
    });

    if (!item) {
      console.log(`Employee not found for email: ${email}`);
      return null;
    }

    // 社員名（直接フィールドまたはPeopleフィールドから取得）
    const directName = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
    const peopleName = extractNameFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
    const employeeName = String(directName || peopleName || "");

    // メール
    const peopleEmail = extractEmailFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
    const directEmail = item.fields[EMPLOYEE_MASTER_FIELDS.email];
    const employeeEmail = String(peopleEmail || directEmail || "");

    // 部署
    const department = item.fields[EMPLOYEE_MASTER_FIELDS.department];
    const departmentVal = Array.isArray(department) ? department[0] : department;
    const departmentStr = typeof departmentVal === "string" ? departmentVal : String(departmentVal || "");

    // 退職フラグ
    const isResigned = item.fields[EMPLOYEE_MASTER_FIELDS.resigned_flag] === true;

    return {
      employee_id: String(item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || ""),
      employee_name: employeeName,
      email: employeeEmail,
      department: departmentStr,
      role: "applicant" as any,
      membership_type: (item.fields[EMPLOYEE_FIELDS.membership_type] || "internal") as MembershipType,
      employment_status: (isResigned ? "resigned" : "active") as EmploymentStatus,
      hire_date: new Date(),
      resignation_date: undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error) {
    console.error("Failed to get employee by email:", error);
    return null;
  }
}

/**
 * 特定の社員を取得（社員マスタテーブルから）
 */
export async function getEmployee(employeeId: string): Promise<Employee | null> {
  try {
    const filter = `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}] = "${employeeId}"`;

    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter,
    });

    if (!response.data?.items || response.data.items.length === 0) {
      return null;
    }

    const item = response.data.items[0];

    // 社員名（直接フィールドまたはPeopleフィールドから取得）
    const directName = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
    const peopleName = extractNameFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
    const employeeName = String(directName || peopleName || "");

    // メール
    const peopleEmail = extractEmailFromPeopleField(item.fields[EMPLOYEE_MASTER_FIELDS.people_field]);
    const directEmail = item.fields[EMPLOYEE_MASTER_FIELDS.email];
    const emailStr = String(peopleEmail || directEmail || "");

    // 部署
    const department = item.fields[EMPLOYEE_MASTER_FIELDS.department];
    const departmentVal = Array.isArray(department) ? department[0] : department;
    const departmentStr = typeof departmentVal === "string" ? departmentVal : String(departmentVal || "");

    // 退職フラグ
    const isResigned = item.fields[EMPLOYEE_MASTER_FIELDS.resigned_flag] === true;

    return {
      employee_id: String(item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || ""),
      employee_name: employeeName,
      email: emailStr,
      department: departmentStr,
      role: "applicant" as any,
      membership_type: (item.fields[EMPLOYEE_FIELDS.membership_type] || "internal") as MembershipType,
      employment_status: (isResigned ? "resigned" : "active") as EmploymentStatus,
      hire_date: new Date(),
      resignation_date: undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error) {
    console.error("Failed to get employee:", error);
    return null;
  }
}

/**
 * 社員を退職させる（退職者フラグを設定）
 */
export async function retireEmployee(
  employeeId: string,
  resignationDate?: Date
): Promise<void> {
  try {
    const filter = `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}] = "${employeeId}"`;

    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter,
    });

    if (!response.data?.items || response.data.items.length === 0) {
      throw new Error("Employee not found");
    }

    const recordId = response.data.items[0].record_id || "";
    const actualResignationDate = resignationDate || new Date();

    await updateBaseRecord(USER_SEARCH_TABLE_ID, recordId, {
      [EMPLOYEE_MASTER_FIELDS.resigned_flag]: true,
    });

    console.log(`Employee ${employeeId} retired on ${actualResignationDate}`);
  } catch (error) {
    console.error("Failed to retire employee:", error);
    throw error;
  }
}

/**
 * 社員の退職に伴い、関連書類を論理削除
 */
export async function softDeleteEmployeeDocuments(
  employeeId: string
): Promise<{
  licensesDeleted: number;
  vehiclesDeleted: number;
  insurancesDeleted: number;
}> {
  try {
    const deleteFilter = `AND(
      CurrentValue.[employee_id] = "${employeeId}",
      CurrentValue.[deleted_flag] = false
    )`;

    // 3つのテーブルから並列でデータ取得
    const [licensesResponse, vehiclesResponse, insurancesResponse] =
      await Promise.all([
        getBaseRecords(LARK_TABLES.DRIVERS_LICENSES, { filter: deleteFilter }),
        getBaseRecords(LARK_TABLES.VEHICLE_REGISTRATIONS, { filter: deleteFilter }),
        getBaseRecords(LARK_TABLES.INSURANCE_POLICIES, { filter: deleteFilter }),
      ]);

    const now = Date.now();
    const deleteData = {
      deleted_flag: true,
      deleted_at: now,
      updated_at: now,
    };

    // 全ての更新処理を並列で実行
    const updatePromises: Promise<any>[] = [];

    // 免許証の論理削除
    const licenseItems = licensesResponse.data?.items || [];
    for (const item of licenseItems) {
      updatePromises.push(
        updateBaseRecord(LARK_TABLES.DRIVERS_LICENSES, item.record_id || "", deleteData)
      );
    }

    // 車検証の論理削除
    const vehicleItems = vehiclesResponse.data?.items || [];
    for (const item of vehicleItems) {
      updatePromises.push(
        updateBaseRecord(LARK_TABLES.VEHICLE_REGISTRATIONS, item.record_id || "", deleteData)
      );
    }

    // 任意保険の論理削除
    const insuranceItems = insurancesResponse.data?.items || [];
    for (const item of insuranceItems) {
      updatePromises.push(
        updateBaseRecord(LARK_TABLES.INSURANCE_POLICIES, item.record_id || "", deleteData)
      );
    }

    // 全ての更新を並列実行
    await Promise.all(updatePromises);

    const licensesDeleted = licenseItems.length;
    const vehiclesDeleted = vehicleItems.length;
    const insurancesDeleted = insuranceItems.length;

    console.log(
      `Soft deleted documents for employee ${employeeId}: ${licensesDeleted} licenses, ${vehiclesDeleted} vehicles, ${insurancesDeleted} insurances`
    );

    return { licensesDeleted, vehiclesDeleted, insurancesDeleted };
  } catch (error) {
    console.error("Failed to soft delete employee documents:", error);
    throw error;
  }
}

/**
 * 社員を退職させ、関連書類も論理削除
 */
export async function retireEmployeeWithDocuments(
  employeeId: string,
  resignationDate?: Date
): Promise<{
  employee: boolean;
  documents: {
    licensesDeleted: number;
    vehiclesDeleted: number;
    insurancesDeleted: number;
  };
}> {
  try {
    // 社員を退職状態にする
    await retireEmployee(employeeId, resignationDate);

    // 関連書類を論理削除
    const documents = await softDeleteEmployeeDocuments(employeeId);

    return {
      employee: true,
      documents,
    };
  } catch (error) {
    console.error("Failed to retire employee with documents:", error);
    throw error;
  }
}

/**
 * 社員を復職させる（退職者フラグを解除）
 */
export async function reactivateEmployee(employeeId: string): Promise<void> {
  try {
    const filter = `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}] = "${employeeId}"`;

    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter,
    });

    if (!response.data?.items || response.data.items.length === 0) {
      throw new Error("Employee not found");
    }

    const recordId = response.data.items[0].record_id || "";

    await updateBaseRecord(USER_SEARCH_TABLE_ID, recordId, {
      [EMPLOYEE_MASTER_FIELDS.resigned_flag]: false,
    });

    console.log(`Employee ${employeeId} reactivated`);
  } catch (error) {
    console.error("Failed to reactivate employee:", error);
    throw error;
  }
}
