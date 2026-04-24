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
import { LARK_TABLES, EMPLOYEE_FIELDS, USER_SEARCH_TABLE_ID, EMPLOYEE_MASTER_FIELDS } from "@/lib/syaryo/lark-tables";
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

/**
 * 全書類が承認済みかチェックし、許可証を発行
 */
async function checkAndGeneratePermit(
  employeeId: string,
  baseUrl: string
): Promise<void> {
  try {
    // 免許証を確認
    const licenses = await getDriversLicenses(employeeId);
    const approvedLicense = licenses.find((l) => l.approval_status === "approved");
    if (!approvedLicense) return;

    // 車検証を確認（承認済みのもの全て）
    const vehicles = await getVehicleRegistrations(employeeId);
    const approvedVehicles = vehicles.filter((v) => v.approval_status === "approved");
    if (approvedVehicles.length === 0) return;

    // 保険証を確認
    const insurances = await getInsurancePolicies(employeeId);
    const approvedInsurance = insurances.find((i) => i.approval_status === "approved");
    if (!approvedInsurance) return;

    // 社員情報を取得
    const employee = await getEmployee(employeeId);
    if (!employee) return;

    // 各車両に対して許可証を発行
    for (const vehicle of approvedVehicles) {
      try {
        // 有効期限を計算（免許証・車検証・保険証の最短期限）
        const expirationDate = calculatePermitExpiration(
          approvedLicense.expiration_date,
          vehicle.inspection_expiration_date,
          approvedInsurance.coverage_end_date
        );

        // 既存の有効な許可証をチェック
        console.log(`[許可証チェック] 車両ID: ${vehicle.id}, 車両番号: ${vehicle.vehicle_number}`);
        const existingPermit = await getValidPermitByVehicleId(vehicle.id);
        console.log(`[許可証チェック] 既存許可証: ${existingPermit ? `あり (ID: ${existingPermit.id})` : "なし"}`);
        if (existingPermit) {
          // 有効期限が同じ場合はスキップ（再発行不要）
          const existingExpTime = existingPermit.expiration_date.getTime();
          const newExpTime = expirationDate.getTime();
          console.log(`[許可証チェック] 既存期限: ${existingPermit.expiration_date.toISOString()}, 新期限: ${expirationDate.toISOString()}`);
          if (Math.abs(existingExpTime - newExpTime) < 86400000) { // 1日以内の差は同じとみなす
            console.log(`[許可証スキップ] 許可証は既に発行済みです（有効期限同一）: ${vehicle.vehicle_number}`);
            continue;
          }
          // 有効期限が変わった場合は既存を無効化して再発行
          console.log(`[許可証再発行] 許可証を再発行します（有効期限変更）: ${vehicle.vehicle_number}`);
          await revokeExistingPermit(vehicle.id);
        } else {
          console.log(`[許可証新規] 新規許可証を発行します: ${vehicle.vehicle_number}`);
        }

        // 車両情報（車名・メーカー）を組み立て（null対応）
        const vehicleModelParts = [vehicle.manufacturer, vehicle.model_name].filter(Boolean);
        const vehicleModel = vehicleModelParts.length > 0 ? vehicleModelParts.join(" ") : "（未登録）";

        // 許可証を作成
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

        // PDFを生成
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

        // 許可証のfile_keyを更新
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
 * POST /api/approvals/:id
 * 申請を承認（管理者のみ）
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
    const { type } = body; // "license" | "vehicle" | "insurance"

    // 現在のユーザー情報を取得
    const currentUser = await getCurrentUser();

    // 承認処理を実行前に申請レコードを取得（履歴記録用）
    let applicationRecords: any[];
    let applicationRecord: any = null;

    switch (type) {
      case "license":
        applicationRecords = await getDriversLicenses();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await approveDriversLicense(id);
        break;
      case "vehicle":
        applicationRecords = await getVehicleRegistrations();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await approveVehicleRegistration(id);
        break;
      case "insurance":
        applicationRecords = await getInsurancePolicies();
        applicationRecord = applicationRecords.find((r) => r.id === id);
        await approveInsurancePolicy(id);
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

    // 承認履歴を記録
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
        action: "approved",
        approver_id: currentUser.id || currentUser.email || "",
        approver_name: currentUser.name || currentUser.email || "不明",
        timestamp: Date.now(),
      });

      // 許可証の自動発行チェック（全書類が承認済みの場合）
      let allApproved = false;
      if (applicationRecord.employee_id) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

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
          // 書類番号を取得
          let documentNumber = "";
          if (type === "license" && applicationRecord.license_number) {
            documentNumber = applicationRecord.license_number;
          } else if (type === "vehicle" && applicationRecord.vehicle_number) {
            documentNumber = applicationRecord.vehicle_number;
          } else if (type === "insurance" && applicationRecord.policy_number) {
            documentNumber = applicationRecord.policy_number;
          }

          await sendApprovalNotification(
            openId,
            type as "license" | "vehicle" | "insurance",
            documentNumber,
            allApproved
          );
          console.log(`承認通知を送信しました: ${applicationRecord.employee_id}`);
        } else {
          console.log(`Lark Open IDが見つからないため通知をスキップ: ${applicationRecord.employee_id}`);
        }
      } catch (notifyError) {
        // 通知エラーは承認処理に影響させない
        console.error("承認通知の送信に失敗:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Application approved successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/approvals/:id:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to approve application",
      },
      { status: 500 }
    );
  }
}
