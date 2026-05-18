/**
 * 管理者ユーザー作成スクリプト
 * ユーザー権限テーブルに管理者を追加
 */

// Next.jsの環境変数読み込みを使用
import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as lark from "@larksuiteoapi/node-sdk";

const projectDir = path.join(__dirname, "..");
loadEnvConfig(projectDir);

async function seedAdminUser() {
  console.log("🔐 管理者ユーザー作成開始...\n");

  const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || "";
  const USER_PERMISSIONS_TABLE = process.env.LARK_TABLE_USER_PERMISSIONS || "";

  // Larkクライアントを初期化
  const larkClient = new lark.Client({
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  console.log("環境変数確認:");
  console.log("  LARK_BASE_TOKEN:", LARK_BASE_TOKEN || "未設定");
  console.log("  ユーザー権限テーブル:", USER_PERMISSIONS_TABLE || "未設定");
  console.log("");

  if (!USER_PERMISSIONS_TABLE) {
    console.error("❌ エラー: LARK_TABLE_USER_PERMISSIONS が設定されていません");
    process.exit(1);
  }

  try {
    // 既存のレコードを確認
    console.log("📋 既存のユーザー権限レコードを確認中...");
    const listResponse = await larkClient.bitable.appTableRecord.list({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: USER_PERMISSIONS_TABLE,
      },
    });

    console.log(`  既存レコード数: ${listResponse.data?.items?.length || 0}`);
    console.log("");

    // 管理者ユーザーを作成（メールアドレスベース）
    const adminFields = {
      lark_user_id: "tatsuma.m@yamaguchi-kk.co.jp",
      user_name: "松尾 達磨",
      user_email: "tatsuma.m@yamaguchi-kk.co.jp",
      role: "admin",
      granted_by: "system",
      granted_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    console.log("📝 管理者ユーザーを作成中...");
    const response = await larkClient.bitable.appTableRecord.create({
      path: {
        app_token: LARK_BASE_TOKEN,
        table_id: USER_PERMISSIONS_TABLE,
      },
      data: {
        fields: adminFields,
      },
    });

    console.log(`  ✅ 管理者ユーザー作成成功: ${response.data?.record?.record_id}`);
    console.log("");
    console.log("📋 作成された管理者情報:");
    console.log(`  - ユーザーID: ${adminFields.lark_user_id}`);
    console.log(`  - 名前: ${adminFields.user_name}`);
    console.log(`  - メール: ${adminFields.user_email}`);
    console.log(`  - 権限: ${adminFields.role}`);
    console.log("");
    console.log("✨ 管理者ユーザー作成完了！");
    console.log("");
    console.log("💡 次のステップ:");
    console.log("   1. Lark OAuth認証でログイン ( tatsuma.m@yamaguchi-kk.co.jp )");
    console.log("   2. 管理者画面にアクセス: http://localhost:3005/admin/applications");
    console.log("   3. 承認履歴ページにアクセス: http://localhost:3005/admin/history");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  }
}

// 実行
seedAdminUser()
  .then(() => {
    console.log("\n✅ スクリプト実行完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプト実行失敗:", error);
    process.exit(1);
  });
