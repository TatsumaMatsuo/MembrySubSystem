/**
 * アプリケーション一覧取得デバッグスクリプト
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

// モジュールを遅延インポート
async function debugOverview() {
  console.log("🔍 アプリケーション一覧取得デバッグ開始...\n");

  try {
    // 動的インポート
    const { getApplicationOverview, getPendingApplications } = await import("../services/application.service");

    console.log("📋 全申請を取得中...");
    const allApplications = await getApplicationOverview();
    console.log(`  取得件数: ${allApplications.length}件\n`);

    if (allApplications.length === 0) {
      console.log("⚠️  申請データが0件です");
    } else {
      allApplications.forEach((app, index) => {
        console.log(`${index + 1}. ${app.employee.employee_name} (${app.employee.employee_id})`);
        console.log(`   部署: ${app.employee.department}`);
        console.log(`   運転免許証: ${app.license?.approval_status || "未登録"}`);
        console.log(`   車検証: ${app.vehicles.length}件 (${app.vehicles.map(v => v.approval_status).join(", ") || "なし"})`);
        console.log(`   任意保険証: ${app.insurances.length}件 (${app.insurances.map(i => i.approval_status).join(", ") || "なし"})`);
        console.log("");
      });
    }

    console.log("📋 承認待ち申請を取得中...");
    const pendingApplications = await getPendingApplications();
    console.log(`  取得件数: ${pendingApplications.length}件\n`);

    console.log("✨ デバッグ完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

debugOverview()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
