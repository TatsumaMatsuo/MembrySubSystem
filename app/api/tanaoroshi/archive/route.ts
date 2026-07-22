import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireMenuAccess } from "@/lib/menu-access";
import { ARCHIVABLE_TABLES, fetchAllRecords } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 棚卸稼働データのアーカイブ（EXCEL ダウンロード）。
 * 締め後の初期化（F-15）の前に、監査証跡として保管するために使う。
 *
 *   GET /api/tanaoroshi/archive?table=entry|diff
 *
 * 添付（写真）列は EXCEL に実体を入れられないため、ファイル名/トークンを文字列化して残す。
 */
function cellToText(v: any): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "TRUE" : "";
  if (Array.isArray(v)) {
    // 添付ファイル配列 or 複数値
    return v
      .map((x) => (typeof x === "string" ? x : x?.name || x?.text || x?.file_token || ""))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

export async function GET(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;

  const key = req.nextUrl.searchParams.get("table") || "";
  const def = ARCHIVABLE_TABLES[key];
  if (!def) {
    return NextResponse.json({ success: false, error: "アーカイブ対象が不正です" }, { status: 400 });
  }

  try {
    const rows = await fetchAllRecords(def.id());
    // 列順は *_FIELDS の定義順（＝テーブルの論理順）に固定する
    const columns = Object.values(def.fields);

    const aoa: (string | number)[][] = [columns];
    for (const r of rows) {
      aoa.push(columns.map((col) => cellToText(r[col])));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, def.label.slice(0, 31));
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const body = new Uint8Array(buf);

    const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `${def.label}_${stamp}.xlsx`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Total-Count": String(rows.length),
      },
    });
  } catch (e: any) {
    console.error("[tanaoroshi/archive]", e);
    return NextResponse.json({ success: false, error: e?.message || "アーカイブに失敗しました" }, { status: 500 });
  }
}
