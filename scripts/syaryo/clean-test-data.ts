/**
 * テストデータ削除スクリプト
 * テスト用の申請データを削除
 */

import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function cleanTestData() {
  console.log("🧹 テストデータ削除開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const DRIVERS_LICENSES_TABLE = process.env.LARK_TABLE_DRIVERS_LICENSES || "";
  const VEHICLE_REGISTRATIONS_TABLE = process.env.LARK_TABLE_VEHICLE_REGISTRATIONS || "";
  const INSURANCE_POLICIES_TABLE = process.env.LARK_TABLE_INSURANCE_POLICIES || "";
  const EMPLOYEES_TABLE = process.env.LARK_TABLE_EMPLOYEES || "";

  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  const deleteRecords = async (tableId: string, tableName: string) => {
    console.log(`🔍 ${tableName}のレコードを取得中...`);
    const response = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: tableId,
      },
      params: {
        page_size: 100,
      },
    });

    const records = response.data?.items || [];
    console.log(`  レコード数: ${records.length}`);

    if (records.length === 0) {
      console.log(`  スキップ: レコードがありません\n`);
      return 0;
    }

    console.log(`  削除中...`);
    let deletedCount = 0;

    for (const record of records) {
      if (!record.record_id) {
        continue;
      }
      try {
        await larkClient.bitable.appTableRecord.delete({
          path: {
            app_token: LARK_BASE_TOKEN,
            table_id: tableId,
            record_id: record.record_id,
          },
        });
        deletedCount++;
      } catch (error) {
        console.log(`    ⚠️  削除失敗: ${record.record_id}`);
      }
    }

    console.log(`  ✅ 削除完了: ${deletedCount}件\n`);
    return deletedCount;
  };

  try {
    const licensesDeleted = await deleteRecords(DRIVERS_LICENSES_TABLE, "運転免許証");
    const vehiclesDeleted = await deleteRecords(VEHICLE_REGISTRATIONS_TABLE, "車検証");
    const insurancesDeleted = await deleteRecords(INSURANCE_POLICIES_TABLE, "任意保険証");
    const employeesDeleted = await deleteRecords(EMPLOYEES_TABLE, "従業員マスタ");

    console.log("📊 削除サマリー:");
    console.log(`  運転免許証: ${licensesDeleted}件`);
    console.log(`  車検証: ${vehiclesDeleted}件`);
    console.log(`  任意保険証: ${insurancesDeleted}件`);
    console.log(`  従業員マスタ: ${employeesDeleted}件`);
    console.log(`  合計: ${licensesDeleted + vehiclesDeleted + insurancesDeleted + employeesDeleted}件`);
    console.log("");
    console.log("✨ テストデータ削除完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

cleanTestData()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
