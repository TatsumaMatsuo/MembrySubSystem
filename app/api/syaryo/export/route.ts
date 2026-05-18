import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/syaryo/auth-utils";
import { getDriversLicenses } from "@/lib/syaryo/services/drivers-license.service";
import { getVehicleRegistrations } from "@/lib/syaryo/services/vehicle-registration.service";
import { getInsurancePolicies } from "@/lib/syaryo/services/insurance-policy.service";
import { getApprovalHistory } from "@/lib/syaryo/services/approval-history.service";
import { getEmployees } from "@/lib/syaryo/services/employee.service";

// 社員名マップのキャッシュ
let employeeNameMap: Map<string, string> | null = null;

/**
 * 社員名マップを取得（全社員を対象、退職者含む）
 * employee_id（社員コード）とemail（メールアドレス）の両方でマッピング
 */
async function getEmployeeNameMap(): Promise<Map<string, string>> {
  if (employeeNameMap) return employeeNameMap;

  // includeResigned=true で退職者も含めて取得
  const employees = await getEmployees(true);
  employeeNameMap = new Map();

  console.log(`[Export] Building employee name map: ${employees.length} employees found`);

  for (const emp of employees) {
    if (emp.employee_name) {
      // 社員コード（employee_id）でマッピング
      if (emp.employee_id) {
        employeeNameMap.set(emp.employee_id, emp.employee_name);
        console.log(`[Export] Map entry (id): "${emp.employee_id}" -> "${emp.employee_name}"`);
      }
      // メールアドレス（email）でもマッピング
      if (emp.email) {
        employeeNameMap.set(emp.email, emp.employee_name);
        console.log(`[Export] Map entry (email): "${emp.email}" -> "${emp.employee_name}"`);
      }
    }
  }

  console.log(`[Export] Employee name map size: ${employeeNameMap.size}`);

  return employeeNameMap;
}

type ExportType = "licenses" | "vehicles" | "insurance" | "history" | "all";
type ExportFormat = "csv" | "xlsx";

interface ExportOptions {
  type: ExportType;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
}

/**
 * 日付をフォーマット（YYYY/MM/DD形式）
 */
function formatDate(date: Date | string | number | undefined | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  // 1970年より前の日付は無効とみなす
  if (d.getFullYear() < 1970) return "";
  return d.toLocaleDateString("ja-JP");
}

/**
 * 日時をフォーマット（YYYY/MM/DD HH:mm形式）
 */
function formatDateTime(date: Date | string | number | undefined | null): string {
  console.log(`[formatDateTime] INPUT: ${date}, type: ${typeof date}`);
  if (!date) {
    console.log(`[formatDateTime] EMPTY INPUT`);
    return "";
  }
  try {
    const d = new Date(date);
    console.log(`[formatDateTime] Date object: ${d}, getTime: ${d.getTime()}, year: ${d.getFullYear()}`);
    if (isNaN(d.getTime())) {
      console.log(`[formatDateTime] INVALID DATE (NaN)`);
      return "";
    }
    // 1970年より前の日付は無効とみなす
    if (d.getFullYear() < 1970) {
      console.log(`[formatDateTime] YEAR < 1970: ${d.getFullYear()}`);
      return "";
    }

    // 手動フォーマット
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");

    const result = `${year}/${month}/${day} ${hour}:${minute}`;
    console.log(`[formatDateTime] RESULT: ${result}`);
    return result;
  } catch (error) {
    console.error("[formatDateTime] ERROR:", error, "input:", date);
    return "";
  }
}

/**
 * 承認ステータスを日本語に変換
 */
function formatStatus(status: string): string {
  switch (status) {
    case "approved": return "承認済み";
    case "pending": return "審査中";
    case "rejected": return "却下";
    default: return status;
  }
}

/**
 * 免許証データを変換
 */
async function getLicenseData() {
  const licenses = await getDriversLicenses();
  const nameMap = await getEmployeeNameMap();

  console.log(`[Export] License data: ${licenses.length} records`);

  return licenses.map(license => {
    const employeeName = nameMap.get(license.employee_id) || "";
    console.log(`[Export] License lookup: employee_id="${license.employee_id}" -> name="${employeeName}"`);
    return {
      "社員ID": license.employee_id,
      "社員名": employeeName,
      "免許番号": license.license_number,
      "有効期限": formatDate(license.expiration_date),
      "承認状態": formatStatus(license.approval_status),
      "却下理由": license.rejection_reason || "",
      "登録日時": formatDateTime(license.created_at),
      "更新日時": formatDateTime(license.updated_at),
    };
  });
}

/**
 * 車両データを変換
 */
async function getVehicleData() {
  const vehicles = await getVehicleRegistrations();
  const nameMap = await getEmployeeNameMap();

  console.log(`[Export] Vehicle data: ${vehicles.length} records`);

  return vehicles.map(vehicle => {
    const employeeName = nameMap.get(vehicle.employee_id) || "";
    console.log(`[Export] Vehicle lookup: employee_id="${vehicle.employee_id}" -> name="${employeeName}"`);
    return {
      "社員ID": vehicle.employee_id,
      "社員名": employeeName,
      "車両番号": vehicle.vehicle_number,
      "メーカー": vehicle.manufacturer || "",
      "車名": vehicle.model_name || "",
      "車検有効期限": formatDate(vehicle.inspection_expiration_date),
      "承認状態": formatStatus(vehicle.approval_status),
      "却下理由": vehicle.rejection_reason || "",
      "登録日時": formatDateTime(vehicle.created_at),
      "更新日時": formatDateTime(vehicle.updated_at),
    };
  });
}

/**
 * 保険データを変換
 */
async function getInsuranceData() {
  const insurances = await getInsurancePolicies();
  const nameMap = await getEmployeeNameMap();

  console.log(`[Export] Insurance data: ${insurances.length} records`);

  return insurances.map(insurance => {
    const employeeName = nameMap.get(insurance.employee_id) || "";
    console.log(`[Export] Insurance lookup: employee_id="${insurance.employee_id}" -> name="${employeeName}"`);
    return {
      "社員ID": insurance.employee_id,
      "社員名": employeeName,
      "証券番号": insurance.policy_number,
      "保険会社": insurance.insurance_company || "",
      "補償開始日": formatDate(insurance.coverage_start_date),
      "補償終了日": formatDate(insurance.coverage_end_date),
      "対人賠償（無制限）": insurance.liability_personal_unlimited ? "はい" : "いいえ",
      "対物賠償（万円）": insurance.liability_property_amount || "",
      "搭乗者傷害（万円）": insurance.passenger_injury_amount || "",
      "承認状態": formatStatus(insurance.approval_status),
      "登録日時": formatDateTime(insurance.created_at),
      "更新日時": formatDateTime(insurance.updated_at),
    };
  });
}

/**
 * 承認履歴データを変換
 */
async function getHistoryData(startDate?: string, endDate?: string) {
  const history = await getApprovalHistory();

  console.log(`[Export] History data: ${history.length} records`);

  // timestampまたはcreated_atを使用してフィルタリング
  let filtered = history;
  if (startDate) {
    const start = new Date(startDate).getTime();
    filtered = filtered.filter(h => {
      const ts = h.timestamp || h.created_at;
      return ts ? ts >= start : true; // timestampがない場合は除外しない
    });
  }
  if (endDate) {
    const end = new Date(endDate).getTime() + 86400000; // 終了日の翌日まで
    filtered = filtered.filter(h => {
      const ts = h.timestamp || h.created_at;
      return ts ? ts < end : true; // timestampがない場合は除外しない
    });
  }

  console.log(`[Export] History filtered: ${filtered.length} records`);

  return filtered.map(record => {
    // timestampがない場合はcreated_atを使用
    const displayTimestamp = record.timestamp || record.created_at;
    console.log(`[Export] History record: timestamp=${record.timestamp}, created_at=${record.created_at}, display=${displayTimestamp}, formatted="${formatDateTime(displayTimestamp)}"`);
    return {
      "日時": formatDateTime(displayTimestamp),
      "社員ID": record.employee_id,
      "社員名": record.employee_name,
      "書類種別": record.application_type === "license" ? "免許証" :
                 record.application_type === "vehicle" ? "車検証" : "保険証",
      "アクション": record.action === "approved" ? "承認" : "却下",
      "承認者ID": record.approver_id,
      "承認者名": record.approver_name,
      "却下理由": record.reason || "",
    };
  });
}

/**
 * ワークブックを作成
 */
function createWorkbook(data: Record<string, any[]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  for (const [sheetName, sheetData] of Object.entries(data)) {
    if (sheetData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(sheetData);

      // 列幅を自動調整
      const colWidths = Object.keys(sheetData[0]).map(key => ({
        wch: Math.max(key.length * 2, 12)
      }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  return wb;
}

/**
 * GET /api/export
 * データをCSV/Excel形式でエクスポート
 */
export async function GET(request: NextRequest) {
  // 管理者権限チェック
  const authCheck = await requireAdmin();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    // キャッシュをリセット（リクエストごとに最新データを取得）
    employeeNameMap = null;

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "all") as ExportType;
    const format = (searchParams.get("format") || "xlsx") as ExportFormat;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // データを取得
    const data: Record<string, any[]> = {};

    if (type === "licenses" || type === "all") {
      data["免許証"] = await getLicenseData();
    }
    if (type === "vehicles" || type === "all") {
      data["車検証"] = await getVehicleData();
    }
    if (type === "insurance" || type === "all") {
      data["保険証"] = await getInsuranceData();
    }
    if (type === "history" || type === "all") {
      data["承認履歴"] = await getHistoryData(startDate, endDate);
    }

    // 空データチェック
    const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    if (totalRecords === 0) {
      return NextResponse.json(
        { success: false, error: "エクスポートするデータがありません" },
        { status: 404 }
      );
    }

    // ワークブック作成
    const wb = createWorkbook(data);

    // ファイル名生成
    const timestamp = new Date().toISOString().slice(0, 10);
    const typeLabel = type === "all" ? "全データ" :
                      type === "licenses" ? "免許証" :
                      type === "vehicles" ? "車検証" :
                      type === "insurance" ? "保険証" : "承認履歴";
    const filename = `${typeLabel}_${timestamp}.${format}`;

    if (format === "csv") {
      // CSVの場合は最初のシートのみ
      const firstSheet = Object.keys(data)[0];
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet]);

      // BOM付きUTF-8でCSV出力（日本語文字化け対策）
      const bom = "\uFEFF";
      const csvWithBom = bom + csv;

      return new NextResponse(csvWithBom, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } else {
      // Excel形式
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { success: false, error: "エクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
