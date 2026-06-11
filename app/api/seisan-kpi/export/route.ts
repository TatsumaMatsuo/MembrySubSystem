import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getExportData, getCurrentPeriod, type ExportType } from "@/services/seisan-kpi.service";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ExportType, string> = {
  actuals: "KPI実績",
  measures: "施策ログ",
  stars: "★達成表",
};

/**
 * GET /api/seisan-kpi/export?type=actuals|measures|stars&format=csv|xlsx|json&period=50
 * 生産本部KPIの主要データを CSV / Excel / JSON(プレビュー用)で出力。
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const typeParam = (sp.get("type") || "actuals") as ExportType;
    const type: ExportType = (["actuals", "measures", "stars"].includes(typeParam) ? typeParam : "actuals") as ExportType;
    const format = sp.get("format") || "csv";
    let period = Number(sp.get("period"));
    if (!period) {
      const cur = await getCurrentPeriod();
      period = cur?.period ?? 50;
    }

    const rows = await getExportData(type, period);

    // プレビュー(JSON)はそのまま返す
    if (format === "json") {
      return NextResponse.json({ data: { type, period, count: rows.length, rows } });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "エクスポートするデータがありません" }, { status: 404 });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    // 列幅を自動調整
    ws["!cols"] = Object.keys(rows[0]).map((key) => ({ wch: Math.max(key.length * 2, 10) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, TYPE_LABEL[type]);

    const filename = `${TYPE_LABEL[type]}_${period}期_${new Date().toISOString().slice(0, 10)}.${format === "xlsx" ? "xlsx" : "csv"}`;

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    // CSV(BOM付きUTF-8で日本語文字化け対策)
    const csv = "﻿" + XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (e: any) {
    console.error("[seisan-kpi/export GET] error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
