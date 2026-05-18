import { NextResponse } from 'next/server';
import { getLarkClient } from '@/lib/syaryo/lark-client';

/**
 * Lark Base接続テストAPI
 *
 * このエンドポイントは環境変数とLark Baseの接続をテストします
 * GET /api/test/lark-connection
 */
export async function GET() {
  try {
    // 環境変数チェック
    const requiredEnvVars = [
      'LARK_APP_ID',
      'LARK_APP_SECRET',
      'LARK_BASE_TOKEN',
      'LARK_TABLE_DRIVERS_LICENSES',
      'LARK_TABLE_VEHICLE_REGISTRATIONS',
      'LARK_TABLE_INSURANCE_POLICIES',
      'LARK_TABLE_EMPLOYEES',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '環境変数が設定されていません',
          missing: missingVars,
          message: `以下の環境変数を .env.local に設定してください: ${missingVars.join(', ')}`,
        },
        { status: 500 }
      );
    }

    // Larkクライアント初期化テスト
    const client = getLarkClient();

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: 'Larkクライアントの初期化に失敗しました',
          message: 'LARK_APP_IDまたはLARK_APP_SECRETが無効です',
        },
        { status: 500 }
      );
    }

    // テーブルアクセステスト（各テーブルから1件取得を試みる）
    const tableTests = [
      { name: 'drivers_licenses', id: process.env.LARK_TABLE_DRIVERS_LICENSES },
      { name: 'vehicle_registrations', id: process.env.LARK_TABLE_VEHICLE_REGISTRATIONS },
      { name: 'insurance_policies', id: process.env.LARK_TABLE_INSURANCE_POLICIES },
      { name: 'employees', id: process.env.LARK_TABLE_EMPLOYEES },
    ];

    const tableResults = [];

    for (const table of tableTests) {
      try {
        const response = await client.bitable.appTableRecord.list({
          path: {
            app_token: process.env.LARK_BASE_TOKEN!,
            table_id: table.id!,
          },
          params: {
            page_size: 1,
          },
        });

        tableResults.push({
          table: table.name,
          status: 'success',
          recordCount: response.data?.total || 0,
          message: `テーブル ${table.name} へのアクセスに成功しました`,
        });
      } catch (error: any) {
        tableResults.push({
          table: table.name,
          status: 'error',
          message: error.message || 'テーブルへのアクセスに失敗しました',
          errorCode: error.code,
          errorResponse: error.response?.data || error.response,
        });
      }
    }

    const allSuccess = tableResults.every((result) => result.status === 'success');

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? 'すべての接続テストに成功しました'
        : '一部の接続テストに失敗しました',
      environment: {
        LARK_APP_ID: process.env.LARK_APP_ID?.substring(0, 10) + '...',
        LARK_BASE_TOKEN: process.env.LARK_BASE_TOKEN?.substring(0, 10) + '...',
        NODE_ENV: process.env.NODE_ENV,
        // デバッグ用：テーブルID表示
        LARK_TABLE_INSURANCE_POLICIES: process.env.LARK_TABLE_INSURANCE_POLICIES,
      },
      tables: tableResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Lark接続テストエラー:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Lark Base接続テストに失敗しました',
        message: error.message || '不明なエラーが発生しました',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
