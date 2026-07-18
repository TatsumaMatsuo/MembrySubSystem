import { NextRequest, NextResponse } from "next/server";
import {
  getLarkClient,
  getLarkBaseToken,
  getBaseRecords,
  createBaseRecord,
  updateBaseRecord,
} from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import {
  getLarkTables,
  KOJI_LEDGER_SETTINGS_FIELDS as F,
  KOJI_LEDGER_SETTINGS_TABLE_NAME,
} from "@/lib/lark-tables";

// 工事写真台帳の下書き（選択/並び順/コメント/表紙/レイアウト）を製番ごとに保存/取得（#94）
// - GET  ?seiban=XXX → { success, data: <保存JSON> | null }
// - POST { seiban, settings } → 製番でupsert（1製番=1レコード）
export const dynamic = "force-dynamic";

// テーブルID解決: 環境変数優先。未設定なら名称「工事写真台帳設定」でproject baseから解決しキャッシュ。
let cachedTableId = "";
async function resolveTableId(): Promise<string> {
  const envId = getLarkTables().KOJI_LEDGER_SETTINGS;
  if (envId) return envId;
  if (cachedTableId) return cachedTableId;
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const res = await client.bitable.appTable.list({
    path: { app_token: getLarkBaseToken() },
    params: { page_size: 100 },
  });
  const table = res.data?.items?.find((t: any) => t.name === KOJI_LEDGER_SETTINGS_TABLE_NAME);
  if (!table?.table_id) {
    throw new Error(`テーブル「${KOJI_LEDGER_SETTINGS_TABLE_NAME}」が見つかりません（Larkで作成してください）`);
  }
  cachedTableId = table.table_id;
  return cachedTableId;
}

// Larkテキスト型の値を文字列へ（[{text}] セグメント配列 / 文字列 いずれも許容）
function parseText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((s: any) => (s && typeof s === "object" && s.text != null ? s.text : s)).join("");
  if (typeof v === "object" && (v as any).text != null) return String((v as any).text);
  return String(v);
}

async function findRecord(tableId: string, seiban: string) {
  const filter = `CurrentValue.[${F.seiban}] = "${escapeLarkFilterValue(seiban)}"`;
  const res = await getBaseRecords(tableId, { filter, pageSize: 1 });
  return res.data?.items?.[0];
}

export async function GET(request: NextRequest) {
  try {
    const seiban = request.nextUrl.searchParams.get("seiban")?.trim();
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番が指定されていません" }, { status: 400 });
    }
    const tableId = await resolveTableId();
    const rec = await findRecord(tableId, seiban);
    if (!rec) return NextResponse.json({ success: true, data: null });
    const raw = parseText(rec.fields?.[F.settings_json]);
    let data: any = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null; // 壊れたJSONは無視（初期状態として扱う）
      }
    }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("[koji-ledger/settings] GET error", e);
    return NextResponse.json({ success: false, error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const seiban = String(body?.seiban || "").trim();
    const settings = body?.settings;
    if (!seiban) {
      return NextResponse.json({ success: false, error: "製番が指定されていません" }, { status: 400 });
    }
    if (settings == null || typeof settings !== "object") {
      return NextResponse.json({ success: false, error: "設定データが不正です" }, { status: 400 });
    }
    const json = JSON.stringify(settings);
    // Larkテキスト型の実用上限に対する保険（過大なJSONは弾く）
    if (json.length > 100000) {
      return NextResponse.json({ success: false, error: "設定データが大きすぎます" }, { status: 400 });
    }

    const tableId = await resolveTableId();
    const fields: Record<string, any> = {
      [F.seiban]: seiban,
      [F.settings_json]: json,
      [F.updated_at]: Date.now(),
    };
    const existing = await findRecord(tableId, seiban);
    if (existing?.record_id) {
      await updateBaseRecord(tableId, existing.record_id, fields);
    } else {
      await createBaseRecord(tableId, fields);
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[koji-ledger/settings] POST error", e);
    return NextResponse.json({ success: false, error: e?.message || "保存に失敗しました" }, { status: 500 });
  }
}
