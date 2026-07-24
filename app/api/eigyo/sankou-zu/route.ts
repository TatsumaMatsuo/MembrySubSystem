import { NextResponse } from "next/server";
import { getBaseRecords, getLarkBaseToken } from "@/lib/lark-client";
import { isBoxConfigured } from "@/lib/box-client";
import {
  getLarkTables,
  SANKOU_DAICHO_FIELDS,
  SANKOU_DAICHO_NUMERIC_FIELDS,
  SANKOU_BUHIN_FIELDS,
  SANKOU_HANYOU_SYSTEM,
  SANKOU_KENYA_NAME_FIELD,
  SANKOU_KENYA_CODE_FIELD,
} from "@/lib/lark-tables";

type KenyaOption = { code: string; name: string };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 参考図台帳検索 データ API。
 *
 * 【分割取得】以前は台帳(4,268行)＋各マスタを1リクエストで全件返していたが、
 * Amplify(CloudFront)の28秒制限に掛かり画面表示直後に 504 となることがあったため、
 * 用途で2つに分けている。
 *
 *  - `?part=master`（既定）: 部品マスタ/汎用マスタ/建屋区分マスタ + pdfEnabled。
 *      軽量なのでモジュールキャッシュ(TTL 1時間)で保持し、画面初期表示で取得する。
 *  - `?part=daicho&pageToken=xxx`: 参考図面台帳を **1ページ(500件)ずつ** 返す。
 *      クライアントが nextPageToken を辿って全件を集める。1リクエストが短時間で終わる
 *      ため 504 にならない。取得は画面の「検索」「更新」ボタン押下時のみ。
 *
 * 検索/絞り込みはクライアント側で行う（件数が中規模のため全件保持で十分）。
 * 各レコードは空値を除いたフィールドのみ保持してペイロードを軽量化する。数値フィールドは
 * number、それ以外は string。PDF(Box)中継は別途手配が必要なため pdfEnabled で可否を返す。
 */

type BuhinRecord = Record<string, string | number>;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間
const NUMERIC = new Set<string>(SANKOU_DAICHO_NUMERIC_FIELDS);
const DAICHO_PAGE_SIZE = 500; // Larkの1回あたり取得上限
const MAX_PAGES_PER_REQUEST = 4; // 1リクエストでまとめる最大ページ数(=最大2,000件)
const SOFT_LIMIT_MS = 6000; // この時間を超えたら追加ページを取りに行かない(28秒制限への余裕)

// マスタ類のみキャッシュ（台帳はページ単位で都度取得し、クライアント側で保持する）
let _master: { at: number; buhin: BuhinRecord[]; hanyou: Record<string, string[]>; kenya: KenyaOption[] } | null = null;

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

/** Larkレコードの fields を、対象フィールドに沿って空値を除いたオブジェクトへ整形。 */
function mapRow(
  f: Record<string, any>,
  fields: readonly string[],
  numericFields: Set<string>
): Record<string, string | number> {
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
  return rec;
}

/** 1テーブルを全件取得し、フィールド配列に沿って整形。(マスタ用。台帳はページ単位で取得する) */
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
    for (const it of res.data?.items || []) out.push(mapRow(it.fields || {}, fields, numericFields));
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

/**
 * 建屋区分マスタから {建屋区分コード, 建屋区分名称} の一覧(名称50音順)を取得。
 * 絞り込みは名称で照合、登録はコードを台帳「建屋区分」へ書き込む。
 */
async function loadKenya(tableId: string): Promise<KenyaOption[]> {
  const baseToken = getLarkBaseToken();
  const byName = new Map<string, KenyaOption>();
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const name = textOf(it.fields?.[SANKOU_KENYA_NAME_FIELD]).trim();
      const code = textOf(it.fields?.[SANKOU_KENYA_CODE_FIELD]).trim();
      if (name && !byName.has(name)) byName.set(name, { code, name });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true }));
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
  const part = url.searchParams.get("part") === "daicho" ? "daicho" : "master";
  const force = url.searchParams.get("refresh") === "1";

  try {
    // ── 台帳: 分割して返す。続きは nextPageToken をクライアントが辿る ──
    // Larkの1ページは500件。応答が速いときはまとめて返して往復回数を減らすが、
    // 経過時間(SOFT_LIMIT_MS)と最大ページ数で打ち切り、1リクエストが28秒に近づかないようにする。
    if (part === "daicho") {
      const baseToken = getLarkBaseToken();
      const started = Date.now();
      const daicho: Record<string, string | number>[] = [];
      let pageToken = url.searchParams.get("pageToken") || undefined;
      let total: number | undefined;
      for (let p = 0; p < MAX_PAGES_PER_REQUEST; p++) {
        const res: any = await getBaseRecords(tables.SANKOU_DAICHO, { baseToken, pageSize: DAICHO_PAGE_SIZE, pageToken });
        for (const it of res.data?.items || []) daicho.push(mapRow(it.fields || {}, SANKOU_DAICHO_FIELDS, NUMERIC));
        total = res.data?.total ?? total;
        pageToken = res.data?.has_more ? res.data?.page_token : undefined;
        if (!pageToken) break;
        if (Date.now() - started >= SOFT_LIMIT_MS) break; // 続きは次のリクエストで
      }
      return NextResponse.json({ success: true, daicho, nextPageToken: pageToken, total });
    }

    // ── マスタ類: 軽量なのでキャッシュして初期表示で取得 ──
    const now = Date.now();
    if (force || !_master || now - _master.at > CACHE_TTL_MS) {
      const [buhin, hanyou, kenya] = await Promise.all([
        loadTable(tables.SANKOU_BUHIN, SANKOU_BUHIN_FIELDS, new Set(["ID"])) as Promise<BuhinRecord[]>,
        tables.SANKOU_HANYOU ? loadHanyou(tables.SANKOU_HANYOU) : Promise.resolve({}),
        tables.SANKOU_KENYA ? loadKenya(tables.SANKOU_KENYA) : Promise.resolve([]),
      ]);
      _master = { at: now, buhin, hanyou, kenya };
    }
    return NextResponse.json({
      success: true,
      cachedAt: _master.at,
      counts: { buhin: _master.buhin.length },
      pdfEnabled: isBoxConfigured(),
      buhin: _master.buhin,
      hanyou: _master.hanyou,
      kenya: _master.kenya,
    });
  } catch (error: any) {
    console.error("[sankou-zu] Error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}
