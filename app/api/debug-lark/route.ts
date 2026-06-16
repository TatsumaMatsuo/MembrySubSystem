import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { batchCreateBaseRecords, batchUpdateBaseRecords, getBaseRecords, deleteBaseRecord } from "@/lib/lark-client";

// AWS Amplify SSR で POST ハンドラーが環境変数にアクセスできるようにする
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// フォールバック値（AWS Amplify SSR で環境変数が取得できない問題の回避）
const FALLBACK_APP_ID = "cli_a9d79d0bbf389e1c";
const FALLBACK_APP_SECRET = "3sr6zsUWFw8LFl3tWNY26gwBB1WJOSnE";
const FALLBACK_BASE_TOKEN = "NvWsbaVP2aVT99sJUFxjhOLGpPs";
const FALLBACK_JWT_SECRET = "baiyaku_info_secret_key_12345";

// GET: 環境変数テスト + KAIKEI 書込権限テスト（Amplify実環境の値で実行）
export async function GET() {
  const appId = process.env.LARK_APP_ID || process.env.LARK_OAUTH_CLIENT_ID || FALLBACK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET || process.env.LARK_OAUTH_CLIENT_SECRET || FALLBACK_APP_SECRET;
  const baseToken = process.env.LARK_BASE_TOKEN || FALLBACK_BASE_TOKEN;
  const tableId = process.env.LARK_TABLE_KAIKEI_ACTUAL || "tbloZgcbsFls9LWt";
  const domain = process.env.LARK_DOMAIN || "https://open.larksuite.com";

  const envCheck = {
    appIdLen: appId?.length,
    appIdPrefix: appId?.substring(0, 8),
    appIdFromEnv: !!process.env.LARK_APP_ID,
    appSecretLen: appSecret?.length,
    baseTokenPrefix: baseToken?.substring(0, 6),
    baseTokenLen: baseToken?.length,
    baseTokenFromEnv: !!process.env.LARK_BASE_TOKEN,
    domain,
  };

  try {
    const tokenRes = await fetch(`${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.tenant_access_token as string | undefined;

    const result: any = {
      envCheck,
      tokenStep: { code: tokenData.code, msg: tokenData.msg, hasToken: !!token },
    };

    if (token) {
      const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      // 読取
      const rd = await fetch(`${domain}/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records?page_size=1`, { headers: auth });
      const rdj = await rd.json();
      result.readTest = { httpStatus: rd.status, code: rdj.code, msg: rdj.msg };
      // 書込(作成→削除)
      const cr = await fetch(`${domain}/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records`, {
        method: "POST", headers: auth,
        body: JSON.stringify({ fields: { 実績コード: "DEBUG-WRITE-PROBE-DELETE-ME", 期: 1, 勘定科目: "売上高", 実績値: 0 } }),
      });
      const crj = await cr.json();
      result.writeTest = { httpStatus: cr.status, code: crj.code, msg: crj.msg };
      const newId = crj.data?.record?.record_id;
      if (newId) {
        await fetch(`${domain}/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records/${newId}`, { method: "DELETE", headers: auth }).catch(() => {});
        result.writeTest.cleaned = true;
      }
    }

    // SDK経路テスト(アプリと同じ lark-client の関数を使用) — 生RESTと比較する
    const sdk: any = {};
    try {
      const rd = await getBaseRecords(tableId, { baseToken, filter: "CurrentValue.[期] = 47", pageSize: 1 });
      sdk.readOk = true;
      sdk.readItems = rd.data?.items?.length ?? 0;
      const existing = rd.data?.items?.[0] as any;
      if (existing) {
        // 既存47期レコードを SDK batchUpdate(同値・非破壊)
        sdk.targetRecordId = existing.record_id;
        await batchUpdateBaseRecords(tableId, [{ record_id: existing.record_id, fields: { 実績値: Number(existing.fields["実績値"]) } }], { baseToken });
        sdk.batchUpdateOk = true;
      }
      // SDK batchCreate(throwaway) → 削除
      await batchCreateBaseRecords(tableId, [{ 実績コード: "SDK-PROBE-DELETE-ME", 期: 1, 勘定科目: "売上高", 実績値: 0 }], { baseToken });
      sdk.batchCreateOk = true;
      const find = await getBaseRecords(tableId, { baseToken, filter: 'CurrentValue.[実績コード] = "SDK-PROBE-DELETE-ME"', pageSize: 1 });
      const pid = (find.data?.items?.[0] as any)?.record_id;
      if (pid) { await deleteBaseRecord(tableId, pid, { baseToken }); sdk.cleaned = true; }
    } catch (e: any) {
      sdk.threw = true;
      sdk.message = e?.message;
      sdk.httpStatus = e?.response?.status;
      sdk.larkData = e?.response?.data ?? e?.data ?? null;
    }
    result.sdkTest = sdk;

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ envCheck, error: error.message });
  }
}

// POST: auth-token検証テスト
export async function POST(request: NextRequest) {
  const jwtSecret = process.env.NEXTAUTH_SECRET || FALLBACK_JWT_SECRET;
  const SECRET = new TextEncoder().encode(jwtSecret);

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "auth-token cookie not found",
        jwtSecretUsed: jwtSecret.substring(0, 10) + "...",
      });
    }

    // JWT検証
    const { payload } = await jwtVerify(token, SECRET);

    return NextResponse.json({
      success: true,
      message: "Token verified successfully",
      jwtSecretUsed: jwtSecret.substring(0, 10) + "...",
      payload: {
        id: payload.id,
        name: payload.name,
        exp: payload.exp,
        iat: payload.iat,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      jwtSecretUsed: jwtSecret.substring(0, 10) + "...",
    });
  }
}
