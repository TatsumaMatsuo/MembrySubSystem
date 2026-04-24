/**
 * 従業員マスタ確認スクリプト
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkEmployees() {
  console.log("👥 従業員マスタ確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const EMPLOYEES_TABLE = process.env.LARK_TABLE_EMPLOYEES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    // フィールド定義確認
    console.log("📋 フィールド定義:");
    const fieldsResponse = await larkClient.bitable.appTableField.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: EMPLOYEES_TABLE,
      },
    });

    fieldsResponse.data?.items?.forEach((field: any) => {
      console.log(`  - ${field.field_name} (${field.type})`);
    });
    console.log("");

    // データ確認
    console.log("👤 従業員データ:");
    const response = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: EMPLOYEES_TABLE,
      },
      params: {
        page_size: 10,
      },
    });

    const employees = response.data?.items || [];
    console.log(`  総件数: ${employees.length}\n`);

    // 新しいフィールド名
    const EMPLOYEE_FIELD_NAMES = {
      employee_id: "社員コード",
      employee_name: "社員名 (メンバー )",
      email: "社員名 (メンバー ).仕事用メールアドレス",
      department: "社員名 (メンバー ).部署",
    };

    employees.forEach((emp: any, index: number) => {
      console.log(`${index + 1}. ${emp.fields[EMPLOYEE_FIELD_NAMES.employee_name]} (${emp.fields[EMPLOYEE_FIELD_NAMES.employee_id]})`);
      console.log(`   部署: ${emp.fields[EMPLOYEE_FIELD_NAMES.department]}`);
      console.log(`   メール: ${emp.fields[EMPLOYEE_FIELD_NAMES.email]}`);
      console.log(`   record_id: ${emp.record_id}`);
      console.log(`   全フィールド:`, JSON.stringify(emp.fields, null, 2));
      console.log("");
    });

    if (employees.length === 0) {
      console.log("⚠️  従業員マスタにデータがありません");
      console.log("💡 スクリプトで従業員データが作成されていない可能性があります");
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkEmployees()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
