import {
  getBaseRecords,
  createBaseRecord,
} from "@/lib/syaryo/lark-client";
import {
  LARK_TABLES,
  NOTIFICATION_HISTORY_FIELDS,
} from "@/lib/syaryo/lark-tables";
import {
  NotificationHistory,
  NotificationType,
  NotificationStatus,
} from "@/types/syaryo";

/**
 * 通知履歴を取得
 */
export async function getNotificationHistory(
  recipientId?: string
): Promise<NotificationHistory[]> {
  try {
    const filter = recipientId
      ? `CurrentValue.[${NOTIFICATION_HISTORY_FIELDS.recipient_id}] = "${recipientId}"`
      : undefined;

    const response = await getBaseRecords(LARK_TABLES.NOTIFICATION_HISTORY, {
      filter,
      sort: [NOTIFICATION_HISTORY_FIELDS.sent_at, "false"],
    });

    if (!response.data?.items) {
      return [];
    }

    const history: NotificationHistory[] = response.data.items.map(
      (item: any) => ({
        id: item.record_id || "",
        recipient_id: String(
          item.fields[NOTIFICATION_HISTORY_FIELDS.recipient_id] || ""
        ),
        notification_type: (item.fields[
          NOTIFICATION_HISTORY_FIELDS.notification_type
        ] as NotificationType) || "expiration_warning",
        document_type:
          item.fields[NOTIFICATION_HISTORY_FIELDS.document_type] || undefined,
        document_id:
          item.fields[NOTIFICATION_HISTORY_FIELDS.document_id] || undefined,
        title: String(item.fields[NOTIFICATION_HISTORY_FIELDS.title] || ""),
        message: String(item.fields[NOTIFICATION_HISTORY_FIELDS.message] || ""),
        sent_at: new Date(
          Number(item.fields[NOTIFICATION_HISTORY_FIELDS.sent_at]) || Date.now()
        ),
        status: (item.fields[NOTIFICATION_HISTORY_FIELDS.status] as NotificationStatus) || "sent",
        created_at: new Date(
          Number(item.fields[NOTIFICATION_HISTORY_FIELDS.created_at]) ||
            Date.now()
        ),
      })
    );

    return history;
  } catch (error) {
    console.error("Failed to get notification history:", error);
    return [];
  }
}

/**
 * 通知履歴を作成
 */
export async function createNotificationHistory(data: {
  recipient_id: string;
  notification_type: NotificationType;
  document_type?: "license" | "vehicle" | "insurance";
  document_id?: string;
  title: string;
  message: string;
  status: NotificationStatus;
}): Promise<NotificationHistory> {
  const now = new Date();

  const fields: any = {
    [NOTIFICATION_HISTORY_FIELDS.recipient_id]: data.recipient_id,
    [NOTIFICATION_HISTORY_FIELDS.notification_type]: data.notification_type,
    [NOTIFICATION_HISTORY_FIELDS.title]: data.title,
    [NOTIFICATION_HISTORY_FIELDS.message]: data.message,
    [NOTIFICATION_HISTORY_FIELDS.sent_at]: now.getTime(),
    [NOTIFICATION_HISTORY_FIELDS.status]: data.status,
    [NOTIFICATION_HISTORY_FIELDS.created_at]: now.getTime(),
  };

  if (data.document_type) {
    fields[NOTIFICATION_HISTORY_FIELDS.document_type] = data.document_type;
  }

  if (data.document_id) {
    fields[NOTIFICATION_HISTORY_FIELDS.document_id] = data.document_id;
  }

  const response = await createBaseRecord(
    LARK_TABLES.NOTIFICATION_HISTORY,
    fields
  );

  return {
    id: response.data?.record?.record_id || "",
    recipient_id: data.recipient_id,
    notification_type: data.notification_type,
    document_type: data.document_type,
    document_id: data.document_id,
    title: data.title,
    message: data.message,
    sent_at: now,
    status: data.status,
    created_at: now,
  };
}

/**
 * 通知統計を取得
 */
export async function getNotificationStats(recipientId?: string) {
  const history = await getNotificationHistory(recipientId);

  return {
    total: history.length,
    sent: history.filter((h) => h.status === "sent").length,
    failed: history.filter((h) => h.status === "failed").length,
    byType: {
      expiration_warning: history.filter(
        (h) => h.notification_type === "expiration_warning"
      ).length,
      expiration_alert: history.filter(
        (h) => h.notification_type === "expiration_alert"
      ).length,
      approval: history.filter((h) => h.notification_type === "approval").length,
      rejection: history.filter((h) => h.notification_type === "rejection")
        .length,
    },
  };
}

/**
 * 重複通知をチェック（同じ通知を24時間以内に送信しない）
 */
export async function isDuplicateNotification(
  recipientId: string,
  documentId: string,
  notificationType: NotificationType
): Promise<boolean> {
  try {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    const filter = `AND(
      CurrentValue.[${NOTIFICATION_HISTORY_FIELDS.recipient_id}] = "${recipientId}",
      CurrentValue.[${NOTIFICATION_HISTORY_FIELDS.document_id}] = "${documentId}",
      CurrentValue.[${NOTIFICATION_HISTORY_FIELDS.notification_type}] = "${notificationType}",
      CurrentValue.[${NOTIFICATION_HISTORY_FIELDS.sent_at}] > ${twentyFourHoursAgo}
    )`;

    const response = await getBaseRecords(LARK_TABLES.NOTIFICATION_HISTORY, {
      filter,
      pageSize: 1,
    });

    return (response.data?.items?.length || 0) > 0;
  } catch (error) {
    console.error("Failed to check duplicate notification:", error);
    return false;
  }
}
