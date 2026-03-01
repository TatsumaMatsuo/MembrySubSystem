/**
 * 売上BI API テストスクリプト
 * Issue #24: 売上BIに受注残データを反映
 */
const lark = require('@larksuiteoapi/node-sdk');
require('dotenv').config();

const client = new lark.Client({
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
});

const BACKLOG_TABLE_ID = 'tbl1ICzfUixpGqDy';
const SALES_TABLE_ID = 'tbl65w6u6J72QFoz';

// 会計年度の月インデックスを計算（8月=0, 9月=1, ..., 7月=11）
function getFiscalMonthIndex(dateStr) {
  if (!dateStr) return -1;
  const match = dateStr.match(/(\d{4})\/(\d{1,2})/);
  if (!match) return -1;
  const month = parseInt(match[2], 10);
  // 8月=0, 9月=1, ..., 12月=4, 1月=5, ..., 7月=11
  return month >= 8 ? month - 8 : month + 4;
}

function getFiscalMonthName(index) {
  const months = ['8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'];
  return months[index] || '不明';
}

async function testSalesBIAPI() {
  console.log('=======================================================');
  console.log('  売上BI API テスト - Issue #24 受注残データ統合');
  console.log('=======================================================\n');

  // 1. 売上データ取得テスト
  console.log('【1】売上データ取得テスト');
  console.log('-------------------------------------------');

  try {
    const salesResponse = await client.bitable.appTableRecord.list({
      path: {
        app_token: process.env.LARK_BASE_TOKEN,
        table_id: SALES_TABLE_ID,
      },
      params: {
        page_size: 50,
        filter: 'AND(CurrentValue.[売上日] >= "2025-08-01", CurrentValue.[売上日] <= "2026-07-31")',
        field_names: JSON.stringify(['製番', '売上日', '金額', '担当者', 'PJ区分'])
      },
    });

    if (salesResponse.code === 0 && salesResponse.data?.items) {
      console.log('✓ 売上データ取得成功');
      console.log('  取得件数: ' + salesResponse.data.items.length + '件\n');

      // 月別集計
      const monthlySales = new Map();
      for (const item of salesResponse.data.items) {
        const fields = item.fields || {};
        const salesDate = fields['売上日'];
        const amount = Number(fields['金額']) || 0;

        const monthIndex = getFiscalMonthIndex(salesDate);
        if (monthIndex >= 0) {
          const current = monthlySales.get(monthIndex) || { count: 0, amount: 0 };
          current.count++;
          current.amount += amount;
          monthlySales.set(monthIndex, current);
        }
      }

      console.log('  月別売上（91期）:');
      for (let i = 0; i < 12; i++) {
        const data = monthlySales.get(i) || { count: 0, amount: 0 };
        if (data.count > 0) {
          console.log(`    ${getFiscalMonthName(i)}: ${data.count}件, ${data.amount.toLocaleString()}円`);
        }
      }
    } else {
      console.log('✗ 売上データ取得失敗:', salesResponse);
    }
  } catch (error) {
    console.log('✗ 売上データ取得エラー:', error.message);
  }

  // 2. 受注残データ取得テスト
  console.log('\n【2】受注残データ取得テスト');
  console.log('-------------------------------------------');

  try {
    const backlogResponse = await client.bitable.appTableRecord.list({
      path: {
        app_token: process.env.LARK_BASE_TOKEN,
        table_id: BACKLOG_TABLE_ID,
      },
      params: {
        page_size: 500,
        field_names: JSON.stringify(['製番', '受注金額', '売上見込日', '売上済フラグ', '削除フラグ', '担当者', 'PJ区分'])
      },
    });

    if (backlogResponse.code === 0 && backlogResponse.data?.items) {
      console.log('✓ 受注残データ取得成功');
      console.log('  取得件数: ' + backlogResponse.data.items.length + '件\n');

      // フラグ別集計
      let total = 0;
      let soldCount = 0;
      let deletedCount = 0;
      let noDateCount = 0;

      // 月別受注残
      const monthlyBacklog = new Map();

      for (const item of backlogResponse.data.items) {
        const fields = item.fields || {};
        total++;

        const isSold = fields['売上済フラグ'] === true;
        const isDeleted = fields['削除フラグ'] === true;
        const mikomiDate = fields['売上見込日'];
        const amount = Number(fields['受注金額']) || 0;

        if (isSold) {
          soldCount++;
          continue;
        }
        if (isDeleted) {
          deletedCount++;
          continue;
        }
        if (!mikomiDate) {
          noDateCount++;
          continue;
        }

        // 2026年1月以降（91期後半）の受注残のみ対象
        if (mikomiDate.includes('2026')) {
          const monthIndex = getFiscalMonthIndex(mikomiDate);
          if (monthIndex >= 5) { // 1月以降
            const current = monthlyBacklog.get(monthIndex) || { count: 0, amount: 0 };
            current.count++;
            current.amount += amount;
            monthlyBacklog.set(monthIndex, current);
          }
        }
      }

      console.log('  データ内訳:');
      console.log(`    総レコード数: ${total}件`);
      console.log(`    売上済: ${soldCount}件`);
      console.log(`    削除済: ${deletedCount}件`);
      console.log(`    売上見込日なし: ${noDateCount}件`);
      console.log(`    受注残対象: ${total - soldCount - deletedCount - noDateCount}件`);

      console.log('\n  月別受注残（2026年1月以降）:');
      let totalBacklogAmount = 0;
      for (let i = 5; i < 12; i++) {
        const data = monthlyBacklog.get(i) || { count: 0, amount: 0 };
        if (data.count > 0) {
          console.log(`    ${getFiscalMonthName(i)}: ${data.count}件, ${data.amount.toLocaleString()}円`);
          totalBacklogAmount += data.amount;
        }
      }
      console.log(`    合計: ${totalBacklogAmount.toLocaleString()}円`);
    } else {
      console.log('✗ 受注残データ取得失敗:', backlogResponse);
    }
  } catch (error) {
    console.log('✗ 受注残データ取得エラー:', error.message);
  }

  // 3. フィールド検証
  console.log('\n【3】フィールド存在確認');
  console.log('-------------------------------------------');

  try {
    // ページネーション対応で全フィールド取得
    let allFields = [];
    let pageToken;
    do {
      const fieldsResponse = await client.bitable.appTableField.list({
        path: {
          app_token: process.env.LARK_BASE_TOKEN,
          table_id: BACKLOG_TABLE_ID,
        },
        params: { page_size: 500, page_token: pageToken }
      });

      if (fieldsResponse.code === 0 && fieldsResponse.data?.items) {
        allFields = allFields.concat(fieldsResponse.data.items);
        pageToken = fieldsResponse.data.page_token;
      } else {
        break;
      }
    } while (pageToken);

    const requiredFields = ['製番', '受注金額', '売上見込日', '売上済フラグ', '削除フラグ'];
    console.log('  必須フィールド確認 (総フィールド数: ' + allFields.length + '):');

    for (const fieldName of requiredFields) {
      const found = allFields.find(f => f.field_name === fieldName);
      console.log(`    ${fieldName}: ${found ? '✓ 存在 (type:' + found.type + ')' : '✗ なし'}`);
    }
  } catch (error) {
    console.log('✗ フィールド確認エラー:', error.message);
  }

  console.log('\n=======================================================');
  console.log('  テスト完了');
  console.log('=======================================================');
}

testSalesBIAPI().catch(console.error);
