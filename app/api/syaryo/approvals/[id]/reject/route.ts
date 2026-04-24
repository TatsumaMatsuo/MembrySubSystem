import { NextRequest, NextResponse } from "next/server";
import {
  rejectDriversLicense,
  getDriversLicenses,
} from "@/lib/syaryo/services/drivers-license.service";
import {
  rejectVehicleRegistration,
  getVehicleRegistrations,
} from "@/lib/syaryo/services/vehicle-registration.service";
import {
  rejectInsurancePolicy,
  getInsurancePolicies,
} from "@/lib/syaryo/services/insurance-policy.service";
import { requireAdmin, getCurrentUser } from "@/lib/syaryo/auth-utils";
import { getBaseRecords } from "@/lib/syaryo/lark-client";
import { LARK_TABLES, EMPLOYEE_FIELDS } from "@/lib/syaryo/lark-tables";
import { recordApprovalHistory } from "@/lib/syaryo/services/approval-history.service";
import { getEmployee } from "@/lib/syaryo/services/employee.service";
import { sendRejectionNotification } from "@/lib/syaryo/services/lark-notification.service";
import { getLarkOpenIdByEmployeeId } from "@/lib/syaryo/services/lark-user.service";

/**
 * POST /api/approvals/:id/reject
 * 申請を却下（管理者のみ）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { type, reason } = body; // "license" | "vehicle" | "insurance"

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Rejection reason is required",
        },
        { status: 400 }
      );
    }

    // 現在のユーザー情報を取得
    const currentUser = await getCurrentUser();

    // 却下処理を実行前に申請レコードを取得（履歴記録用）
    let applicationRecords: any[];
    let applicationRecord: any = null;

    switch (type) {
      case "license":
        applicationRecords = await getDriversLicenses();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await rejectDriversLicense(id, reason);
        break;
      case "vehicle":
        applicationRecords = await getVehicleRegistrations();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await rejectVehicleRegistration(id, reason);
        break;
      case "insurance":
        applicationRecords = await getInsurancePolicies();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await rejectInsurancePolicy(id, reason);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid type",
          },
          { status: 400 }
        );
    }

    // 却下履歴を記録
    if (applicationRecord && currentUser) {
      // 従業員マスタから従業員名を取得
      let employeeName = "不明";
      if (applicationRecord.employee_id) {
        try {
          const employee = await getEmployee(applicationRecord.employee_id);
          if (employee) {
            employeeName = employee.employee_name || "不明";
          }
        } catch (error) {
          console.error("Failed to get employee name:", error);
        }
      }

      await recordApprovalHistory({
        application_type: type as "license" | "vehicle" | "insurance",
        application_id: id,
        employee_id: applicationRecord.employee_id || "",
        employee_name: employeeName,
        action: "rejected",
        approver_id: currentUser.id || currentUser.email || "",
        approver_name: currentUser.name || currentUser.email || "不明",
        reason,
        timestamp: Date.now(),
      });

      // Lark Bot通知を送信
      try {
        const openId = await getLarkOpenIdByEmployeeId(applicationRecord.employee_id);
        if (openId) {
          let documentNumber = "";
          if (type === "license" && applicationRecord.license_number) {
            documentNumber = applicationRecord.license_number;
          } else if (type === "vehicle" && applicationRecord.vehicle_number) {
            documentNumber = applicationRecord.vehicle_number;
          } else if (type === "insurance" && applicationRecord.policy_number) {
            documentNumber = applicationRecord.policy_number;
          }

          await sendRejectionNotification(
            openId,
            type as "license" | "vehicle" | "insurance",
            documentNumber,
            reason
          );
          console.log(`却下通知を送信しました: ${applicationRecord.employee_id}`);
        } else {
          console.log(`Lark Open IDが見つからないため通知をスキップ: ${applicationRecord.employee_id}`);
        }
      } catch (notifyError) {
        console.error("却下通知の送信に失敗:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Application rejected successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/approvals/:id/reject:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reject application",
      },
      { status: 500 }
    );
  }
}
