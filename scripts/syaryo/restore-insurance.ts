/**
 * 削除済み保険証を復元するスクリプト
 * 実行: npx tsx scripts/restore-insurance.ts <ID>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { restoreInsurancePolicy, getDeletedInsurancePolicies } from "../services/insurance-policy.service";

async function main() {
  const id = process.argv[2];

  if (!id) {
    console.log("使用方法: npx tsx scripts/restore-insurance.ts <保険証ID>");
    console.log("\n削除済み保険証のIDを確認するには:");
    console.log("npx tsx scripts/check-deleted-insurance.ts");
    return;
  }

  console.log(`=== 保険証 ${id} を復元中 ===\n`);

  try {
    // まず削除済みかどうか確認
    const deletedPolicies = await getDeletedInsurancePolicies();
    const targetPolicy = deletedPolicies.find((p) => p.id === id);

    if (!targetPolicy) {
      console.log("指定されたIDの削除済み保険証が見つかりません。");
      console.log("正しいIDを指定しているか確認してください。");
      return;
    }

    console.log("復元対象:");
    console.log(`  社員ID: ${targetPolicy.employee_id}`);
    console.log(`  保険会社: ${targetPolicy.insurance_company || "未設定"}`);
    console.log(`  証券番号: ${targetPolicy.policy_number || "未設定"}`);
    console.log("");

    await restoreInsurancePolicy(id);

    console.log("保険証を復元しました！");

  } catch (error) {
    console.error("エラー:", error);
  }
}

main();
