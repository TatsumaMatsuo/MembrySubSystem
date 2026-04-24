import { larkClient, getBaseRecords } from "@/lib/syaryo/lark-client";
import { LARK_TABLES, EMPLOYEE_FIELDS, USER_SEARCH_TABLE_ID, EMPLOYEE_MASTER_FIELDS } from "@/lib/syaryo/lark-tables";
import { LarkUser } from "@/types/syaryo";

/**
 * Larkユーザーを検索する
 * @param query 検索クエリ（名前またはメールアドレス）
 * @returns マッチしたユーザーのリスト
 */
export async function searchLarkUsers(query: string): Promise<LarkUser[]> {
  try {
    console.log('DEBUG searchLarkUsers - query:', query);

    if (!query || query.trim().length < 2) {
      console.log('DEBUG searchLarkUsers - query too short');
      return [];
    }

    // ユーザ検索専用テーブルから検索（全社員を取得するためpageSizeを500に設定）
    console.log('DEBUG searchLarkUsers - searching from user search table:', USER_SEARCH_TABLE_ID);
    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      pageSize: 500,
    });

    console.log('DEBUG searchLarkUsers - Employee records count:', response.data?.items?.length || 0);

    // デバッグ: 最初のレコードのフィールド構造を出力
    if (response.data?.items?.[0]) {
      console.log('DEBUG searchLarkUsers - Sample record fields:', JSON.stringify(response.data.items[0].fields, null, 2));
    }

    if (!response.data?.items) {
      console.log('DEBUG searchLarkUsers - No employee data');
      return [];
    }

    // クエリでフィルタリング
    const queryLower = query.toLowerCase();
    const filteredUsers = response.data.items.filter((item: any) => {
      // フィールド名で取得
      const nameField = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
      let name = "";
      if (typeof nameField === "string") {
        name = nameField.toLowerCase();
      } else if (Array.isArray(nameField) && nameField[0]?.name) {
        name = (nameField[0].name || "").toLowerCase();
      } else if (nameField && typeof nameField === "object" && nameField.name) {
        name = (nameField.name || "").toLowerCase();
      }

      // メールアドレスの取得
      let email = "";
      const emailField = item.fields[EMPLOYEE_MASTER_FIELDS.email];
      if (typeof emailField === "string") {
        email = emailField.toLowerCase();
      } else if (Array.isArray(emailField) && emailField[0]) {
        email = String(emailField[0]).toLowerCase();
      }

      const employeeId = String(item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || "").toLowerCase();

      const matches = (
        name.includes(queryLower) ||
        email.includes(queryLower) ||
        employeeId.includes(queryLower)
      );

      return matches;
    });

    console.log('DEBUG searchLarkUsers - Filtered count:', filteredUsers.length);

    // LarkUser型に変換
    const users: LarkUser[] = filteredUsers.map((item: any) => {
      // 社員名の抽出
      const nameField = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
      let extractedName = "";
      if (typeof nameField === "string") {
        extractedName = nameField;
      } else if (Array.isArray(nameField) && nameField[0]?.name) {
        extractedName = nameField[0].name || "";
      } else if (nameField && typeof nameField === "object" && nameField.name) {
        extractedName = nameField.name || "";
      }

      // メールの抽出
      let extractedEmail = "";
      const emailField = item.fields[EMPLOYEE_MASTER_FIELDS.email];
      if (typeof emailField === "string") {
        extractedEmail = emailField;
      } else if (Array.isArray(emailField) && emailField[0]) {
        extractedEmail = String(emailField[0]);
      }

      return {
        open_id: item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || item.record_id,
        union_id: undefined,
        user_id: item.fields[EMPLOYEE_MASTER_FIELDS.employee_id],
        name: extractedName,
        en_name: undefined,
        email: extractedEmail,
        mobile: undefined,
        avatar: undefined,
        department_ids: undefined,
      };
    });

    console.log('DEBUG searchLarkUsers - Returning users:', users.length);

    return users;
  } catch (error) {
    console.error("Failed to search Lark users:", error);
    return [];
  }
}

/**
 * 特定のLarkユーザー情報を取得
 * @param openId ユーザーのopen_id
 * @returns ユーザー情報
 */
export async function getLarkUser(openId: string): Promise<LarkUser | null> {
  try {
    const response = await larkClient.contact.user.get({
      path: {
        user_id: openId,
      },
      params: {
        user_id_type: "open_id",
      },
    });

    if (!response.data?.user) {
      return null;
    }

    const user = response.data.user;
    return {
      open_id: user.open_id || "",
      union_id: user.union_id,
      user_id: user.user_id,
      name: user.name || "",
      en_name: user.en_name,
      email: user.email || "",
      mobile: user.mobile,
      avatar: user.avatar,
      department_ids: user.department_ids,
    };
  } catch (error) {
    console.error("Failed to get Lark user:", error);
    return null;
  }
}

/**
 * 現在のユーザー情報を取得（アクセストークンから）
 * @param accessToken ユーザーアクセストークン
 * @returns ユーザー情報
 */
export async function getCurrentLarkUser(
  accessToken: string
): Promise<LarkUser | null> {
  try {
    // TODO: アクセストークンを使用してユーザー情報を取得
    // 現在はモック実装
    return null;
  } catch (error) {
    console.error("Failed to get current Lark user:", error);
    return null;
  }
}

/**
 * 社員IDからLark Open IDを取得
 * @param employeeId 社員ID
 * @returns Lark Open ID（取得できない場合はnull）
 */
export async function getLarkOpenIdByEmployeeId(employeeId: string): Promise<string | null> {
  try {
    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter: `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}]="${employeeId}"`,
    });

    const employee = response.data?.items?.[0];
    if (!employee) {
      console.log(`Employee not found for ID: ${employeeId}`);
      return null;
    }

    // Peopleフィールドからopen_idを取得
    const nameField = employee.fields[EMPLOYEE_MASTER_FIELDS.employee_name] as unknown;

    if (Array.isArray(nameField) && nameField.length > 0) {
      const firstItem = nameField[0] as Record<string, unknown>;
      if (firstItem && typeof firstItem === "object" && "id" in firstItem && typeof firstItem.id === "string") {
        return firstItem.id;
      }
    } else if (nameField && typeof nameField === "object" && !Array.isArray(nameField)) {
      const obj = nameField as Record<string, unknown>;
      if ("id" in obj && typeof obj.id === "string") {
        return obj.id;
      }
    }

    console.log(`Open ID not found in employee record for ID: ${employeeId}`);
    return null;
  } catch (error) {
    console.error("Failed to get Lark open_id by employee_id:", error);
    return null;
  }
}
