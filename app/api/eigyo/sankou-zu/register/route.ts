import { NextResponse } from "next/server";
import {
  getLarkBaseToken,
  getBaseRecords,
  getTableFields,
  createBaseRecord,
  updateBaseRecord,
} from "@/lib/lark-client";
import { getLarkTables, SANKOU_DAICHO_FIELDS, SANKOU_DAICHO_KEY, SANKOU_DAICHO_READONLY_FIELDS } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図面台帳 登録/更新API。
 *
 * POST body: { denpyo?: number, fields: Record<string, string|number> }
 *  - denpyo 指定あり → その伝票番号の行を更新
 *  - denpyo 指定なし → 伝票番号 = 既存最大+1 を採番して新規作成
 *
 * 値は Lark の実フィールド型に合わせて変換（数値型=number / その他=string）。空文字は送らない
 * （更新時の意図しない空上書きを避ける）。フィールドは SANKOU_DAICHO_FIELDS のみ許可。
 * 認証はミドルウェアでセッション必須。
 */
function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}

export async function POST(request: Request) {
  const tableId = getLarkTables().SANKOU_DAICHO;
  if (!tableId) {
    return NextResponse.json({ success: false, error: "台帳テーブルID未設定" }, { status: 500 });
  }
  const baseToken = getLarkBaseToken();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const inputFields = (body?.fields || {}) as Record<string, unknown>;
  const denpyoIn = body?.denpyo;

  try {
    // 実フィールド型を取得（数値型=2 を判定）
    const fres = await getTableFields(tableId, baseToken);
    const typeByField = new Map<string, number>(
      (fres.data?.items ?? []).map((f: any) => [f.field_name as string, f.type as number])
    );

    // 許可フィールドのみ・型変換して採用（伝票番号は別途採番/指定、Lookup等の読取専用は除外）
    const allow = new Set<string>(SANKOU_DAICHO_FIELDS);
    const readonly = new Set<string>(SANKOU_DAICHO_READONLY_FIELDS);
    const fields: Record<string, any> = {};
    for (const [k, raw] of Object.entries(inputFields)) {
      if (!allow.has(k) || k === SANKOU_DAICHO_KEY || readonly.has(k)) continue;
      const isNum = typeByField.get(k) === 2;
      if (isNum) {
        const n = typeof raw === "number" ? raw : Number(textOf(raw).replace(/[, ]/g, ""));
        if (Number.isFinite(n)) fields[k] = n;
      } else {
        const sval = textOf(raw);
        if (sval !== "") fields[k] = sval;
      }
    }

    const keyIsNum = typeByField.get(SANKOU_DAICHO_KEY) === 2;

    // 更新
    if (denpyoIn != null && String(denpyoIn).trim() !== "") {
      const denpyo = keyIsNum ? Number(denpyoIn) : String(denpyoIn);
      const filter = keyIsNum
        ? `CurrentValue.[${SANKOU_DAICHO_KEY}] = ${Number(denpyo)}`
        : `CurrentValue.[${SANKOU_DAICHO_KEY}] = "${escapeLarkFilterValue(denpyo)}"`;
      const res: any = await getBaseRecords(tableId, { baseToken, filter, pageSize: 1 });
      const rec = (res.data?.items || [])[0];
      if (!rec) {
        return NextResponse.json({ success: false, error: `伝票番号 ${denpyo} が見つかりません` }, { status: 404 });
      }
      const upd: any = await updateBaseRecord(tableId, rec.record_id, fields, { baseToken });
      if (upd.code !== 0) throw new Error(`更新失敗 code=${upd.code} msg=${upd.msg}`);
      return NextResponse.json({ success: true, denpyo, mode: "update" });
    }

    // 新規: 伝票番号 = 既存最大+1。伝票番号でのソートはLarkで不可(InvalidSort)のため全走査で最大を求める。
    let maxDenpyo = 0;
    let pageToken: string | undefined;
    do {
      const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
      for (const it of res.data?.items || []) {
        const n = Number(textOf(it.fields?.[SANKOU_DAICHO_KEY]));
        if (Number.isFinite(n) && n > maxDenpyo) maxDenpyo = n;
      }
      pageToken = res.data?.has_more ? res.data?.page_token : undefined;
    } while (pageToken);
    const newDenpyo = maxDenpyo + 1;
    fields[SANKOU_DAICHO_KEY] = keyIsNum ? newDenpyo : String(newDenpyo);

    const cr: any = await createBaseRecord(tableId, fields, { baseToken });
    if (cr.code !== 0) throw new Error(`作成失敗 code=${cr.code} msg=${cr.msg}`);
    return NextResponse.json({ success: true, denpyo: newDenpyo, mode: "create" });
  } catch (error: any) {
    console.error("[sankou-zu/register] Error:", error);
    return NextResponse.json(
      { success: false, error: "登録に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
