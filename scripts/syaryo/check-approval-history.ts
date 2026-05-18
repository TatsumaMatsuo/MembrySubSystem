/**
 * 承認履歴テーブル確認スクリプト
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function checkApprovalHistory() {
  console.log("🔍 承認履歴テーブル確認開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const LARK_APPROVAL_HISTORY_TABLE_ID = process.env.LARK_APPROVAL_HISTORY_TABLE_ID || "";

  console.log("環境変数:");
  console.log(`  LARK_BASE_TOKEN: ${LARK_BASE_TOKEN}`);
  console.log(`  LARK_APPROVAL_HISTORY_TABLE_ID: ${LARK_APPROVAL_HISTORY_TABLE_ID}`);
  console.log("");

  if (!LARK_APPROVAL_HISTORY_TABLE_ID) {
    console.error("❌ LARK_APPROVAL_HISTORY_TABLE_ID が設定されていません");
    return;
  }

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
        table_id: LARK_APPROVAL_HISTORY_TABLE_ID,
      },
    });

    fieldsResponse.data?.items?.forEach((field: any) => {
      console.log(`  - ${field.field_name} (${field.type})`);
    });
    console.log("");

    // データ確認
    console.log("📊 承認履歴データ:");
    const response = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: LARK_APPROVAL_HISTORY_TABLE_ID,
      },
      params: {
        page_size: 20,
      },
    });

    const items = response.data?.items || [];
    console.log(`  総件数: ${items.length}\n`);

    if (items.length === 0) {
      console.log("⚠️  承認履歴が記録されていません");
      console.log("💡 承認処理が実行されていないか、履歴記録に失敗している可能性があります");
    } else {
      items.forEach((item: any, index: number) => {
        console.log(`${index + 1}. record_id: ${item.record_id}`);
        console.log(`   application_type: ${item.fields.application_type}`);
        console.log(`   application_id: ${item.fields.application_id}`);
        console.log(`   employee_id: ${item.fields.employee_id}`);
        console.log(`   employee_name: ${item.fields.employee_name}`);
        console.log(`   action: ${item.fields.action}`);
        console.log(`   approver_id: ${item.fields.approver_id}`);
        console.log(`   approver_name: ${item.fields.approver_name}`);
        console.log(`   reason: ${item.fields.reason || "(なし)"}`);
        console.log(`   timestamp (raw): ${item.fields.timestamp}`);
        console.log(`   timestamp (type): ${typeof item.fields.timestamp}`);
        console.log(`   timestamp: ${item.fields.timestamp ? new Date(item.fields.timestamp).toLocaleString('ja-JP') : "(なし)"}`);
        console.log(`   created_at (raw): ${item.fields.created_at}`);
        console.log(`   created_at: ${item.fields.created_at ? new Date(item.fields.created_at).toLocaleString('ja-JP') : "(なし)"}`);
        console.log("");
      });
    }

    console.log("✨ 確認完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

checkApprovalHistory()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
