import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を最初にロード
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('Environment check:');
console.log('- LARK_APP_ID:', process.env.LARK_APP_ID ? 'set' : 'NOT SET');
console.log('- LARK_APP_SECRET:', process.env.LARK_APP_SECRET ? 'set' : 'NOT SET');
console.log('- LARK_BASE_TOKEN:', process.env.LARK_BASE_TOKEN ? 'set' : 'NOT SET');
console.log('- LARK_TABLE_USER_PERMISSIONS:', process.env.LARK_TABLE_USER_PERMISSIONS || 'NOT SET');

async function addAdmin() {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  const baseToken = process.env.LARK_BASE_TOKEN;
  const tableId = process.env.LARK_TABLE_USER_PERMISSIONS;

  if (!appId || !appSecret) {
    console.error('LARK_APP_ID or LARK_APP_SECRET not set');
    return;
  }

  if (!baseToken) {
    console.error('LARK_BASE_TOKEN not set');
    return;
  }

  if (!tableId) {
    console.error('LARK_TABLE_USER_PERMISSIONS not set');
    return;
  }

  // 直接Larkクライアントを作成
  const client = new lark.Client({
    appId: appId,
    appSecret: appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  const fields = {
    lark_user_id: 'tatsuma.m',
    user_name: 'Tatsuma M',
    user_email: 'tatsuma.m@yamaguchi-kk.co.jp',
    role: 'admin',
    granted_by: 'system',
    granted_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now()
  };

  try {
    console.log('\nCreating admin record...');
    console.log('Table ID:', tableId);
    console.log('Base Token:', baseToken);
    console.log('Fields:', JSON.stringify(fields, null, 2));

    const response = await client.bitable.appTableRecord.create({
      path: {
        app_token: baseToken,
        table_id: tableId,
      },
      data: {
        fields,
      },
    });

    if (response.code === 0) {
      console.log('\nAdmin user added successfully!');
      console.log('Record ID:', response.data?.record?.record_id);
    } else {
      console.error('\nFailed to add admin user');
      console.error('Code:', response.code);
      console.error('Message:', response.msg);
    }
  } catch (error: any) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

addAdmin();
