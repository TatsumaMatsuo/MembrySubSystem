/**
 * 削除済み保険証を確認するスクリプト
 * 実行: npx tsx scripts/check-deleted-insurance.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { getDeletedInsurancePolicies } from "../services/insurance-policy.service";

async function main() {
  console.log("=== 削除済み保険証を確認中 ===\n");

  try {
    const deletedPolicies = await getDeletedInsurancePolicies();

    if (deletedPolicies.length === 0) {
      console.log("削除済みの保険証はありません。");
      return;
    }

    console.log(`削除済み保険証: ${deletedPolicies.length}件\n`);

    deletedPolicies.forEach((policy, index) => {
      console.log(`--- ${index + 1}. ---`);
      console.log(`  ID: ${policy.id}`);
      console.log(`  社員ID: ${policy.employee_id}`);
      console.log(`  保険会社: ${policy.insurance_company || "未設定"}`);
      console.log(`  証券番号: ${policy.policy_number || "未設定"}`);
      console.log(`  有効期間: ${policy.coverage_start_date?.toLocaleDateString("ja-JP")} ～ ${policy.coverage_end_date?.toLocaleDateString("ja-JP")}`);
      console.log(`  削除日時: ${policy.deleted_at?.toLocaleString("ja-JP") || "不明"}`);
      console.log("");
    });

    console.log("\n復元するには以下のコマンドを実行してください:");
    console.log("npx tsx scripts/restore-insurance.ts <ID>");

  } catch (error) {
    console.error("エラー:", error);
  }
}

main();
