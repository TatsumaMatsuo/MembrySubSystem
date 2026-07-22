import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import { STOCK_TABLE_ID, createRecords, writeAudit } from "@/lib/tanaoroshi/store";
import { validateStockHeader, buildStockFields, type Cell } from "@/lib/tanaoroshi/stock-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * システム在庫情報の取込。1リクエスト = 最大500行を batchCreate。
 * クライアントが XLSX をパースし、ヘッダー検証済みの行を500件チャンクで送る。
 *
 * body:
 *   { header: string[], rows: Cell[][] }           … 1チャンク登録
 *   { header: string[], done: {total:number} }     … 監査コミットのみ（削除・登録なし）
 */
export async function POST(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;
  const operator = gate.user?.employeeName || gate.user?.email || "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const header: string[] = Array.isArray(body?.header) ? body.header.map((h: any) => String(h)) : [];
  const headerIssues = validateStockHeader(header);
  if (headerIssues.length) {
    return NextResponse.json(
      { success: false, error: "EXCELの列が想定と異なります", issues: headerIssues.slice(0, 10) },
      { status: 400 }
    );
  }

  // 監査コミット
  if (body?.done && typeof body.done.total === "number") {
    await writeAudit({
      action: "在庫取込",
      targetKey: "システム在庫情報",
      after: `${body.done.total}件登録`,
      operator,
    });
    return NextResponse.json({ success: true, committed: true });
  }

  const rows: Cell[][] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "取込データが空です" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ success: false, error: "1回の送信は最大500件です" }, { status: 400 });
  }

  // フィールド変換 + 必須列検証（部分取込しない：1件でも不正なら中止）
  const records: Record<string, any>[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const { fields, error } = buildStockFields(header, row);
    if (error) errors.push(`行 ${(body?.offset || 0) + i + 2}: ${error}`);
    else records.push(fields);
  });
  if (errors.length) {
    return NextResponse.json({ success: false, error: "取込を中止しました", issues: errors.slice(0, 10) }, { status: 400 });
  }

  try {
    await createRecords(STOCK_TABLE_ID(), records);
    return NextResponse.json({ success: true, inserted: records.length });
  } catch (e: any) {
    console.error("[tanaoroshi/stock/import]", e);
    return NextResponse.json({ success: false, error: e?.message || "取込に失敗しました" }, { status: 500 });
  }
}
