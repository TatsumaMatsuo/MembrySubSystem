import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import {
  sendLarkMessage,
  createExpirationWarningTemplate,
  createExpiredNotificationTemplate,
} from "@/lib/syaryo/services/lark-notification.service";
import { createNotificationHistory } from "@/lib/syaryo/services/notification-history.service";
import { ExpirationWarning } from "@/lib/syaryo/services/expiration.service";

// AWS Amplify SSRでのタイムアウト延長（送信件数が多い場合に備える）
export const maxDuration = 60;

interface NotifyItem {
  type: "license" | "vehicle" | "insurance";
  documentId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  documentNumber: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

interface NotifyDetail {
  employeeName: string;
  documentNumber: string;
  ok: boolean;
  reason?: string;
}

/**
 * POST /api/syaryo/monitoring/expiration/notify
 * 有効期限監視画面で選択された書類の対象社員へ、リマインドメッセージを送信（管理者のみ）
 */
export async function POST(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const body = await request.json();
    const category: "expiring" | "expired" =
      body.category === "expired" ? "expired" : "expiring";
    const note: string = typeof body.note === "string" ? body.note.trim() : "";
    const items: NotifyItem[] = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "送信対象が選択されていません" },
        { status: 400 }
      );
    }

    const details: NotifyDetail[] = [];
    let sent = 0;
    let failed = 0;

    for (const item of items) {
      // メールアドレス未登録の社員には送信できない
      if (!item.employeeEmail) {
        failed++;
        details.push({
          employeeName: item.employeeName,
          documentNumber: item.documentNumber,
          ok: false,
          reason: "メールアドレスが未登録のため送信できません",
        });
        continue;
      }

      const warning: ExpirationWarning = {
        type: item.type,
        documentId: item.documentId,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeEmail: item.employeeEmail,
        documentNumber: item.documentNumber,
        expirationDate: new Date(item.expirationDate),
        daysUntilExpiration: item.daysUntilExpiration,
      };

      const template =
        category === "expired"
          ? createExpiredNotificationTemplate(warning)
          : createExpirationWarningTemplate(warning);

      // 任意の連絡文を末尾に追記
      if (note) {
        template.content += `\n\n---\n**総務からの連絡**\n${note}`;
      }

      const sendResult = await sendLarkMessage(item.employeeEmail, template, {
        receiveIdType: "email",
      });

      // 通知履歴を記録
      await createNotificationHistory({
        recipient_id: item.employeeId,
        notification_type:
          category === "expired" ? "expiration_alert" : "expiration_warning",
        document_type: item.type,
        document_id: item.documentId,
        title: template.title,
        message: template.content,
        status: sendResult.ok ? "sent" : "failed",
      });

      if (sendResult.ok) {
        sent++;
        details.push({
          employeeName: item.employeeName,
          documentNumber: item.documentNumber,
          ok: true,
        });
      } else {
        failed++;
        details.push({
          employeeName: item.employeeName,
          documentNumber: item.documentNumber,
          ok: false,
          reason: sendResult.error || sendResult.msg || "送信に失敗しました",
        });
      }

      // レート制限対策
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: items.length,
      details,
    });
  } catch (error) {
    console.error("[expiration-notify] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
