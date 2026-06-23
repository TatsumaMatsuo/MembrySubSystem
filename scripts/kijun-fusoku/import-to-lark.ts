/**
 * 基準風速・積雪量マスタ への Excel 一括投入（Excel → Lark Bitable）。
 *
 *   npx tsx scripts/kijun-fusoku/import-to-lark.ts                 # dry-run（差分サマリのみ）
 *   npx tsx scripts/kijun-fusoku/import-to-lark.ts --execute       # 実投入（project base へ書込）
 *   npx tsx scripts/kijun-fusoku/import-to-lark.ts --file <path>   # Excel パス指定
 *
 * 入力: 基準風速・垂直積雪量検索.xlsx の「積雪・風速元データ」シート（ヘッダ R7, データ R8〜）。
 * 突合キー = 県名|市・郡・区|区分1|区分2|区分3 の複合。新規=create / 差分=update / 一致=skip（冪等）。
 * 空上書き防止: Excel側が空の項目で既存値を潰さない。
 *
 * ⚠️ --execute は project base への実書込。
 */
import * as XLSX from "xlsx";
import * as path from "path";
import * as os from "os";
import {
  getBaseRecords,
  batchCreateBaseRecords,
  batchUpdateBaseRecords,
  createBaseRecord,
  deleteBaseRecord,
  getLarkBaseToken,
} from "../../lib/lark-client";
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F } from "../../lib/lark-tables";

const DEFAULT_XLSX = path.join(os.homedir(), "Downloads", "基準風速・垂直積雪量検索.xlsx");
const SHEET = "積雪・風速元データ";

// 「積雪・風速元データ」の列インデックス（range が B 始まりのため index0 = B 列）
// B=県番号(0) D=県名(2) E=市郡区(3) F=区分1(4) G=区分2(5) H=区分3(6)
// Q=基準風速(15) R=垂直積雪量(16) S=標高計算(17) T=符号(18) U=基準標高(19) V=備考(20) W=算出方法(21)
const COL = { ken: 2, shi: 3, k1: 4, k2: 5, k3: 6, wind: 15, snow: 16, elevFlag: 17, elevSign: 18, elevBase: 19, note: 20, elevMethod: 21 };

interface SrcRow {
  ken: string; shi: string; k1: string; k2: string; k3: string;
  wind: number | null; snow: number | null; elev: boolean;
  elevSign: string; elevBase: number | null; elevMethod: string; note: string;
}

const s = (v: any): string => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};
// 風速(m/s)・積雪(cm)・標高(m)は整数。Excel由来の浮動小数点誤差(55.00000000000001等)を丸める。
const numI = (v: any): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const key = (r: { ken: string; shi: string; k1: string; k2: string; k3: string }) =>
  [r.ken, r.shi, r.k1, r.k2, r.k3].map((x) => s(x)).join("|");

/** Excel を読み込み正規化 */
function readExcel(file: string): SrcRow[] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`シート「${SHEET}」が見つかりません: ${file}`);
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
  const out: SrcRow[] = [];
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const ken = s(r[COL.ken]);
    if (!ken) continue; // 県名が無い行はスキップ
    out.push({
      ken,
      shi: s(r[COL.shi]),
      k1: s(r[COL.k1]),
      k2: s(r[COL.k2]),
      k3: s(r[COL.k3]),
      wind: numI(r[COL.wind]),
      snow: numI(r[COL.snow]),
      elev: s(r[COL.elevFlag]) === "〇",
      elevSign: s(r[COL.elevSign]),
      elevBase: numI(r[COL.elevBase]),
      elevMethod: s(r[COL.elevMethod]),
      note: s(r[COL.note]),
    });
  }
  return out;
}

/**
 * 複合キーで名寄せ（Excelの重複行を1件に統合）。
 * - 風速/積雪/符号/基準標高/算出方法/備考: 先勝ち（空でない最初の値）
 * - 標高計算有無: いずれかが true なら true
 */
function dedupe(src: SrcRow[]): SrcRow[] {
  const map = new Map<string, SrcRow>();
  for (const r of src) {
    const k = key(r);
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r });
      continue;
    }
    cur.wind = cur.wind ?? r.wind;
    cur.snow = cur.snow ?? r.snow;
    cur.elev = cur.elev || r.elev;
    cur.elevSign = cur.elevSign || r.elevSign;
    cur.elevBase = cur.elevBase ?? r.elevBase;
    cur.elevMethod = cur.elevMethod || r.elevMethod;
    cur.note = cur.note || r.note;
  }
  return [...map.values()];
}

/** SrcRow → Lark フィールド（空項目は書かない＝既存を潰さない。キー列とフラグ・風速は常に出力） */
function buildFields(r: SrcRow): Record<string, any> {
  const f: Record<string, any> = {
    [F.ken]: r.ken,
    [F.elev_flag]: r.elev,
  };
  if (r.shi) f[F.shi] = r.shi;
  if (r.k1) f[F.k1] = r.k1;
  if (r.k2) f[F.k2] = r.k2;
  if (r.k3) f[F.k3] = r.k3;
  if (r.wind != null) f[F.wind] = r.wind;
  if (r.snow != null) f[F.snow] = r.snow;
  if (r.elevSign) f[F.elev_sign] = r.elevSign;
  if (r.elevBase != null) f[F.elev_base] = r.elevBase;
  if (r.elevMethod) f[F.elev_method] = r.elevMethod;
  if (r.note) f[F.note] = r.note;
  return f;
}

const txt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
};

/** 既存レコードとの差分キーを返す（冪等更新用） */
function diff(cur: Record<string, any>, next: Record<string, any>): Record<string, any> {
  const changed: Record<string, any> = {};
  for (const [k, v] of Object.entries(next)) {
    if (k === F.elev_flag) {
      if ((cur[k] === true) !== (v === true)) changed[k] = v;
    } else if (k === F.wind || k === F.snow || k === F.elev_base) {
      if (num(cur[k]) !== num(v)) changed[k] = v;
    } else {
      if (txt(cur[k]).trim() !== txt(v).trim()) changed[k] = v;
    }
  }
  return changed;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const dryRun = !execute;
  const fileArg = process.argv.indexOf("--file");
  const file = fileArg >= 0 ? process.argv[fileArg + 1] : DEFAULT_XLSX;

  const tableId = getLarkTables().KIJUN_FUSOKU;
  const baseToken = getLarkBaseToken();
  if (!tableId) {
    console.error("✗ KIJUN_FUSOKU テーブルIDが未設定です。lib/lark-tables.ts を確認してください。");
    process.exit(2);
  }

  console.log(`=== 基準風速・積雪量マスタ 投入 ${dryRun ? "(DRY-RUN)" : "(EXECUTE — project base へ書込)"} ===`);
  console.log(`  Excel: ${file}`);
  console.log(`  table_id: ${tableId}\n`);

  // 1) Excel 読込 + 名寄せ
  const raw = readExcel(file);
  const src = dedupe(raw);
  console.log(`[1/4] Excel 読込: ${raw.length} 行 → 名寄せ後 ${src.length} 行（重複統合 ${raw.length - src.length} 件）`);
  // 簡易バリデーション
  const noWind = src.filter((r) => r.wind == null).length;
  const prefs = new Set(src.map((r) => r.ken));
  console.log(`  風速空: ${noWind} / 県名種類: ${prefs.size}`);

  // 2) プリフライト: 全フィールド名が書込可能か1行で検証（execute時のみ）
  if (execute) {
    console.log(`[2/4] フィールド名プリフライト...`);
    const probe = buildFields({
      ken: "_接続テスト", shi: "_", k1: "_", k2: "_", k3: "_",
      wind: 30, snow: 100, elev: true, elevSign: "<=", elevBase: 500, elevMethod: "_", note: "_",
    });
    let probeId: string | undefined;
    try {
      const r: any = await createBaseRecord(tableId, probe, { baseToken });
      probeId = r.data?.record?.record_id;
      if (probeId) await deleteBaseRecord(tableId, probeId, { baseToken });
      console.log(`  ✓ 全フィールド書込OK`);
    } catch (e: any) {
      console.error(`  ✗ フィールド書込に失敗。テーブルのフィールド名を確認してください。\n    ${e?.message || e}`);
      process.exit(3);
    }
  } else {
    console.log(`[2/4] プリフライトは execute 時のみ実施`);
  }

  // 3) 既存レコード読込 → 複合キーで突合
  console.log(`[3/4] 既存レコード読込...`);
  const existing = new Map<string, { recordId: string; fields: Record<string, any> }>();
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(tableId, { baseToken, pageSize: 500, pageToken });
    for (const it of res.data?.items || []) {
      const fields = it.fields || {};
      const k = key({
        ken: txt(fields[F.ken]), shi: txt(fields[F.shi]),
        k1: txt(fields[F.k1]), k2: txt(fields[F.k2]), k3: txt(fields[F.k3]),
      });
      existing.set(k, { recordId: it.record_id, fields });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  console.log(`  既存 ${existing.size} 行`);

  // 4) 突合
  const toCreate: Record<string, any>[] = [];
  const toUpdate: { record_id: string; fields: Record<string, any> }[] = [];
  let skip = 0;
  for (const r of src) {
    const next = buildFields(r);
    const ex = existing.get(key(r));
    if (!ex) {
      toCreate.push(next);
    } else {
      const ch = diff(ex.fields, next);
      if (Object.keys(ch).length) toUpdate.push({ record_id: ex.recordId, fields: ch });
      else skip++;
    }
  }

  console.log(`\n=== サマリ ===`);
  console.log(`  CREATE(新規) : ${toCreate.length}`);
  console.log(`  UPDATE(変更) : ${toUpdate.length}`);
  console.log(`  SKIP(一致)   : ${skip}`);

  if (dryRun) {
    console.log(`\n(dry-run のため書き込んでいません。反映するには --execute)`);
    return;
  }

  console.log(`\n[4/4] 投入中...`);
  if (toCreate.length) {
    await batchCreateBaseRecords(tableId, toCreate, { baseToken });
    console.log(`  + CREATE ${toCreate.length} 件 完了`);
  }
  if (toUpdate.length) {
    await batchUpdateBaseRecords(tableId, toUpdate, { baseToken });
    console.log(`  ~ UPDATE ${toUpdate.length} 件 完了`);
  }
  console.log(`\n✅ 投入完了`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e);
  process.exit(1);
});
