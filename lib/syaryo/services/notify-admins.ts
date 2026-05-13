/**
 * 新規申請を管理者全員に Bot 通知する共通ヘルパー
 * 各申請エンドポイント（免許/車検/任意保険）から呼び出す
 */
import { getSyaryoAdmins } from "./syaryo-admin.service";
import { getEmployee } from "./employee.service";
import { sendNewApplicationNotification } from "./lark-notification.service";

export interface NotifyAdminsResult {
  total: number;
  sent: number;
  failed: number;
  details: Array<{ employeeId: string; channel: "open_id" | "email" | null; ok: boolean; msg?: string }>;
}

/**
 * 申請者の社員情報を取得して、管理者全員に Bot 通知を送る。
 * 各管理者に対して Open ID 優先・email フォールバックで送信。
 * 通知の失敗は呼び出し元に影響させない（catchで包む）。
 */
export async function notifyAdminsOfNewApplication(
  applicantEmployeeId: string,
  documentType: "license" | "vehicle" | "insurance",
  documentNumber: string
): Promise<NotifyAdminsResult> {
  try {
    // 申請者情報を取得
    const applicant = await getEmployee(applicantEmployeeId);
    const applicantName = applicant?.employee_name || applicantEmployeeId;
    const applicantDepartment = applicant?.department || "";

    // 管理者一覧を取得
    const admins = await getSyaryoAdmins();
    console.log(`[notify-admins] Admins found: ${admins.length}`);

    if (admins.length === 0) {
      return { total: 0, sent: 0, failed: 0, details: [] };
    }

    // 並行送信（管理者数 ≤ 数十名想定）
    const results = await Promise.all(
      admins.map(async (admin) => {
        try {
          // Open ID 優先 → 失敗時 email フォールバック
          let result = admin.openId
            ? await sendNewApplicationNotification(admin.openId, applicantName, applicantDepartment, documentType, documentNumber, "open_id")
            : { ok: false };
          let channel: "open_id" | "email" | null = result.ok ? "open_id" : null;

          if (!result.ok && admin.email) {
            result = await sendNewApplicationNotification(admin.email, applicantName, applicantDepartment, documentType, documentNumber, "email");
            channel = result.ok ? "email" : null;
          }

          return {
            employeeId: admin.employeeId,
            channel,
            ok: result.ok,
            msg: (result as any).msg || (result as any).error,
          };
        } catch (e: any) {
          return {
            employeeId: admin.employeeId,
            channel: null as "open_id" | "email" | null,
            ok: false,
            msg: e?.message || String(e),
          };
        }
      })
    );

    const sent = results.filter(r => r.ok).length;
    const failed = results.length - sent;
    console.log(`[notify-admins] Result: total=${results.length}, sent=${sent}, failed=${failed}`);

    return {
      total: results.length,
      sent,
      failed,
      details: results,
    };
  } catch (error: any) {
    console.error("[notify-admins] Error:", error);
    return { total: 0, sent: 0, failed: 0, details: [] };
  }
}
