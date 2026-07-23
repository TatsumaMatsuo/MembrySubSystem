import { NextRequest, NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/menu-access";
import {
  listNotifyTargets,
  upsertNotifyTarget,
  deleteNotifyTarget,
  listWarehouseNotify,
  setWarehouseNotify,
} from "@/lib/tanaoroshi/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 通知先設定（F-10）。生産管理部のみ。 */
export async function GET() {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;
  try {
    const [warehouses, targets] = await Promise.all([listWarehouseNotify(), listNotifyTargets()]);
    return NextResponse.json({ success: true, warehouses, targets });
  } catch (e: any) {
    console.error("[tanaoroshi/notify-targets GET]", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}

/**
 * POST { action: "setWarehouse", warehouseCode, notify }
 *      { action: "upsertTarget", recordId?, trigger, kind, value, isActive, note? }
 *      { action: "deleteTarget", recordId }
 */
export async function POST(req: NextRequest) {
  const gate = await requireMenuAccess("/seizou/tanaoroshi");
  if (!gate.authorized) return gate.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  try {
    if (body?.action === "setWarehouse") {
      const code = String(body?.warehouseCode || "").trim();
      if (!code) return NextResponse.json({ success: false, error: "倉庫が不正です" }, { status: 400 });
      await setWarehouseNotify(code, String(body?.notify || "").trim());
      return NextResponse.json({ success: true });
    }
    if (body?.action === "upsertTarget") {
      const value = String(body?.value || "").trim();
      if (!value) return NextResponse.json({ success: false, error: "宛先値を入力してください" }, { status: 400 });
      await upsertNotifyTarget({
        recordId: body?.recordId || undefined,
        trigger: String(body?.trigger || "共通"),
        kind: String(body?.kind || "メール"),
        value,
        isActive: body?.isActive !== false,
        note: String(body?.note || ""),
      });
      return NextResponse.json({ success: true });
    }
    if (body?.action === "deleteTarget") {
      const recordId = String(body?.recordId || "");
      if (!recordId) return NextResponse.json({ success: false, error: "対象が不正です" }, { status: 400 });
      await deleteNotifyTarget(recordId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "操作が不正です" }, { status: 400 });
  } catch (e: any) {
    console.error("[tanaoroshi/notify-targets POST]", e);
    return NextResponse.json({ success: false, error: e?.message || "処理に失敗しました" }, { status: 500 });
  }
}
