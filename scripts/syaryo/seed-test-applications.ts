/**
 * テスト用申請データ作成スクリプト
 * 承認履歴機能のテスト用に申請データを作成
 */

// Next.jsの環境変数読み込みを使用
import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

// テスト用従業員データ
const testEmployees = [
  {
    employee_id: "EMP001",
    employee_name: "山田太郎",
    department: "営業部",
  },
  {
    employee_id: "EMP002",
    employee_name: "佐藤花子",
    department: "開発部",
  },
  {
    employee_id: "EMP003",
    employee_name: "鈴木一郎",
    department: "総務部",
  },
];

async function seedTestData() {
  console.log("🌱 テストデータ作成開始...\n");

  // テーブルIDを環境変数から取得
  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";
  const VEHICLE_REGISTRATIONS_TABLE = process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || "";
  const INSURANCE_POLICIES_TABLE = process.env.LARK_TABLE_INSURANCE_POLICIES || "";

  // Larkクライアントを初期化（環境変数読み込み後）
  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  // レコード作成関数
  const createRecord = async (tableId: string, fields: Record<string, any>) => {
    return await larkClient.bitable.appTableRecord.create({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: tableId,
      },
      data: {
        fields,
      },
    });
  };

  const EMPLOYEES_TABLE = process.env.LARK_TABLE_EMPLOYEES || "";

  // 環境変数確認
  console.log("環境変数確認:");
  console.log("  LARK_BASE_TOKEN:", LARK_BASE_TOKEN || "未設定");
  console.log("  LARK_APP_ID:", process.env.LARK_APP_ID || "未設定");
  console.log("  LARK_APP_SECRET:", process.env.LARK_APP_SECRET ? "設定済み" : "未設定");
  console.log("  運転免許証テーブル:", DRIVERS_LICENSES_TABLE || "未設定");
  console.log("  車検証テーブル:", VEHICLE_REGISTRATIONS_TABLE || "未設定");
  console.log("  任意保険証テーブル:", INSURANCE_POLICIES_TABLE || "未設定");
  console.log("  従業員テーブル:", EMPLOYEES_TABLE || "未設定");
  console.log("");

  try {
    for (const employee of testEmployees) {
      console.log(`📝 ${employee.employee_name} (${employee.employee_id}) の申請を作成中...`);

      // 0. 従業員マスタにレコードを作成
      const employeeFields = {
        employee_id: employee.employee_id,
        name: employee.employee_name,
        department: employee.department,
        email: `${employee.employee_id.toLowerCase()}@example.com`,
        hire_date: new Date("2020-04-01").getTime(),
      };

      try {
        await createRecord(EMPLOYEES_TABLE, employeeFields);
        console.log(`  ✅ 従業員マスタ作成成功`);
      } catch (error: any) {
        console.log(`  ⚠️  従業員マスタ作成エラー: ${error.message}`);
      }

      // 1. 運転免許証申請を作成
      const licenseFields = {
        employee_id: employee.employee_id,
        license_number: `${employee.employee_id.replace("EMP", "")}-123456`,
        license_type: "普通自動車",
        expiration_date: new Date("2027-04-01").getTime(),
        status: "active",
        approval_status: "pending",
        deleted_flag: false,
      };

      const licenseResponse = await createRecord(DRIVERS_LICENSES_TABLE, licenseFields);
      console.log(`  ✅ 運転免許証: ${licenseResponse.data?.record?.record_id}`);

      // 2. 車検証申請を作成
      const vehicleFields = {
        employee_id: employee.employee_id,
        vehicle_number: `品川 300 あ ${employee.employee_id.replace("EMP", "")}`,
        manufacturer: "トヨタ",
        model_name: "プリウス",
        expiration_date: new Date("2026-03-31").getTime(),
        owner_name: employee.employee_name,
        status: "active",
        approval_status: "pending",
        deleted_flag: false,
      };

      const vehicleResponse = await createRecord(VEHICLE_REGISTRATIONS_TABLE, vehicleFields);
      if (!vehicleResponse.data?.record?.record_id) {
        console.log(`  ⚠️  車検証: レコード作成エラー - code: ${vehicleResponse.code}, msg: ${vehicleResponse.msg}`);
      } else {
        console.log(`  ✅ 車検証: ${vehicleResponse.data?.record?.record_id}`);
      }

      // 3. 任意保険証申請を作成
      const insuranceFields = {
        employee_id: employee.employee_id,
        policy_number: `INS-${employee.employee_id.replace("EMP", "")}-2024`,
        insurance_company: "東京海上日動",
        policy_type: "自動車保険",
        coverage_start_date: new Date("2024-04-01").getTime(),
        coverage_end_date: new Date("2025-03-31").getTime(),
        status: "active",
        approval_status: "pending",
        deleted_flag: false,
        created_at: Date.now(),
      };

      const insuranceResponse = await createRecord(INSURANCE_POLICIES_TABLE, insuranceFields);
      if (!insuranceResponse.data?.record?.record_id) {
        console.log(`  ⚠️  任意保険証: レコード作成エラー - code: ${insuranceResponse.code}, msg: ${insuranceResponse.msg}`);
      } else {
        console.log(`  ✅ 任意保険証: ${insuranceResponse.data?.record?.record_id}`);
      }

      console.log("");
    }

    console.log("✨ テストデータ作成完了！");
    console.log("\n📊 作成されたデータ:");
    console.log(`  - 従業員: ${testEmployees.length}名`);
    console.log(`  - 運転免許証申請: ${testEmployees.length}件`);
    console.log(`  - 車検証申請: ${testEmployees.length}件`);
    console.log(`  - 任意保険証申請: ${testEmployees.length}件`);
    console.log(`  - 合計申請数: ${testEmployees.length * 3}件`);
    console.log("\n🔗 確認URL: http://localhost:3005/admin/applications");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

// 実行
seedTestData()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
