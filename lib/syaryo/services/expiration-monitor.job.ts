import { getExpiringDocuments, getExpiredDocuments, getExpiredDocumentsForEscalation } from "./expiration.service";
import {
  sendLarkMessage,
  createExpirationWarningTemplate,
  createExpiredNotificationTemplate,
  createAdminExpiredNotificationTemplate,
} from "./lark-notification.service";
import {
  createNotificationHistory,
  isDuplicateNotification,
} from "./notification-history.service";
import { getUserPermissions } from "./user-permission.service";

/**
 * 有効期限切れ間近の通知を送信
 */
export async function sendExpirationWarnings(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  console.log("[ExpirationMonitor] Starting expiration warnings check...");

  const warnings = await getExpiringDocuments();
  console.log(`[ExpirationMonitor] Found ${warnings.length} expiring documents`);

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const warning of warnings) {
    processed++;

    // 重複チェック（24時間以内に同じ通知を送信済みの場合はスキップ）
    const isDuplicate = await isDuplicateNotification(
      warning.employeeId,
      warning.documentId,
      "expiration_warning"
    );

    if (isDuplicate) {
      console.log(
        `[ExpirationMonitor] Skipping duplicate notification for ${warning.type} ${warning.documentNumber}`
      );
      skipped++;
      continue;
    }

    // 通知テンプレート生成
    const template = createExpirationWarningTemplate(warning);

    // メールアドレスがない場合はスキップ
    if (!warning.employeeEmail) {
      console.warn(
        `[ExpirationMonitor] No email for employee ${warning.employeeId}, skipping notification`
      );
      failed++;
      continue;
    }

    // Larkメッセージ送信（emailで送信）
    const success = await sendLarkMessage(warning.employeeEmail, template, {
      receiveIdType: "email",
    });

    // 通知履歴を記録
    await createNotificationHistory({
      recipient_id: warning.employeeId,
      notification_type: "expiration_warning",
      document_type: warning.type,
      document_id: warning.documentId,
      title: template.title,
      message: template.content,
      status: success ? "sent" : "failed",
    });

    if (success) {
      console.log(
        `[ExpirationMonitor] Sent warning for ${warning.type} ${warning.documentNumber} to ${warning.employeeId}`
      );
      sent++;
    } else {
      console.error(
        `[ExpirationMonitor] Failed to send warning for ${warning.type} ${warning.documentNumber}`
      );
      failed++;
    }

    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(
    `[ExpirationMonitor] Expiration warnings completed: ${sent} sent, ${skipped} skipped, ${failed} failed`
  );

  return { processed, sent, skipped, failed };
}

/**
 * 有効期限切れの通知を送信（申請者と管理者へ）
 */
export async function sendExpiredAlerts(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  adminSent: number;
}> {
  console.log("[ExpirationMonitor] Starting expired documents check...");

  const expired = await getExpiredDocuments();
  console.log(`[ExpirationMonitor] Found ${expired.length} expired documents`);

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // 申請者への通知
  for (const warning of expired) {
    processed++;

    // 重複チェック
    const isDuplicate = await isDuplicateNotification(
      warning.employeeId,
      warning.documentId,
      "expiration_alert"
    );

    if (isDuplicate) {
      skipped++;
      continue;
    }

    // 通知テンプレート生成
    const template = createExpiredNotificationTemplate(warning);

    // メールアドレスがない場合はスキップ
    if (!warning.employeeEmail) {
      console.warn(
        `[ExpirationMonitor] No email for employee ${warning.employeeId}, skipping alert`
      );
      failed++;
      continue;
    }

    // Larkメッセージ送信（emailで送信）
    const success = await sendLarkMessage(warning.employeeEmail, template, {
      receiveIdType: "email",
    });

    // 通知履歴を記録
    await createNotificationHistory({
      recipient_id: warning.employeeId,
      notification_type: "expiration_alert",
      document_type: warning.type,
      document_id: warning.documentId,
      title: template.title,
      message: template.content,
      status: success ? "sent" : "failed",
    });

    if (success) {
      console.log(
        `[ExpirationMonitor] Sent alert for ${warning.type} ${warning.documentNumber} to ${warning.employeeId}`
      );
      sent++;
    } else {
      console.error(
        `[ExpirationMonitor] Failed to send alert for ${warning.type} ${warning.documentNumber}`
      );
      failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // 管理者への通知（エスカレーション日数以上経過した期限切れ書類のみ）
  let adminSent = 0;
  const escalationTargets = await getExpiredDocumentsForEscalation();

  if (escalationTargets.length > 0) {
    const admins = await getUserPermissions();
    const adminUsers = admins.filter((u) => u.role === "admin");

    const adminTemplate = createAdminExpiredNotificationTemplate(escalationTargets);

    for (const admin of adminUsers) {
      // 管理者向けエスカレーション通知の重複チェック
      const isDuplicateAdmin = await isDuplicateNotification(
        admin.user_email || admin.lark_user_id,
        "admin_escalation",
        "admin_escalation"
      );

      if (isDuplicateAdmin) {
        console.log(
          `[ExpirationMonitor] Skipping duplicate admin escalation for ${admin.user_name}`
        );
        continue;
      }

      // メールアドレスがない場合はスキップ
      if (!admin.user_email) {
        console.warn(
          `[ExpirationMonitor] No email for admin ${admin.user_name}, skipping escalation`
        );
        continue;
      }

      // Larkメッセージ送信（emailで送信）
      const success = await sendLarkMessage(admin.user_email, adminTemplate, {
        receiveIdType: "email",
      });

      await createNotificationHistory({
        recipient_id: admin.user_email,
        notification_type: "admin_escalation",
        title: adminTemplate.title,
        message: adminTemplate.content,
        status: success ? "sent" : "failed",
      });

      if (success) {
        adminSent++;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `[ExpirationMonitor] Sent admin escalation alerts to ${adminSent} administrators (${escalationTargets.length} documents)`
    );
  } else {
    console.log(
      `[ExpirationMonitor] No documents require admin escalation yet`
    );
  }

  console.log(
    `[ExpirationMonitor] Expired alerts completed: ${sent} sent to employees, ${adminSent} sent to admins, ${skipped} skipped, ${failed} failed`
  );

  return { processed, sent, skipped, failed, adminSent };
}

/**
 * 全ての有効期限監視処理を実行
 */
export async function runExpirationMonitor(): Promise<void> {
  console.log(
    `[ExpirationMonitor] Starting job at ${new Date().toISOString()}`
  );

  try {
    const warningResults = await sendExpirationWarnings();
    const alertResults = await sendExpiredAlerts();

    console.log("[ExpirationMonitor] Job completed successfully");
    console.log("[ExpirationMonitor] Warning results:", warningResults);
    console.log("[ExpirationMonitor] Alert results:", alertResults);
  } catch (error) {
    console.error("[ExpirationMonitor] Job failed:", error);
    throw error;
  }
}
