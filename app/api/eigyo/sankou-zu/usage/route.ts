import { NextResponse } from "next/server";
import {
  getLarkBaseToken,
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
} from "@/lib/lark-client";
import {
  getLarkTables,
  SEKKEI_IRAI_BASE,
  SEKKEI_IRAI_TABLE,
  SEKKEI_IRAI_YM_FIELD,
  SEKKEI_IRAI_COUNT_FIELD,
} from "@/lib/lark-tables";
import { getServerSession } from "@/lib/auth-server";
import { getEmployeeByEmail } from "@/lib/menu-permission";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 参考図台帳 利用状況の計測。
 *
 * POST { type: "launch" | "fetch" }
 *   年月(JST, YYYY-MM)×担当者 で集計。該当行が無ければ insert、有れば 起動回数/情報取得回数 を +1。
 *   担当者=ログインユーザー名、所属部署=社員マスタから解決。
 *
 * GET  → 全集計レコード(ダッシュボード用)を返す。
 *
 * フィールド: 年月 / 担当者 / 所属部署 / 起動回数 / 情報取得回数
 */
const F = { ym: "年月", user: "担当者", dept: "所属部署", launch: "起動回数", fetch: "情報取得回数" } as const;

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}
function numOf(v: any): number {
  const n = typeof v === "number" ? v : Number(textOf(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
/** JST(UTC+9)の YYYY-MM */
function currentYearMonthJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const tableId = getLarkTables().SANKOU_USAGE;
  if (!tableId) return NextResponse.json({ success: false, error: "利用状況テーブル未設定" }, { status: 500 });

  let body: any = {};
  try { body = await request.json(); } catch { /* 空ボディ許容 */ }
  const type = body?.type === "fetch" ? "fetch" : "launch";

  try {
    const session = await getServerSession();
    const name = session.user?.name?.trim() || "不明";
    const email = session.user?.email || "";
    let dept = "";
    if (email) {
      try { dept = (await getEmployeeByEmail(email))?.department || ""; } catch { /* 部署解決失敗は空 */ }
    }
    const ym = currentYearMonthJST();
    const baseToken = getLarkBaseToken();
    const incField = type === "fetch" ? F.fetch : F.launch;

    // 年月×担当者 で既存検索
    const filter = `AND(CurrentValue.[${F.ym}] = "${escapeLarkFilterValue(ym)}", CurrentValue.[${F.user}] = "${escapeLarkFilterValue(name)}")`;
    const res: any = await getBaseRecords(tableId, { baseToken, filter, pageSize: 1 });
    const rec = (res.data?.items || [])[0];

    if (rec) {
      const cur = numOf(rec.fields?.[incField]);
      const fields: Record<string, any> = { [incField]: cur + 1 };
      if (dept && !textOf(rec.fields?.[F.dept])) fields[F.dept] = dept; // 所属部署が空なら補完
      const up: any = await updateBaseRecord(tableId, rec.record_id, fields, { baseToken });
      if (up.code !== 0) throw new Error(`更新失敗 code=${up.code} msg=${up.msg}`);
      return NextResponse.json({ success: true, mode: "update", ym, type });
    } else {
      const fields: Record<string, any> = {
        [F.ym]: ym,
        [F.user]: name,
        [F.dept]: dept,
        [F.launch]: type === "launch" ? 1 : 0,
        [F.fetch]: type === "fetch" ? 1 : 0,
      };
      const cr: any = await createBaseRecord(tableId, fields, { baseToken });
      if (cr.code !== 0) throw new Error(`作成失敗 code=${cr.code} msg=${cr.msg}`);
      return NextResponse.json({ success: true, mode: "create", ym, type });
    }
  } catch (error: any) {
    console.error("[sankou-zu/usage] Error:", error);
    return NextResponse.json({ success: false, error: "計測に失敗しました", detail: error?.message }, { status: 500 });
  }
}

/**
 * 設計依頼集計テーブル(別base)から 年月(YYYY-MM)×全体設計依頼数 を取得。
 * 参考図の利用件数との相関分析に使う。取得失敗はダッシュボード全体を壊さないよう空配列で握りつぶす。
 */
async function loadSekkeiIrai(): Promise<{ ym: string; count: number }[]> {
  const out: { ym: string; count: number }[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(SEKKEI_IRAI_TABLE, { baseToken: SEKKEI_IRAI_BASE, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const f = it.fields || {};
      const ym = textOf(f[SEKKEI_IRAI_YM_FIELD]).trim().replace(/\//g, "-"); // YYYY/MM → YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      out.push({ ym, count: numOf(f[SEKKEI_IRAI_COUNT_FIELD]) });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

export async function GET() {
  const tableId = getLarkTables().SANKOU_USAGE;
  if (!tableId) return NextResponse.json({ success: false, error: "利用状況テーブル未設定" }, { status: 500 });
  try {
    const baseToken = getLarkBaseToken();
    const rows: any[] = [];
    let pageToken: string | undefined;
    do {
      const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
      for (const it of res.data?.items || []) {
        const f = it.fields || {};
        rows.push({
          ym: textOf(f[F.ym]).trim(),
          user: textOf(f[F.user]).trim(),
          dept: textOf(f[F.dept]).trim(),
          launch: numOf(f[F.launch]),
          fetch: numOf(f[F.fetch]),
        });
      }
      pageToken = res.data?.has_more ? res.data?.page_token : undefined;
    } while (pageToken);
    rows.sort((a, b) => (a.ym === b.ym ? a.user.localeCompare(b.user, "ja") : b.ym.localeCompare(a.ym)));

    // 設計依頼件数(相関分析用)。別baseのため失敗しても利用状況は返す。
    let sekkei: { ym: string; count: number }[] = [];
    try {
      sekkei = await loadSekkeiIrai();
    } catch (e: any) {
      console.error("[sankou-zu/usage] 設計依頼取得失敗:", e?.message || e);
    }

    return NextResponse.json({ success: true, rows, sekkei });
  } catch (error: any) {
    console.error("[sankou-zu/usage] GET Error:", error);
    return NextResponse.json({ success: false, error: "取得に失敗しました", detail: error?.message }, { status: 500 });
  }
}
