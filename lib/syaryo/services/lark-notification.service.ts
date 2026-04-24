import { larkClient } from "@/lib/syaryo/lark-client";
import { ExpirationWarning } from "./expiration.service";

export interface NotificationTemplate {
  title: string;
  content: string;
}

// システムのベースURL
const SYSTEM_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://syaryo-kanren-system.vercel.app";

export interface MessageOptions {
  showActionButton?: boolean;
  actionUrl?: string;
  buttonText?: string;
  /** 受信者IDの種類（デフォルト: open_id） */
  receiveIdType?: "open_id" | "email";
}

/**
 * Lark Messengerでメッセージを送信
 * @param receiveId LarkユーザーのOpen ID またはメールアドレス
 * @param message 送信するメッセージ
 * @param options オプション設定
 */
export async function sendLarkMessage(
  receiveId: string,
  message: NotificationTemplate,
  options: MessageOptions = {}
): Promise<boolean> {
  const {
    showActionButton = true,
    actionUrl = `${SYSTEM_BASE_URL}/dashboard`,
    buttonText = "📋 申請メニューを開く",
    receiveIdType = "open_id",
  } = options;

  try {
    const elements: any[] = [
      {
        tag: "div",
        text: {
          content: message.content,
          tag: "lark_md",
        },
      },
    ];

    // アクションボタンを追加
    if (showActionButton) {
      elements.push({
        tag: "hr",
      });
      elements.push({
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              content: buttonText,
              tag: "plain_text",
            },
            type: "primary",
            url: actionUrl,
          },
        ],
      });
    }

    // Lark Message API を使用してメッセージを送信
    const response = await larkClient.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify({
          config: {
            wide_screen_mode: true,
          },
          header: {
            template: "orange",
            title: {
              content: message.title,
              tag: "plain_text",
            },
          },
          elements,
        }),
      },
    });

    return response.code === 0;
  } catch (error) {
    console.error("Failed to send Lark message:", error);
    return false;
  }
}

/**
 * 有効期限警告通知のテンプレートを生成
 */
export function createExpirationWarningTemplate(
  warning: ExpirationWarning
): NotificationTemplate {
  const documentTypeMap = {
    license: "免許証",
    vehicle: "車検証",
    insurance: "任意保険証",
  };

  const documentType = documentTypeMap[warning.type];
  const expirationDateStr = warning.expirationDate.toLocaleDateString("ja-JP");

  return {
    title: `【重要】${documentType}の有効期限が近づいています`,
    content: `**書類種類**: ${documentType}
**証明書番号**: ${warning.documentNumber}
**有効期限**: ${expirationDateStr}
**残り日数**: ${warning.daysUntilExpiration}日

有効期限が近づいています。早めの更新手続きをお願いします。

📌 **更新が完了したら、下記ボタンから申請メニューにアクセスし、再度申請を行ってください。**`,
  };
}

/**
 * 有効期限切れ通知のテンプレートを生成
 */
export function createExpiredNotificationTemplate(
  warning: ExpirationWarning
): NotificationTemplate {
  const documentTypeMap = {
    license: "免許証",
    vehicle: "車検証",
    insurance: "任意保険証",
  };

  const documentType = documentTypeMap[warning.type];
  const expirationDateStr = warning.expirationDate.toLocaleDateString("ja-JP");
  const daysOverdue = Math.abs(warning.daysUntilExpiration);

  return {
    title: `【緊急】${documentType}の有効期限が切れています`,
    content: `**書類種類**: ${documentType}
**証明書番号**: ${warning.documentNumber}
**有効期限**: ${expirationDateStr}
**期限超過**: ${daysOverdue}日

⚠️ 有効期限が切れています。至急、更新手続きを行ってください。
有効期限が切れた状態での業務は認められません。

📌 **更新が完了したら、下記ボタンから申請メニューにアクセスし、再度申請を行ってください。**`,
  };
}

/**
 * 管理者向け期限切れ通知のテンプレートを生成
 */
export function createAdminExpiredNotificationTemplate(
  warnings: ExpirationWarning[]
): NotificationTemplate {
  const documentTypeMap = {
    license: "免許証",
    vehicle: "車検証",
    insurance: "任意保険証",
  };

  const warningList = warnings
    .map((w) => {
      const docType = documentTypeMap[w.type];
      const dateStr = w.expirationDate.toLocaleDateString("ja-JP");
      return `- ${docType} (${w.documentNumber}): ${dateStr} - ${Math.abs(
        w.daysUntilExpiration
      )}日超過`;
    })
    .join("\n");

  return {
    title: `【管理者通知】期限切れ書類があります (${warnings.length}件)`,
    content: `以下の書類の有効期限が切れています。

${warningList}

⚠️ 本人に連絡し更新手続きを依頼し、現在の状況を確認してください。

📌 **下記ボタンから管理画面にアクセスし、詳細を確認してください。**`,
  };
}

/**
 * 複数ユーザーに一括通知を送信
 */
export async function sendBulkNotifications(
  notifications: Array<{ userId: string; message: NotificationTemplate; options?: MessageOptions }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const notification of notifications) {
    const result = await sendLarkMessage(
      notification.userId,
      notification.message,
      notification.options
    );
    if (result) {
      success++;
    } else {
      failed++;
    }
    // レート制限対策: 少し待機
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { success, failed };
}

/**
 * 管理者向け通知を送信
 */
export async function sendAdminNotification(
  adminUserId: string,
  message: NotificationTemplate
): Promise<boolean> {
  return sendLarkMessage(adminUserId, message, {
    actionUrl: `${SYSTEM_BASE_URL}/admin/applications`,
    buttonText: "🔧 管理画面を開く",
  });
}

/**
 * 承認通知のテンプレートを生成
 */
export function createApprovalNotificationTemplate(
  documentType: "license" | "vehicle" | "insurance",
  documentNumber: string,
  allApproved: boolean = false
): NotificationTemplate {
  const documentTypeMap = {
    license: "免許証",
    vehicle: "車検証",
    insurance: "任意保険証",
  };

  const docTypeName = documentTypeMap[documentType];

  if (allApproved) {
    return {
      title: "🎉 マイカー通勤申請が承認されました",
      content: `おめでとうございます！すべての書類が承認され、マイカー通勤の許可証が発行されました。

**承認された書類**: ${docTypeName}（${documentNumber}）

✅ **全書類が承認済みとなりました**
許可証はダッシュボードからダウンロードできます。

📌 **下記ボタンからダッシュボードにアクセスし、許可証を確認してください。**`,
    };
  }

  return {
    title: `✅ ${docTypeName}が承認されました`,
    content: `申請いただいた${docTypeName}が承認されました。

**書類種類**: ${docTypeName}
**証明書番号**: ${documentNumber}

📌 **すべての書類（免許証・車検証・任意保険証）が承認されると、マイカー通勤許可証が発行されます。**`,
  };
}

/**
 * 却下通知のテンプレートを生成
 */
export function createRejectionNotificationTemplate(
  documentType: "license" | "vehicle" | "insurance",
  documentNumber: string,
  reason: string
): NotificationTemplate {
  const documentTypeMap = {
    license: "免許証",
    vehicle: "車検証",
    insurance: "任意保険証",
  };

  const docTypeName = documentTypeMap[documentType];

  return {
    title: `❌ ${docTypeName}の申請が却下されました`,
    content: `申請いただいた${docTypeName}が却下されました。

**書類種類**: ${docTypeName}
**証明書番号**: ${documentNumber}

**却下理由**:
${reason}

📌 **内容を確認の上、再度申請をお願いします。**`,
  };
}

/**
 * 申請者に承認通知を送信
 */
export async function sendApprovalNotification(
  userId: string,
  documentType: "license" | "vehicle" | "insurance",
  documentNumber: string,
  allApproved: boolean = false
): Promise<boolean> {
  const template = createApprovalNotificationTemplate(documentType, documentNumber, allApproved);
  return sendLarkMessage(userId, template, {
    actionUrl: `${SYSTEM_BASE_URL}/dashboard`,
    buttonText: allApproved ? "📋 許可証を確認する" : "📋 申請状況を確認する",
  });
}

/**
 * 申請者に却下通知を送信
 */
export async function sendRejectionNotification(
  userId: string,
  documentType: "license" | "vehicle" | "insurance",
  documentNumber: string,
  reason: string
): Promise<boolean> {
  const template = createRejectionNotificationTemplate(documentType, documentNumber, reason);
  return sendLarkMessage(userId, template, {
    actionUrl: `${SYSTEM_BASE_URL}/dashboard`,
    buttonText: "📋 再申請する",
  });
}
