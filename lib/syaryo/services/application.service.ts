import { ApplicationOverview, DriversLicense, VehicleRegistration, InsurancePolicy, MembershipType } from "@/types/syaryo";
import { getBaseRecords } from "@/lib/syaryo/lark-client";
import { LARK_TABLES, EMPLOYEE_FIELDS, USER_SEARCH_TABLE_ID, EMPLOYEE_MASTER_FIELDS } from "@/lib/syaryo/lark-tables";

/**
 * 統合ビュー: 社員の申請情報を3テーブル結合で取得
 * 1:多対応: vehicles, insurances は配列で返す
 */
export async function getApplicationOverview(
  employeeId?: string
): Promise<ApplicationOverview[]> {
  try {
    // 各テーブルからデータを取得
    const [licensesResponse, vehiclesResponse, insurancesResponse, employeesResponse] =
      await Promise.all([
        getBaseRecords(LARK_TABLES.DRIVERS_LICENSES, {
          filter: employeeId
            ? `CurrentValue.[employee_id]="${employeeId}"`
            : undefined,
        }),
        getBaseRecords(LARK_TABLES.VEHICLE_REGISTRATIONS, {
          filter: employeeId
            ? `CurrentValue.[employee_id]="${employeeId}"`
            : undefined,
        }),
        getBaseRecords(LARK_TABLES.INSURANCE_POLICIES, {
          filter: employeeId
            ? `CurrentValue.[employee_id]="${employeeId}"`
            : undefined,
        }),
        getBaseRecords(USER_SEARCH_TABLE_ID, {
          filter: employeeId
            ? `CurrentValue.[${EMPLOYEE_MASTER_FIELDS.employee_id}]="${employeeId}"`
            : undefined,
          pageSize: 500,
        }),
      ]);

    // 免許証: 1:1なのでMapでOK（最初の1件を使用）
    const licensesMap = new Map<string, DriversLicense>();
    console.log(`DEBUG: licensesResponse items count: ${licensesResponse.data?.items?.length || 0}`);
    if ((licensesResponse.data?.items?.length ?? 0) > 0) {
      console.log(`DEBUG: First license item fields:`, JSON.stringify(licensesResponse.data!.items![0].fields, null, 2));
    }
    licensesResponse.data?.items
      ?.filter((item: any) => item.fields.deleted_flag !== true)
      ?.forEach((item: any) => {
        const empId = item.fields.employee_id;
        // 1:1なので最初の1件だけ保存
        if (!licensesMap.has(empId)) {
          licensesMap.set(empId, {
            id: item.record_id,
            employee_id: item.fields.employee_id,
            license_number: item.fields.license_number,
            license_type: item.fields.license_type,
            issue_date: item.fields.issue_date ? new Date(item.fields.issue_date) : undefined,
            expiration_date: item.fields.expiration_date ? new Date(item.fields.expiration_date) : undefined,
            image_attachment: item.fields.image_attachment,
            status: item.fields.status,
            approval_status: item.fields.approval_status,
            rejection_reason: item.fields.rejection_reason,
            created_at: item.fields.created_at ? new Date(item.fields.created_at) : undefined,
            updated_at: item.fields.updated_at ? new Date(item.fields.updated_at) : undefined,
            deleted_flag: false,
          } as DriversLicense);
        }
      });

    // 車検証: 1:多なので配列でグループ化
    const vehiclesMap = new Map<string, VehicleRegistration[]>();
    vehiclesResponse.data?.items
      ?.filter((item: any) => item.fields.deleted_flag !== true)
      ?.forEach((item: any) => {
        const empId = item.fields.employee_id;
        const vehicle: VehicleRegistration = {
          id: item.record_id,
          employee_id: item.fields.employee_id,
          vehicle_number: item.fields.vehicle_number,
          vehicle_type: item.fields.vehicle_type,
          manufacturer: item.fields.manufacturer,
          model_name: item.fields.model_name,
          inspection_expiration_date: item.fields.expiration_date ? new Date(item.fields.expiration_date) : undefined,
          owner_name: item.fields.owner_name,
          image_attachment: item.fields.image_attachment,
          status: item.fields.status,
          approval_status: item.fields.approval_status,
          rejection_reason: item.fields.rejection_reason,
          created_at: item.fields.created_at ? new Date(item.fields.created_at) : undefined,
          updated_at: item.fields.updated_at ? new Date(item.fields.updated_at) : undefined,
          deleted_flag: false,
        } as VehicleRegistration;

        if (!vehiclesMap.has(empId)) {
          vehiclesMap.set(empId, []);
        }
        vehiclesMap.get(empId)!.push(vehicle);
      });

    // 保険証: 1:多なので配列でグループ化
    const insurancesMap = new Map<string, InsurancePolicy[]>();
    insurancesResponse.data?.items
      ?.filter((item: any) => item.fields.deleted_flag !== true)
      ?.forEach((item: any) => {
        const empId = item.fields.employee_id;
        const insurance: InsurancePolicy = {
          id: item.record_id,
          employee_id: item.fields.employee_id,
          policy_number: item.fields.policy_number,
          insurance_company: item.fields.insurance_company,
          policy_type: item.fields.policy_type,
          coverage_start_date: item.fields.coverage_start_date ? new Date(item.fields.coverage_start_date) : undefined,
          coverage_end_date: item.fields.coverage_end_date ? new Date(item.fields.coverage_end_date) : undefined,
          insured_amount: item.fields.insured_amount,
          // 補償内容フィールド（会社規定チェック用）
          liability_personal_unlimited: item.fields.liability_personal_unlimited || false,
          liability_property_amount: item.fields.liability_property_amount || 0,
          passenger_injury_amount: item.fields.passenger_injury_amount || 0,
          image_attachment: item.fields.image_attachment,
          status: item.fields.status,
          approval_status: item.fields.approval_status,
          rejection_reason: item.fields.rejection_reason,
          created_at: item.fields.created_at ? new Date(item.fields.created_at) : undefined,
          updated_at: item.fields.updated_at ? new Date(item.fields.updated_at) : undefined,
          deleted_flag: false,
        } as InsurancePolicy;

        if (!insurancesMap.has(empId)) {
          insurancesMap.set(empId, []);
        }
        insurancesMap.get(empId)!.push(insurance);
      });

    // 社員マスタを基準に結合
    // 社員マスタのフィールド名は日本語（社員コード、社員名など）
    console.log('DEBUG: Employees count:', employeesResponse.data?.items?.length || 0);
    console.log('DEBUG: Licenses count:', licensesResponse.data?.items?.length || 0);
    console.log('DEBUG: Vehicles count:', vehiclesResponse.data?.items?.length || 0);
    console.log('DEBUG: Insurances count:', insurancesResponse.data?.items?.length || 0);

    const overviewsRaw =
      employeesResponse.data?.items
        ?.map((item: any): ApplicationOverview | null => {
          // 社員マスタのフィールド名からemployee_idを取得
          const empId = item.fields[EMPLOYEE_MASTER_FIELDS.employee_id] || item.fields.employee_id;

          // 社員名フィールド（直接フィールドまたはPeopleフィールドから取得）
          const directName = item.fields[EMPLOYEE_MASTER_FIELDS.employee_name];
          const peopleField = item.fields[EMPLOYEE_MASTER_FIELDS.people_field];
          let empName = "不明";
          if (directName && typeof directName === "string") {
            empName = directName;
          } else if (Array.isArray(peopleField) && peopleField[0]?.name) {
            empName = peopleField[0].name;
          } else if (peopleField && typeof peopleField === "object" && peopleField.name) {
            empName = peopleField.name;
          }

          // メールを取得（Peopleフィールドまたは直接フィールドから）
          let email = "";
          if (Array.isArray(peopleField) && peopleField[0]?.email) {
            email = peopleField[0].email;
          } else if (peopleField && typeof peopleField === "object" && peopleField.email) {
            email = peopleField.email;
          } else {
            email = item.fields[EMPLOYEE_MASTER_FIELDS.email] || "";
          }

          // 部署を取得
          let department = "";
          const deptField = item.fields[EMPLOYEE_MASTER_FIELDS.department];
          if (Array.isArray(deptField)) {
            department = deptField.join(", ");
          } else if (typeof deptField === "string") {
            department = deptField;
          }

          // 社員コードで書類を検索
          const license = licensesMap.get(empId) || null;
          const vehicles = vehiclesMap.get(empId) || [];
          const insurances = insurancesMap.get(empId) || [];

          console.log(`DEBUG: Employee ${empId} (${empName}):`, {
            hasLicense: !!license,
            vehicleCount: vehicles.length,
            insuranceCount: insurances.length,
          });

          // いずれかの書類がある場合のみ返す
          if (!license && vehicles.length === 0 && insurances.length === 0) {
            console.log(`DEBUG: Skipping employee ${empId} - no documents`);
            return null;
          }

          // 退職フラグ
          const isResigned = item.fields[EMPLOYEE_MASTER_FIELDS.resigned_flag] === true;

          return {
            employee: {
              employee_id: empId,
              employee_name: empName,
              email: email,
              department: department,
              role: "applicant",
              membership_type: (item.fields[EMPLOYEE_FIELDS.membership_type] || "internal") as MembershipType,
              employment_status: isResigned ? "resigned" : "active",
              hire_date: undefined,
              resignation_date: undefined,
              created_at: undefined,
              updated_at: undefined,
            },
            license,
            vehicles,
            insurances,
          };
        }) || [];

    const overviews: ApplicationOverview[] = overviewsRaw.filter(
      (item): item is ApplicationOverview => item !== null
    );

    return overviews;
  } catch (error) {
    console.error("Error fetching application overview:", error);
    throw error;
  }
}

/**
 * 承認待ちの申請一覧を取得
 *
 * 表示条件:
 * - 新規申請: 3つの書類（免許証・車検証・保険証）が全て揃っている場合のみ表示
 * - 更新申請（既に承認済み書類がある場合）: 単独の書類更新でも表示
 */
export async function getPendingApplications(): Promise<ApplicationOverview[]> {
  try {
    const overviews = await getApplicationOverview();

    return overviews.filter((overview) => {
      // pending状態の書類をチェック
      const licensePending = overview.license?.approval_status === "pending";
      const vehiclePending = overview.vehicles.some(v => v.approval_status === "pending");
      const insurancePending = overview.insurances.some(i => i.approval_status === "pending");

      // いずれかの書類がpendingでなければ対象外
      const hasPending = licensePending || vehiclePending || insurancePending;
      if (!hasPending) {
        return false;
      }

      // 既に承認済みの書類があるかチェック（更新申請かどうかの判定）
      const hasApprovedLicense = overview.license?.approval_status === "approved";
      const hasApprovedVehicle = overview.vehicles.some(v => v.approval_status === "approved");
      const hasApprovedInsurance = overview.insurances.some(i => i.approval_status === "approved");
      const isUpdateApplication = hasApprovedLicense || hasApprovedVehicle || hasApprovedInsurance;

      if (isUpdateApplication) {
        // 更新申請: いずれかがpendingなら表示（単独更新OK）
        return true;
      } else {
        // 新規申請: 3つの書類が全て揃っている場合のみ表示
        const hasLicense = overview.license !== null;
        const hasVehicle = overview.vehicles.length > 0;
        const hasInsurance = overview.insurances.length > 0;
        return hasLicense && hasVehicle && hasInsurance;
      }
    });
  } catch (error) {
    console.error("Error fetching pending applications:", error);
    throw error;
  }
}

/**
 * 全て承認済みの申請一覧を取得
 */
export async function getApprovedApplications(): Promise<ApplicationOverview[]> {
  try {
    const overviews = await getApplicationOverview();

    // 全て承認済みの申請のみフィルタ
    return overviews.filter((overview) => {
      // 免許証が承認済み
      const licenseApproved = overview.license?.approval_status === "approved";
      // 車検証がすべて承認済み（1件以上必須）
      const vehiclesApproved = overview.vehicles.length > 0 &&
        overview.vehicles.every(v => v.approval_status === "approved");
      // 保険証がすべて承認済み（1件以上必須）
      const insurancesApproved = overview.insurances.length > 0 &&
        overview.insurances.every(i => i.approval_status === "approved");

      return licenseApproved && vehiclesApproved && insurancesApproved;
    });
  } catch (error) {
    console.error("Error fetching approved applications:", error);
    throw error;
  }
}
