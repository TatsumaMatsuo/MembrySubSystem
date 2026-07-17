import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getNippouReportsByDateRange, type NippouReport } from "@/lib/nippou";

// 出面管理(#93): 現場作業日報を作業日From-To(必須)+外注業者名(部分一致・任意)で抽出し、
// 明細 or 施工業者ごと集計で返す。format=xlsx でExcelダウンロード。認証は middleware が担保。
export const dynamic = "force-dynamic";

// "YYYY-MM-DD" → 作業報告日(UTC0時ms)。不正は null。
function parseDateToUtcTs(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ts) ? null : ts;
}

// 名寄せ用キー: 全角英数→半角, 空白除去, 法人格除去, 小文字化(ベストエフォート)
function normalizeCompanyKey(s: string): string {
  return (s || "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, "")
    .replace(/(株式会社|\(株\)|（株）|㈱|有限会社|\(有\)|（有）|㈲)/g, "")
    .toLowerCase()
    .trim();
}

interface DetailRow {
  company: string;
  seiban: string;
  bukken: string;
  date: string;
  workers: number;
}
interface SummaryRow {
  company: string;
  days: number;
  workers: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from") || "";
    const toStr = searchParams.get("to") || "";
    const company = (searchParams.get("company") || "").trim();
    const mode = searchParams.get("mode") === "detail" ? "detail" : "summary";
    const format = searchParams.get("format") === "xlsx" ? "xlsx" : "json";

    const fromTs = parseDateToUtcTs(fromStr);
    const toTs = parseDateToUtcTs(toStr);
    if (fromTs == null || toTs == null) {
      return NextResponse.json({ success: false, error: "作業日(From/To)は必須です（YYYY-MM-DD）。" }, { status: 400 });
    }
    if (fromTs > toTs) {
      return NextResponse.json({ success: false, error: "作業日のFromはTo以前にしてください。" }, { status: 400 });
    }

    const reports = await getNippouReportsByDateRange(fromTs, toTs, company || undefined);

    // 作業人数は数値化(未入力は0扱い)
    const workersOf = (r: NippouReport) => (typeof r.workers === "number" ? r.workers : 0);

    let rows: DetailRow[] | SummaryRow[];
    let totalDays: number;
    let totalWorkers: number;

    if (mode === "detail") {
      const detail: DetailRow[] = reports.map((r) => ({
        company: r.company,
        seiban: r.seiban,
        bukken: r.bukken,
        date: r.reportDate,
        workers: workersOf(r),
      }));
      // ソート: 外注業者名 → 製番 → 製番名 → 作業日(昇順)
      detail.sort(
        (a, b) =>
          a.company.localeCompare(b.company, "ja") ||
          a.seiban.localeCompare(b.seiban, "ja") ||
          a.bukken.localeCompare(b.bukken, "ja") ||
          a.date.localeCompare(b.date)
      );
      rows = detail;
      totalDays = detail.length; // 作業日数=抽出結果のレコード件数(実働日数)
      totalWorkers = detail.reduce((s, r) => s + r.workers, 0);
    } else {
      // 施工業者ごと集計(名寄せキーでグループ化, 表示名=初出の会社名)
      const map = new Map<string, { company: string; days: number; workers: number }>();
      for (const r of reports) {
        const key = normalizeCompanyKey(r.company) || r.company || "(会社名なし)";
        const g = map.get(key) || { company: r.company || "(会社名なし)", days: 0, workers: 0 };
        g.days += 1; // レコード件数=実働日数
        g.workers += workersOf(r);
        map.set(key, g);
      }
      const summary: SummaryRow[] = Array.from(map.values());
      summary.sort((a, b) => a.company.localeCompare(b.company, "ja"));
      rows = summary;
      totalDays = summary.reduce((s, r) => s + r.days, 0);
      totalWorkers = summary.reduce((s, r) => s + r.workers, 0);
    }

    if (format === "json") {
      return NextResponse.json({
        success: true,
        mode,
        rows,
        totals: { days: totalDays, workers: totalWorkers },
      });
    }

    // === Excel(.xlsx) ===
    let aoa: (string | number)[][];
    if (mode === "detail") {
      const d = rows as DetailRow[];
      aoa = [
        ["外注業者名", "製番", "製番名", "作業日", "作業人数"],
        ...d.map((r) => [r.company, r.seiban, r.bukken, r.date, r.workers]),
        ["合計", "", "", `${totalDays}日`, totalWorkers],
      ];
    } else {
      const s = rows as SummaryRow[];
      aoa = [
        ["外注業者名", "作業日数", "作業人数"],
        ...s.map((r) => [r.company, r.days, r.workers]),
        ["合計", totalDays, totalWorkers],
      ];
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "出面");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const filename = `出面管理_${fromStr}_${toStr}${mode === "detail" ? "_明細" : "_集計"}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[demen] Error:", error);
    return NextResponse.json({ success: false, error: "抽出中にエラーが発生しました。" }, { status: 500 });
  }
}
