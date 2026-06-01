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
import { getLarkNotificationTargetByEmployeeId } from "@/lib/syaryo/services/lark-user.service";

// AWS Amplify SSR でのタイムアウト延長（許可証PDF生成を含むため）
export const maxDuration = 60;

// 最大一括承認件数
const MAX_BULK_ITEMS = 50;

type DocType = "license" | "vehicle" | "insurance";

interface BulkApprovalItem {
  id: string;
  type: DocType;
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

interface PrefetchedLists {
  licenses: any[];
  vehicles: any[];
  insurances: any[];
}

/**
 * 全書類が承認済みかチェックし、許可証を発行
 * 事前取得済みのリストを渡すと再フェッチを省略する（パフォーマンス最適化）
 */
async function checkAndGeneratePermit(
  employeeId: string,
  baseUrl: string,
  prefetched?: PrefetchedLists
): Promise<void> {
  try {
    const licenses = prefetched?.licenses ?? (await getDriversLicenses(employeeId));
    const approvedLicense = licenses.find((l) => l.approval_status === "approved");
    if (!approvedLicense) return;

    const vehicles = prefetched?.vehicles ?? (await getVehicleRegistrations(employeeId));
    const approvedVehicles = vehicles.filter((v) => v.approval_status === "approved");
    if (approvedVehicles.length === 0) return;

    const insurances = prefetched?.insurances ?? (await getInsurancePolicies(employeeId));
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
          if (Math.abs(existingExpTime - newExpTime) < 86400000) {
            // 1日以内の差は同じとみなす
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

/** 書類種別に応じて承認処理を実行 */
async function approveByType(type: DocType, id: string): Promise<void> {
  switch (type) {
    case "license":
      await approveDriversLicense(id);
      break;
    case "vehicle":
      await approveVehicleRegistration(id);
      break;
    case "insurance":
      await approveInsurancePolicy(id);
      break;
  }
}

/** 申請レコードから書類番号を取得 */
function getDocumentNumber(record: any, type: DocType): string {
  if (type === "license") return record?.license_number || "";
  if (type === "vehicle") return record?.vehicle_number || "";
  if (type === "insurance") return record?.policy_number || "";
  return "";
}

/**
 * POST /api/approvals/bulk
 * 複数の申請を一括承認（管理者のみ）
 *
 * パフォーマンス最適化:
 * 1. 書類種別ごとに申請レコードを1回だけ取得（従来は項目ごとに全件取得）
 * 2. 承認・履歴記録を並列実行
 * 3. 許可証の発行は「社員ごとに最後に1回だけ」実行（従来は項目ごとに実行され、
 *    同一車両のPDFを多重生成してLambdaがタイムアウトしていた）
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
      return NextResponse.json({ success: false, error: "No items provided" }, { status: 400 });
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
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    // --- Phase 0: 申請レコードを書類種別ごとに1回だけ取得 ---
    const typesPresent = new Set(items.map((i) => i.type));
    const [allLicenses, allVehicles, allInsurances] = await Promise.all([
      typesPresent.has("license") ? getDriversLicenses() : Promise.resolve([]),
      typesPresent.has("vehicle") ? getVehicleRegistrations() : Promise.resolve([]),
      typesPresent.has("insurance") ? getInsurancePolicies() : Promise.resolve([]),
    ]);
    const recordMap = new Map<string, any>();
    allLicenses.forEach((r) => recordMap.set(`license-${r.id}`, r));
    allVehicles.forEach((r) => recordMap.set(`vehicle-${r.id}`, r));
    allInsurances.forEach((r) => recordMap.set(`insurance-${r.id}`, r));

    // 社員名を一括取得（同一社員の重複取得を回避）
    const employeeIds = Array.from(
      new Set(
        items
          .map((i) => recordMap.get(`${i.type}-${i.id}`)?.employee_id)
          .filter((v): v is string => !!v)
      )
    );
    const employeeNameMap = new Map<string, string>();
    await Promise.all(
      employeeIds.map(async (eid) => {
        try {
          const emp = await getEmployee(eid);
          employeeNameMap.set(eid, emp?.employee_name || "不明");
        } catch {
          employeeNameMap.set(eid, "不明");
        }
      })
    );

    // --- Phase 1: 承認 + 履歴記録（並列） ---
    interface ApprovedItem extends BulkApprovalResult {
      employeeId?: string;
      record?: any;
    }

    const results: ApprovedItem[] = await Promise.all(
      items.map(async (item): Promise<ApprovedItem> => {
        const record = recordMap.get(`${item.type}-${item.id}`);
        if (!record) {
          return { id: item.id, type: item.type, success: false, error: "Record not found" };
        }
        try {
          await approveByType(item.type, item.id);

          await recordApprovalHistory({
            application_type: item.type,
            application_id: item.id,
            employee_id: record.employee_id || "",
            employee_name: employeeNameMap.get(record.employee_id) || "不明",
            action: "approved",
            approver_id: currentUser.id || currentUser.email || "",
            approver_name: currentUser.name || currentUser.email || "不明",
            timestamp: Date.now(),
          });

          return {
            id: item.id,
            type: item.type,
            success: true,
            employeeId: record.employee_id,
            record,
          };
        } catch (error) {
          console.error(`Error approving ${item.type} ${item.id}:`, error);
          return {
            id: item.id,
            type: item.type,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // --- Phase 2: 社員ごとに許可証発行（1回だけ）+ 通知 ---
    const successByEmployee = new Map<string, ApprovedItem[]>();
    for (const r of results) {
      if (r.success && r.employeeId) {
        const list = successByEmployee.get(r.employeeId) || [];
        list.push(r);
        successByEmployee.set(r.employeeId, list);
      }
    }

    await Promise.all(
      Array.from(successByEmployee.entries()).map(async ([employeeId, empItems]) => {
        // 承認状況を1回だけ取得し、許可証発行判定と通知の両方に使う
        const [licenses, vehicles, insurances] = await Promise.all([
          getDriversLicenses(employeeId),
          getVehicleRegistrations(employeeId),
          getInsurancePolicies(employeeId),
        ]);

        const allApproved =
          licenses.some((l) => l.approval_status === "approved") &&
          vehicles.some((v) => v.approval_status === "approved") &&
          insurances.some((i) => i.approval_status === "approved");

        // 全書類が承認済みなら許可証を発行（社員ごとに1回）
        if (allApproved) {
          await checkAndGeneratePermit(employeeId, baseUrl, { licenses, vehicles, insurances });
        }

        // Lark Bot通知（Open ID 優先・email フォールバック）
        try {
          const target = await getLarkNotificationTargetByEmployeeId(employeeId);
          if (target && (target.openId || target.email)) {
            const sendOne = async (type: DocType, documentNumber: string) => {
              let result = target.openId
                ? await sendApprovalNotification(target.openId, type, documentNumber, allApproved, "open_id")
                : { ok: false };
              if (!result.ok && target.email) {
                result = await sendApprovalNotification(target.email, type, documentNumber, allApproved, "email");
              }
              return result;
            };

            if (allApproved) {
              // 全承認時は1通だけ送信（最後に承認した書類を代表に）
              const last = empItems[empItems.length - 1];
              await sendOne(last.type as DocType, getDocumentNumber(last.record, last.type as DocType));
            } else {
              // 一部承認時は承認した書類ごとに送信
              for (const it of empItems) {
                await sendOne(it.type as DocType, getDocumentNumber(it.record, it.type as DocType));
              }
            }
          }
        } catch (notifyError) {
          console.error("承認通知の送信に失敗:", notifyError);
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message: `${successCount}件の承認が完了しました${failedCount > 0 ? `（${failedCount}件失敗）` : ""}`,
      results: results.map((r) => ({ id: r.id, type: r.type, success: r.success, error: r.error })),
      summary: {
        total: items.length,
        success: successCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/approvals/bulk:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process bulk approval" },
      { status: 500 }
    );
  }
}
