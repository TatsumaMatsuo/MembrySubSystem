/**
 * テストデータ作成スクリプト
 *
 * 社員2名を作成し、各社員に対して：
 * - 免許証: 1件
 * - 車両: 2件
 * - 保険証: 2件（会社規定を満たすもの）
 */

const lark = require("@larksuiteoapi/node-sdk");
const fs = require('fs');
const path = require('path');

// .env.localから環境変数を読み込む
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

const client = new lark.Client({
  appId: env.LARK_APP_ID,
  appSecret: env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Feishu,
});

// 日付ヘルパー
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

// テストデータ定義
const testEmployees = [
  {
    employee_id: "EMP-TEST-001",
    employee_name: "田中 太郎",
  },
  {
    employee_id: "EMP-TEST-002",
    employee_name: "佐藤 花子",
  },
];

// 社員ごとのテストデータ生成（正しいフィールド名を使用）
function generateTestData(employeeId, employeeName) {
  const now = new Date();

  // 免許証データ（1件）
  // フィールド: employee_id, license_type, expiration_date, license_number, image_url, status, approval_status, deleted_flag
  const license = {
    employee_id: employeeId,
    license_number: `${Math.floor(Math.random() * 900000000000) + 100000000000}`,
    license_type: "普通自動車第一種",
    expiration_date: addYears(now, 2).getTime(),
    image_url: "test-license-image.jpg",
    status: "approved",
    approval_status: "approved",
    deleted_flag: false,
  };

  // 車両データ（2件）
  // フィールド: vehicle_number, employee_id, status, registration_date, manufacturer, model_name, owner_name, image_url, expiration_date, approval_status, deleted_flag
  const vehicles = [
    {
      employee_id: employeeId,
      vehicle_number: `品川 500 あ ${Math.floor(Math.random() * 9000) + 1000}`,
      manufacturer: "トヨタ",
      model_name: "プリウス",
      expiration_date: addYears(now, 1).getTime(),
      registration_date: addYears(now, -2).getTime(),
      owner_name: employeeName,
      image_url: "test-vehicle-image-1.jpg",
      status: "approved",
      approval_status: "approved",
      deleted_flag: false,
    },
    {
      employee_id: employeeId,
      vehicle_number: `横浜 300 か ${Math.floor(Math.random() * 9000) + 1000}`,
      manufacturer: "ホンダ",
      model_name: "N-BOX",
      expiration_date: addYears(now, 2).getTime(),
      registration_date: addYears(now, -1).getTime(),
      owner_name: employeeName,
      image_url: "test-vehicle-image-2.jpg",
      status: "approved",
      approval_status: "approved",
      deleted_flag: false,
    },
  ];

  // 保険データ（2件）- 会社規定を満たす
  // フィールド: policy_number, employee_id, status, coverage_start_date, insurance_company, policy_type, image_url, insured_amount, coverage_end_date, approval_status, deleted_flag, created_at, liability_personal_unlimited, liability_property_amount, passenger_injury_amount
  const insurances = [
    {
      employee_id: employeeId,
      policy_number: `INS-${Math.floor(Math.random() * 900000000) + 100000000}`,
      insurance_company: "東京海上日動火災保険",
      policy_type: "自動車保険",
      coverage_start_date: addDays(now, -180).getTime(),
      coverage_end_date: addDays(now, 185).getTime(),
      insured_amount: 10000,
      // 会社規定: 対人=無制限、対物≥5000万、搭乗者傷害≥2000万
      liability_personal_unlimited: true,
      liability_property_amount: 10000, // 1億円
      passenger_injury_amount: 3000, // 3000万円
      image_url: "test-insurance-image-1.jpg",
      status: "approved",
      approval_status: "approved",
      deleted_flag: false,
      created_at: now.getTime(),
    },
    {
      employee_id: employeeId,
      policy_number: `INS-${Math.floor(Math.random() * 900000000) + 100000000}`,
      insurance_company: "損保ジャパン日本興亜",
      policy_type: "自動車保険（車両保険付）",
      coverage_start_date: addDays(now, -90).getTime(),
      coverage_end_date: addDays(now, 275).getTime(),
      insured_amount: 15000,
      // 会社規定: 対人=無制限、対物≥5000万、搭乗者傷害≥2000万
      liability_personal_unlimited: true,
      liability_property_amount: 5000, // 5000万円（最低ライン）
      passenger_injury_amount: 2000, // 2000万円（最低ライン）
      image_url: "test-insurance-image-2.jpg",
      status: "approved",
      approval_status: "approved",
      deleted_flag: false,
      created_at: now.getTime(),
    },
  ];

  return { license, vehicles, insurances };
}

// レコード作成関数
async function createRecord(tableId, fields, tableName) {
  try {
    const response = await client.bitable.appTableRecord.create({
      path: {
        app_token: env.LARK_BASE_TOKEN,
        table_id: tableId,
      },
      data: { fields },
    });

    if (response.data?.record?.record_id) {
      console.log(`  ✅ ${tableName}: ${response.data.record.record_id}`);
      return response.data.record.record_id;
    } else if (response.code !== 0) {
      console.error(`  ❌ ${tableName}: ${response.msg}`);
      if (response.error?.message) {
        console.error(`     ${response.error.message}`);
      }
    }
  } catch (error) {
    console.error(`  ❌ ${tableName} 作成エラー:`, error.message);
  }
  return null;
}

// メイン処理
async function main() {
  console.log("=== テストデータ作成スクリプト ===\n");
  console.log("社員2名、各社員に対して：");
  console.log("  - 免許証: 1件");
  console.log("  - 車両: 2件");
  console.log("  - 保険証: 2件");
  console.log("\n作成開始...\n");

  const results = {
    employees: [],
    licenses: [],
    vehicles: [],
    insurances: [],
  };

  for (const employee of testEmployees) {
    console.log(`\n【${employee.employee_name}】を作成中...`);

    // 社員データ作成
    // フィールド: 社員コード, 社員名, 退職者フラグ
    const employeeFields = {
      "社員コード": employee.employee_id,
      "社員名": employee.employee_name,
      "退職者フラグ": false,
    };

    const empRecordId = await createRecord(
      env.LARK_TABLE_EMPLOYEES,
      employeeFields,
      "社員マスタ"
    );
    if (empRecordId) {
      results.employees.push({ id: empRecordId, data: employee });
    }

    // 関連データ生成
    const testData = generateTestData(employee.employee_id, employee.employee_name);

    // 免許証作成
    console.log("\n  免許証を作成中...");
    const licRecordId = await createRecord(
      env.LARK_TABLE_DRIVERS_LICENSES,
      testData.license,
      "免許証"
    );
    if (licRecordId) {
      results.licenses.push({ id: licRecordId, employee: employee.employee_id });
    }

    // 車両作成
    console.log("\n  車両を作成中...");
    for (let i = 0; i < testData.vehicles.length; i++) {
      const vehRecordId = await createRecord(
        env.LARK_TABLE_VEHICLE_REGISTRATIONS,
        testData.vehicles[i],
        `車両 ${i + 1}`
      );
      if (vehRecordId) {
        results.vehicles.push({
          id: vehRecordId,
          employee: employee.employee_id,
          number: testData.vehicles[i].vehicle_number
        });
      }
    }

    // 保険証作成
    console.log("\n  保険証を作成中...");
    for (let i = 0; i < testData.insurances.length; i++) {
      const insRecordId = await createRecord(
        env.LARK_TABLE_INSURANCE_POLICIES,
        testData.insurances[i],
        `保険証 ${i + 1}`
      );
      if (insRecordId) {
        results.insurances.push({
          id: insRecordId,
          employee: employee.employee_id,
          company: testData.insurances[i].insurance_company
        });
      }
    }
  }

  // 結果サマリー
  console.log("\n\n=== 作成完了 ===");
  console.log(`社員: ${results.employees.length}件`);
  console.log(`免許証: ${results.licenses.length}件`);
  console.log(`車両: ${results.vehicles.length}件`);
  console.log(`保険証: ${results.insurances.length}件`);

  if (results.employees.length > 0 || results.licenses.length > 0 || results.vehicles.length > 0 || results.insurances.length > 0) {
    console.log("\n作成されたデータ:");
    console.log(JSON.stringify(results, null, 2));
    console.log("\n✅ テストデータの作成が完了しました！");
    console.log("Lark Baseで確認してください。");
  } else {
    console.log("\n⚠️ データが作成されませんでした。エラーを確認してください。");
  }
}

main().catch(console.error);
