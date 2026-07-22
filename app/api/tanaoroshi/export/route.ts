import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireMenuAccess } from "@/lib/menu-access";
import { getActivePeriod, getWarehouses, computeConfirmed, writeBackToKikan } from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 基幹取込レイアウト（棚卸在庫情報の11列と同じ列・列順） */
const COLUMNS = ["倉庫コード", "倉庫", "品番", "品名", "品名2", "数量", "備考", "担当者コード", "担当者", "理論数", "差異数"];

async function resolveTargets(req: NextRequest): Promise<{ periodId: string; warehouses: string[] } | { error: string }> {
  let periodId = req.nextUrl.searchParams.get("period")?.trim() || "";
  const whParam = req.nextUrl.searchParams.get("warehouse")?.trim() || "";
  if (!periodId) {
    const active = await getActivePeriod();
    if (!active) return { error: "実施中の棚卸期がありません" };
    periodId = active.periodId;
  }
  let warehouses: string[];
  if (whParam) warehouses = [whParam];
  else warehouses = (await getWarehouses()).map((w) => w.code);
  return { periodId, warehouses };
}

/** GET: EXCEL ダウンロード（基幹取込用） */
export async function GET(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;

  const t = await resolveTargets(req);
  if ("error" in t) return NextResponse.json({ success: false, error: t.error }, { status: 400 });

  try {
    const confirmed = await computeConfirmed(t.periodId, t.warehouses);
    const aoa: (string | number)[][] = [COLUMNS];
    for (const c of confirmed) {
      aoa.push([
        Number(c.warehouseCode) || c.warehouseCode,
        c.warehouseName,
        c.itemCode,
        c.itemName,
        c.spec,
        c.qty,
        [c.reasonCode ? `理由:${c.reasonCode}` : "", c.systemQty === 0 && c.qty > 0 ? "システム在庫なし" : ""].filter(Boolean).join(" "),
        "",
        c.staff,
        c.systemQty,
        c.diffQty,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "棚卸在庫情報");
    const body = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `棚卸在庫情報_${stamp}.xlsx`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Total-Count": String(confirmed.length),
      },
    });
  } catch (e: any) {
    console.error("[tanaoroshi/export GET]", e);
    return NextResponse.json({ success: false, error: e?.message || "出力に失敗しました" }, { status: 500 });
  }
}

/** POST: 棚卸在庫情報テーブルへ書き戻し */
export async function POST(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;
  const operator = gate.user?.employeeName || gate.user?.email || "unknown";

  const t = await resolveTargets(req);
  if ("error" in t) return NextResponse.json({ success: false, error: t.error }, { status: 400 });

  try {
    const count = await writeBackToKikan(t.periodId, t.warehouses, operator);
    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    console.error("[tanaoroshi/export POST]", e);
    return NextResponse.json({ success: false, error: e?.message || "書き戻しに失敗しました" }, { status: 500 });
  }
}
