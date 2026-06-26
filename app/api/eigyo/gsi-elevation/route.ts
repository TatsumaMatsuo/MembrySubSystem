import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 国土地理院（地理院地図/GSI）の公開APIで、地名→代表点座標→標高 を取得する中継API。
 *
 * クライアントから直接 GSI を叩かず（CORS回避・規約準拠）サーバ経由で取得する。
 * クエリ: ken, shi, k1, k2, k3（県名・市郡区・区分1〜3）。
 *
 * ⚠️ 返す標高は地名の**代表点1点**であり、実際の建築敷地の標高とは異なる。
 *    あくまで「目安」。最終値は地理院地図で実敷地を指定して確認すること。
 */

const ADDRESS_SEARCH = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const GET_ELEVATION = "https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php";

async function geocode(query: string): Promise<{ lon: number; lat: number; title: string } | null> {
  const url = `${ADDRESS_SEARCH}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": "membrysubsystem/1.0" } });
  if (!res.ok) return null;
  const arr: any[] = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const c = arr[0]?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  return { lon: Number(c[0]), lat: Number(c[1]), title: arr[0]?.properties?.title || query };
}

async function elevation(lon: number, lat: number): Promise<{ elevation: number | null; source: string }> {
  const url = `${GET_ELEVATION}?lon=${lon}&lat=${lat}&outtype=JSON`;
  const res = await fetch(url, { headers: { "User-Agent": "membrysubsystem/1.0" } });
  if (!res.ok) return { elevation: null, source: "" };
  const j: any = await res.json();
  const e = Number(j?.elevation);
  // データ無し地点は "-----" 等が返る
  return { elevation: Number.isFinite(e) ? e : null, source: String(j?.hsrc || "") };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = (k: string) => (url.searchParams.get(k) || "").trim();
  const ken = p("ken"), shi = p("shi"), k1 = p("k1"), k2 = p("k2"), k3 = p("k3");
  if (!ken) {
    return NextResponse.json({ success: false, error: "県名(ken)を指定してください" }, { status: 400 });
  }

  // 詳細→粗 の順に住所検索（区分名は地名化しないことがあるため段階的にフォールバック）
  const candidates = [
    [ken, shi, k1, k2, k3].filter(Boolean).join(""),
    [ken, shi, k1].filter(Boolean).join(""),
    [ken, shi].filter(Boolean).join(""),
  ].filter((q, i, a) => q && a.indexOf(q) === i);

  try {
    let hit: { lon: number; lat: number; title: string } | null = null;
    let usedQuery = "";
    for (const q of candidates) {
      hit = await geocode(q);
      if (hit) { usedQuery = q; break; }
    }
    if (!hit) {
      return NextResponse.json({ success: false, error: "代表地点を特定できませんでした", queries: candidates });
    }
    const elev = await elevation(hit.lon, hit.lat);
    return NextResponse.json({
      success: true,
      lon: hit.lon,
      lat: hit.lat,
      title: hit.title,
      query: usedQuery,
      elevation: elev.elevation,
      source: elev.source,
    });
  } catch (error: any) {
    console.error("[gsi-elevation] Error:", error);
    return NextResponse.json({ success: false, error: "地理院APIの取得に失敗しました", detail: error?.message }, { status: 502 });
  }
}
