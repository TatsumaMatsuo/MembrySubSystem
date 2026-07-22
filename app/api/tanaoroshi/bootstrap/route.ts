import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getActivePeriod,
  getCatalogForWarehouse,
  getReTanaoroshiCatalog,
  getWhStatus,
  getReasons,
  getReportedItemCodes,
} from "@/lib/tanaoroshi/store";
import type { BootstrapResponse } from "@/lib/tanaoroshi/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 起動時の一括取得。読取のたびにサーバへ問い合わせないための唯一の重い取得。
 *   GET /api/tanaoroshi/bootstrap?warehouse=<倉庫コード>
 * warehouse 未指定なら 期・理由のみ返す（倉庫選択前）。
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });

  const warehouse = req.nextUrl.searchParams.get("warehouse")?.trim() || "";

  try {
    const period = await getActivePeriod();
    const reasons = await getReasons();

    if (!period) {
      const body: BootstrapResponse = {
        success: true,
        period: null,
        warehouse: null,
        catalog: [],
        reasons,
        reportedItemCodes: [],
        error: "実施中の棚卸期がありません。管理者が棚卸期を作成してください。",
      };
      return NextResponse.json(body);
    }

    if (!warehouse) {
      const body: BootstrapResponse = {
        success: true,
        period,
        warehouse: null,
        catalog: [],
        reasons,
        reportedItemCodes: [],
      };
      return NextResponse.json(body);
    }

    const whStatus = await getWhStatus(period.periodId, warehouse);
    // 1回目=全対象品目 / 2回目以降=前回差分の掲載品目のみ（F-08）
    const catalog =
      whStatus.round > 1
        ? await getReTanaoroshiCatalog(period.periodId, warehouse, whStatus.round)
        : await getCatalogForWarehouse(warehouse);
    const reportedItemCodes = await getReportedItemCodes(period.periodId, warehouse, whStatus.round);

    // 倉庫名はクライアント（倉庫一覧）が保持しているため空でよい
    const body: BootstrapResponse = {
      success: true,
      period,
      warehouse: {
        code: warehouse,
        name: "",
        round: whStatus.round,
        status: whStatus.status,
      },
      catalog,
      reasons,
      reportedItemCodes,
    };
    return NextResponse.json(body);
  } catch (e: any) {
    console.error("[tanaoroshi/bootstrap]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}
