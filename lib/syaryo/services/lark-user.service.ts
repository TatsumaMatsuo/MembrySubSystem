import { larkClient, getBaseRecords } from "@/lib/syaryo/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
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
 * 現在のユーザー情報を取得（ユーザーアクセストークンから）
 *
 * Lark `authen/v1/user_info` を user_access_token で呼び出し「自分の情報」を得る。
 * app/tenant トークンではなくログイン本人のトークンを Bearer で送る点が getLarkUser() と異なる。
 * エンドポイント/ドメインは OAuth ログイン経路（lib/auth-options.ts）と統一。
 *
 * @param accessToken ユーザーアクセストークン（Bearer）
 * @returns ユーザー情報。トークン無効(401/403)・API失敗時は null（呼び出し側で再ログイン誘導可能）
 */
export async function getCurrentLarkUser(
  accessToken: string
): Promise<LarkUser | null> {
  if (!accessToken) return null;
  try {
    const domain = process.env.LARK_DOMAIN || "https://open.larksuite.com";
    const response = await fetch(`${domain}/open-apis/authen/v1/user_info`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // 401/403 等: トークン失効・権限不足。例外にせず null を返し呼び出し側へ委ねる
      console.error(`[lark-user] getCurrentLarkUser HTTP ${response.status}`);
      return null;
    }

    const body = await response.json();
    if (body.code !== 0 || !body.data) {
      console.error(`[lark-user] getCurrentLarkUser API error: code=${body.code} msg=${body.msg}`);
      return null;
    }

    const u = body.data;
    return {
      open_id: u.open_id || "",
      union_id: u.union_id,
      user_id: u.user_id,
      name: u.name || "",
      en_name: u.en_name,
      // enterprise_email へフォールバック（auth-options.ts と同一方針）
      email: u.email || u.enterprise_email || "",
      mobile: u.mobile,
      // user_info はアバターを平坦な url 群で返す（contact.user.get の入れ子 avatar とは別形）。
      // LarkUser.avatar 形へマッピングする。
      avatar:
        u.avatar_url || u.avatar_thumb || u.avatar_middle || u.avatar_big
          ? {
              avatar_72: u.avatar_thumb,
              avatar_240: u.avatar_middle,
              avatar_640: u.avatar_big,
              avatar_origin: u.avatar_url,
            }
          : undefined,
      department_ids: undefined,
    };
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
  const target = await getLarkNotificationTargetByEmployeeId(employeeId);
  return target?.openId || null;
}

/**
 * 社員IDからLark通知先（Open ID / email）を取得
 * 承認通知などで Open ID が取れない場合 email にフォールバックするための共通ヘルパー。
 *
 * @param employeeId 社員ID
 * @returns { openId, email } のいずれか or 両方を含むオブジェクト。レコード自体が無い場合のみ null
 */
export async function getLarkNotificationTargetByEmployeeId(
  employeeId: string
): Promise<{ openId: string | null; email: string | null } | null> {
  try {
    const response = await getBaseRecords(USER_SEARCH_TABLE_ID, {
      filter: `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}]="${escapeLarkFilterValue(employeeId)}"`,
    });

    const employee = response.data?.items?.[0];
    if (!employee) {
      console.log(`Employee not found for ID: ${employeeId}`);
      return null;
    }

    let openId: string | null = null;
    let email: string | null = null;

    // Peopleフィールド（社員名 (メンバー )）から open_id と email を抽出
    const peopleField = employee.fields[EMPLOYEE_MASTER_FIELDS.people_field] as unknown;
    const extract = (item: Record<string, unknown>) => {
      if (!openId && typeof item.id === "string") openId = item.id;
      if (!email && typeof item.email === "string") email = item.email;
    };

    if (Array.isArray(peopleField)) {
      for (const it of peopleField) {
        if (it && typeof it === "object") extract(it as Record<string, unknown>);
      }
    } else if (peopleField && typeof peopleField === "object") {
      extract(peopleField as Record<string, unknown>);
    }

    // email 専用テキストフィールドにもフォールバック（People未設定でテキスト直接入力されているケース）
    if (!email) {
      const directEmail = employee.fields[EMPLOYEE_MASTER_FIELDS.email];
      if (typeof directEmail === "string" && directEmail) email = directEmail;
    }

    console.log(`[lark-user] Notification target for ${employeeId}: openId=${openId ? "found" : "null"}, email=${email ? "found" : "null"}`);
    return { openId, email };
  } catch (error) {
    console.error("Failed to get Lark notification target:", error);
    return null;
  }
}
