import { NextResponse } from "next/server";
import { getBaseRecords, getLarkBaseToken } from "@/lib/lark-client";
import { isBoxConfigured } from "@/lib/box-client";
import {
  getLarkTables,
  SANKOU_DAICHO_FIELDS,
  SANKOU_DAICHO_NUMERIC_FIELDS,
  SANKOU_DAICHO_KEY,
  SANKOU_BUHIN_FIELDS,
  SANKOU_HANYOU_SYSTEM,
} from "@/lib/lark-tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図台帳検索 データ API。
 *
 * Lark Bitable「参考図面台帳」(4,268行) と「参考図面部品マスタ」(853行) を全件取得し、
 * 整形してモジュールキャッシュ(TTL)で保持する。検索/絞り込みはクライアント側で行う
 * (kijun-fusoku と同方式。件数が中規模のため全件キャッシュで十分)。
 *
 * 各レコードは空値を除いたフィールドのみ保持してペイロードを軽量化する。数値フィールドは
 * number、それ以外は string。PDF(Box)中継は別途手配が必要なため pdfEnabled で可否を返す。
 */

type DaichoRecord = Record<string, string | number> & { 伝票番号: number | string };
type BuhinRecord = Record<string, string | number>;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間
const NUMERIC = new Set<string>(SANKOU_DAICHO_NUMERIC_FIELDS);

let _cache: { at: number; daicho: DaichoRecord[]; buhin: BuhinRecord[]; hanyou: Record<string, string[]> } | null = null;

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}
function numOf(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(textOf(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 1テーブルを全件取得し、フィールド配列に沿って空値を除いたオブジェクト配列へ整形。 */
async function loadTable(
  tableId: string,
  fields: readonly string[],
  numericFields: Set<string>
): Promise<Record<string, string | number>[]> {
  const baseToken = getLarkBaseToken();
  const out: Record<string, string | number>[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const f = it.fields || {};
      const rec: Record<string, string | number> = {};
      for (const field of fields) {
        if (numericFields.has(field)) {
          const n = numOf(f[field]);
          if (n != null) rec[field] = n;
        } else {
          const s = textOf(f[field]).trim();
          if (s) rec[field] = s;
        }
      }
      out.push(rec);
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

/** 汎用マスタ(システム名=参考図面情報)を 項目名 → 内容[] にグループ化して取得。 */
async function loadHanyou(tableId: string): Promise<Record<string, string[]>> {
  const baseToken = getLarkBaseToken();
  const sets: Record<string, Set<string>> = {};
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const f = it.fields || {};
      if (textOf(f["システム名"]).trim() !== SANKOU_HANYOU_SYSTEM) continue;
      const item = textOf(f["項目名"]).trim();
      const val = textOf(f["内容"]).trim();
      if (!item || !val) continue;
      (sets[item] ||= new Set()).add(val);
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(sets)) out[k] = [...sets[k]].sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
  return out;
}


export async function GET(request: Request) {
  const tables = getLarkTables();
  if (!tables.SANKOU_DAICHO || !tables.SANKOU_BUHIN) {
    return NextResponse.json(
      { success: false, error: "参考図台帳のテーブルIDが未設定です" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";

  try {
    const now = Date.now();
    if (force || !_cache || now - _cache.at > CACHE_TTL_MS) {
      const [daicho, buhin, hanyou] = await Promise.all([
        loadTable(tables.SANKOU_DAICHO, SANKOU_DAICHO_FIELDS, NUMERIC) as Promise<DaichoRecord[]>,
        loadTable(tables.SANKOU_BUHIN, SANKOU_BUHIN_FIELDS, new Set(["ID"])) as Promise<BuhinRecord[]>,
        tables.SANKOU_HANYOU ? loadHanyou(tables.SANKOU_HANYOU) : Promise.resolve({}),
      ]);
      // 伝票番号(業務PK)の昇順で安定表示
      daicho.sort((a, b) => Number(a[SANKOU_DAICHO_KEY]) - Number(b[SANKOU_DAICHO_KEY]));
      _cache = { at: now, daicho, buhin, hanyou };
    }
    return NextResponse.json({
      success: true,
      cachedAt: _cache.at,
      counts: { daicho: _cache.daicho.length, buhin: _cache.buhin.length },
      pdfEnabled: isBoxConfigured(),
      daicho: _cache.daicho,
      buhin: _cache.buhin,
      hanyou: _cache.hanyou,
    });
  } catch (error: any) {
    console.error("[sankou-zu] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
