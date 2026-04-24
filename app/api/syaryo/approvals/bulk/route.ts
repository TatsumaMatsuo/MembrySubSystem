import { NextRequest, NextResponse } from "next/server";
import {
  approveDriversLicense,
  getDriversLicenses,
} from "@/lib/syaryo/services/drivers-license.service";
import {
  approveVehicleRegistration,
  getVehicleRegistrations,
} from "@/lib/syaryo/services/vehicle-registration.service";
import {
  approveInsurancePolicy,
  getInsurancePolicies,
} from "@/lib/syaryo/services/insurance-policy.service";
import { requireAdmin, getCurrentUser } from "@/lib/syaryo/auth-utils";
import { getBaseRecords } from "@/lib/syaryo/lark-client";
import { LARK_TABLES, EMPLOYEE_FIELDS } from "@/lib/syaryo/lark-tables";
import { recordApprovalHistory } from "@/lib/syaryo/services/approval-history.service";
import { getEmployee } from "@/lib/syaryo/services/employee.service";
import {
  createPermit,
  revokeExistingPermit,
  getValidPermitByVehicleId,
} from "@/lib/syaryo/services/permit.service";
import { generatePermitPdf } from "@/lib/syaryo/services/pdf-generator.service";
import { calculatePermitExpiration } from "@/lib/syaryo/permit-utils";
import { sendApprovalNotification } from "@/lib/syaryo/services/lark-notification.service";
import { getLarkOpenIdByEmployeeId } from "@/lib/syaryo/services/lark-user.service";

// 最大一括承認件数
const MAX_BULK_ITEMS = 50;

interface BulkApprovalItem {
  id: string;
  type: "license" | "vehicle" | "insurance";
}

interface BulkApprovalRequest {
  items: BulkApprovalItem[];
  action: "approve" | "reject";
  reason?: string; // 却下時のみ
}

interface BulkApprovalResult {
  id: string;
  type: string;
  success: boolean;
  error?: string;
}

/**
 * 全書類が承認済みかチェックし、許可証を発行
 */
async function checkAndGeneratePermit(
  employeeId: string,
  baseUrl: string
): Promise<void> {
  try {
    const licenses = await getDriversLicenses(employeeId);
    const approvedLicense = licenses.find((l) => l.approval_status === "approved");
    if (!approvedLicense) return;

    const vehicles = await getVehicleRegistrations(employeeId);
    const approvedVehicles = vehicles.filter((v) => v.approval_status === "approved");
    if (approvedVehicles.length === 0) return;

    const insurances = await getInsurancePolicies(employeeId);
    const approvedInsurance = insurances.find((i) => i.approval_status === "approved");
    if (!approvedInsurance) return;

    const employee = await getEmployee(employeeId);
    if (!employee) return;

    for (const vehicle of approvedVehicles) {
      try {
        // 有効期限を計算（免許証・車検証・保険証の最短期限）
        const expirationDate = calculatePermitExpiration(
          approvedLicense.expiration_date,
          vehicle.inspection_expiration_date,
          approvedInsurance.coverage_end_date
        );

        // 既存の有効な許可証をチェック
        const existingPermit = await getValidPermitByVehicleId(vehicle.id);
        if (existingPermit) {
          // 有効期限が同じ場合はスキップ（再発行不要）
          const existingExpTime = existingPermit.expiration_date.getTime();
          const newExpTime = expirationDate.getTime();
          if (Math.abs(existingExpTime - newExpTime) < 86400000) { // 1日以内の差は同じとみなす
            console.log(`許可証は既に発行済みです（有効期限同一）: ${vehicle.vehicle_number}`);
            continue;
          }
          // 有効期限が変わった場合は既存を無効化して再発行
          console.log(`許可証を再発行します（有効期限変更）: ${vehicle.vehicle_number}`);
          await revokeExistingPermit(vehicle.id);
        }

        // 車両情報（車名・メーカー）を組み立て（null対応）
        const vehicleModelParts = [vehicle.manufacturer, vehicle.model_name].filter(Boolean);
        const vehicleModel = vehicleModelParts.length > 0 ? vehicleModelParts.join(" ") : "（未登録）";

        const permitData = {
          employee_id: employeeId,
          employee_name: employee.employee_name,
          vehicle_id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          vehicle_model: vehicleModel,
          manufacturer: vehicle.manufacturer || "",
          model_name: vehicle.model_name || "",
          expiration_date: expirationDate,
        };

        const permit = await createPermit(permitData, "");

        const fileKey = await generatePermitPdf({
          employeeName: employee.employee_name,
          vehicleNumber: vehicle.vehicle_number,
          vehicleModel: vehicleModel,
          issueDate: new Date(),
          expirationDate,
          permitId: permit.id,
          verificationToken: permit.verification_token,
          baseUrl,
        });

        const { updatePermitFileKey } = await import("@/lib/syaryo/services/permit.service");
        await updatePermitFileKey(permit.id, fileKey);

        console.log(`許可証を発行しました: ${employee.employee_name} - ${vehicle.vehicle_number}`);
      } catch (error) {
        console.error(`許可証発行エラー (車両: ${vehicle.id}):`, error);
      }
    }
  } catch (error) {
    console.error("許可証チェック・発行エラー:", error);
  }
}

/**
 * 従業員名を取得
 */
async function getEmployeeName(employeeId: string): Promise<string> {
  try {
    const employee = await getEmployee(employeeId);
    if (employee) {
      return employee.employee_name || "不明";
    }
  } catch (error) {
    console.error("Failed to get employee name:", error);
  }
  return "不明";
}

/**
 * 単一の申請を承認
 */
async function approveSingleItem(
  item: BulkApprovalItem,
  currentUser: any,
  baseUrl: string
): Promise<BulkApprovalResult> {
  try {
    let applicationRecord: any = null;

    switch (item.type) {
      case "license":
        const licenses = await getDriversLicenses();
        applicationRecord = licenses.find((r) => r.id === item.id);
        if (!applicationRecord) {
          return { id: item.id, type: item.type, success: false, error: "Record not found" };
        }
        await approveDriversLicense(item.id);
        break;
      case "vehicle":
        const vehicles = await getVehicleRegistrations();
        applicationRecord = vehicles.find((r) => r.id === item.id);
        if (!applicationRecord) {
          return { id: item.id, type: item.type, success: false, error: "Record not found" };
        }
        await approveVehicleRegistration(item.id);
        break;
      case "insurance":
        const insurances = await getInsurancePolicies();
        applicationRecord = insurances.find((r) => r.id === item.id);
        if (!applicationRecord) {
          return { id: item.id, type: item.type, success: false, error: "Record not found" };
        }
        await approveInsurancePolicy(item.id);
        break;
      default:
        return { id: item.id, type: item.type, success: false, error: "Invalid type" };
    }

    // 承認履歴を記録
    if (applicationRecord) {
      const employeeName = await getEmployeeName(applicationRecord.employee_id);

      await recordApprovalHistory({
        application_type: item.type,
        application_id: item.id,
        employee_id: applicationRecord.employee_id || "",
        employee_name: employeeName,
        action: "approved",
        approver_id: currentUser.id || currentUser.email || "",
        approver_name: currentUser.name || currentUser.email || "不明",
        timestamp: Date.now(),
      });

      // 許可証の自動発行チェック
      let allApproved = false;
      if (applicationRecord.employee_id) {
        // 許可証発行前に全書類が承認済みかチェック
        const licenses = await getDriversLicenses(applicationRecord.employee_id);
        const vehicles = await getVehicleRegistrations(applicationRecord.employee_id);
        const insurances = await getInsurancePolicies(applicationRecord.employee_id);

        const hasApprovedLicense = licenses.some(l => l.approval_status === "approved");
        const hasApprovedVehicle = vehicles.some(v => v.approval_status === "approved");
        const hasApprovedInsurance = insurances.some(i => i.approval_status === "approved");

        allApproved = hasApprovedLicense && hasApprovedVehicle && hasApprovedInsurance;

        await checkAndGeneratePermit(applicationRecord.employee_id, baseUrl);
      }

      // Lark Bot通知を送信
      try {
        const openId = await getLarkOpenIdByEmployeeId(applicationRecord.employee_id);
        if (openId) {
          let documentNumber = "";
          if (item.type === "license" && applicationRecord.license_number) {
            documentNumber = applicationRecord.license_number;
          } else if (item.type === "vehicle" && applicationRecord.vehicle_number) {
            documentNumber = applicationRecord.vehicle_number;
          } else if (item.type === "insurance" && applicationRecord.policy_number) {
            documentNumber = applicationRecord.policy_number;
          }

          await sendApprovalNotification(
            openId,
            item.type,
            documentNumber,
            allApproved
          );
        }
      } catch (notifyError) {
        console.error("承認通知の送信に失敗:", notifyError);
      }
    }

    return { id: item.id, type: item.type, success: true };
  } catch (error) {
    console.error(`Error approving ${item.type} ${item.id}:`, error);
    return {
      id: item.id,
      type: item.type,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * POST /api/approvals/bulk
 * 複数の申請を一括承認（管理者のみ）
 */
export async function POST(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const body: BulkApprovalRequest = await request.json();
    const { items, action } = body;

    // バリデーション
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items provided" },
        { status: 400 }
      );
    }

    if (items.length > MAX_BULK_ITEMS) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BULK_ITEMS} items allowed` },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // 現在は承認のみサポート（却下は個別対応推奨）
    if (action === "reject") {
      return NextResponse.json(
        { success: false, error: "Bulk rejection is not supported. Please reject individually with reason." },
        { status: 400 }
      );
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    // 並行処理で一括承認（最大10件ずつ）
    const results: BulkApprovalResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item) => approveSingleItem(item, currentUser, baseUrl))
      );
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message: `${successCount}件の承認が完了しました${failedCount > 0 ? `（${failedCount}件失敗）` : ""}`,
      results,
      summary: {
        total: items.length,
        success: successCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/approvals/bulk:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process bulk approval",
      },
      { status: 500 }
    );
  }
}
