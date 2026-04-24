/**
 * 全保険証レコードを確認するスクリプト（削除フラグの状態を含む）
 * 実行: npx tsx scripts/check-all-insurance.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { getBaseRecords } from "../lib/lark-client";
import { LARK_TABLES, INSURANCE_POLICY_FIELDS } from "../lib/lark-tables";

async function main() {
  console.log("=== 全保険証レコードを確認中 ===\n");

  try {
    // フィルターなしで全件取得
    const response = await getBaseRecords(LARK_TABLES.INSURANCE_POLICIES, {});

    const items = response.data?.items || [];
    console.log(`全レコード数: ${items.length}件\n`);

    if (items.length === 0) {
      console.log("保険証レコードがありません。");
      return;
    }

    // 削除済みと有効なレコードを分類
    const deletedItems = items.filter((item: any) =>
      item.fields[INSURANCE_POLICY_FIELDS.deleted_flag] === true
    );
    const activeItems = items.filter((item: any) =>
      item.fields[INSURANCE_POLICY_FIELDS.deleted_flag] !== true
    );

    console.log(`有効なレコード: ${activeItems.length}件`);
    console.log(`削除済みレコード: ${deletedItems.length}件\n`);

    console.log("=== 全レコード詳細 ===\n");
    items.forEach((item: any, index: number) => {
      const fields = item.fields;
      const isDeleted = fields[INSURANCE_POLICY_FIELDS.deleted_flag] === true;

      console.log(`--- ${index + 1}. ${isDeleted ? "[削除済み]" : "[有効]"} ---`);
      console.log(`  record_id: ${item.record_id}`);
      console.log(`  社員ID: ${fields[INSURANCE_POLICY_FIELDS.employee_id] || "未設定"}`);
      console.log(`  保険会社: ${fields[INSURANCE_POLICY_FIELDS.insurance_company] || "未設定"}`);
      console.log(`  証券番号: ${fields[INSURANCE_POLICY_FIELDS.policy_number] || "未設定"}`);
      console.log(`  deleted_flag: ${fields[INSURANCE_POLICY_FIELDS.deleted_flag]}`);
      console.log(`  deleted_at: ${fields[INSURANCE_POLICY_FIELDS.deleted_at] || "なし"}`);
      console.log("");
    });

  } catch (error) {
    console.error("エラー:", error);
  }
}

main();
