import { NextResponse } from "next/server";
import { getBaseRecords, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F, KIJUN_FUSOKU_CONST_FIELDS as CFIELDS } from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 基準風速・垂直積雪量 検索データ API。
 *
 * Lark Bitable「基準風速・積雪量マスタ」(project base) を **県単位** で取得する。
 * クエリ `?ken=<県名>` が必須で、サーバ側で 県名 フィルタを掛けて該当県のレコードのみ返す。
 * 市・郡・区→区分1〜3 の絞り込みは、取得済みの県内データに対してクライアント側で行う。
 *
 * 全件(7,643行)を毎回読むのを避け、県ごと(数十〜数百行)に絞ることで取得量を大幅削減。
 * 県ごとにインメモリキャッシュ(TTL)し、温かいコンテナ内は再利用する。
 * 県プルダウンの一覧はクライアント側の定数(lib/prefectures.ts)で持つため初回のDB取得は不要。
 */
export interface KijunFusokuRecord {
  ken: string; // 県名
  shi: string; // 市・郡・区
  k1: string; // 区分1
  k2: string; // 区分2
  k3: string; // 区分3
  wind: number | null; // 基準風速 m/s
  snow: number | null; // 垂直積雪量 cm（標高依存地域は null）
  elev: boolean; // 標高計算有無（true=標高依存）
  elevSign: string; // 標高符号 T 例 "<="（参考表示）
  elevBase: number | null; // 基準値（しきい標高 m）。式の「基準値」変数
  elevMethod: string; // 積雪算出方法 W（原文・算出根拠の表示用）
  note: string; // 備考
  patternId: string; // 計算パターンID（例 "K025"）標高依存積雪の確定算出用
  consts: (number | null)[]; // 定数1〜6（式の係数）
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間
// 県名 → その県のレコード（県単位キャッシュ）
const _cache = new Map<string, { at: number; data: KijunFusokuRecord[] }>();

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}
function numOf(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(textOf(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function loadByPrefecture(tableId: string, ken: string): Promise<KijunFusokuRecord[]> {
  const baseToken = getLarkBaseToken();
  // 県名でサーバ側フィルタ（" を含む県名は無いがエスケープしておく）
  const filter = `CurrentValue.[${F.ken}] = "${escapeLarkFilterValue(ken)}"`;
  const out: KijunFusokuRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, filter, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const f = it.fields || {};
      const ken = textOf(f[F.ken]).trim();
      if (!ken) continue;
      out.push({
        ken,
        shi: textOf(f[F.shi]).trim(),
        k1: textOf(f[F.k1]).trim(),
        k2: textOf(f[F.k2]).trim(),
        k3: textOf(f[F.k3]).trim(),
        wind: numOf(f[F.wind]),
        snow: numOf(f[F.snow]),
        elev: f[F.elev_flag] === true,
        elevSign: textOf(f[F.elev_sign]).trim(),
        elevBase: numOf(f[F.elev_base]),
        elevMethod: textOf(f[F.elev_method]).trim(),
        note: textOf(f[F.note]).trim(),
        patternId: textOf(f[F.pattern_id]).trim(),
        consts: CFIELDS.map((k) => numOf(f[k])),
      });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

export async function GET(request: Request) {
  const tableId = getLarkTables().KIJUN_FUSOKU;
  if (!tableId) {
    return NextResponse.json(
      { success: false, error: "基準風速・積雪量マスタ のテーブルIDが未設定です" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const ken = (url.searchParams.get("ken") || "").trim();

  if (!ken) {
    return NextResponse.json(
      { success: false, error: "県名(ken)を指定してください" },
      { status: 400 }
    );
  }

  try {
    const now = Date.now();
    const cached = _cache.get(ken);
    if (force || !cached || now - cached.at > CACHE_TTL_MS) {
      const data = await loadByPrefecture(tableId, ken);
      _cache.set(ken, { at: now, data });
    }
    const entry = _cache.get(ken)!;
    return NextResponse.json({
      success: true,
      ken,
      count: entry.data.length,
      cachedAt: entry.at,
      records: entry.data,
    });
  } catch (error: any) {
    console.error("[kijun-fusoku] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
