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
import { getLarkTables, KIJUN_FUSOKU_FIELDS as F, KIJUN_FUSOKU_CONST_FIELDS as CFIELDS } from "../../lib/lark-tables";

const DEFAULT_XLSX = path.join(os.homedir(), "Downloads", "基準風速_垂直積雪量検索 (3).xlsx");
const SHEET = "積雪・風速元データ";

// 「積雪・風速元データ」の絶対列インデックス（A=0）。データは R8〜。
// D=県名(3) E=市郡区(4) F=区分1(5) G=区分2(6) H=区分3(7)
// Q=基準風速(16) R=積雪量(17) S=標高計算(18) T=符号(19) U=基準値(20) V=備考(21) W=算出方法(22)
// 定数1〜19 = Y(24)〜AQ(42)（連番）, 計算パターンID = AR(43)
const CONST_START = 24; // 定数1 の列（Y）
const CONST_COUNT = 19; // 定数1〜19
const COL = {
  ken: 3, shi: 4, k1: 5, k2: 6, k3: 7, wind: 16, snow: 17, elevFlag: 18, elevSign: 19, elevBase: 20, note: 21, elevMethod: 22,
  pid: 43,
};
const DATA_START = 7; // R8（0始まり）

interface SrcRow {
  ken: string; shi: string; k1: string; k2: string; k3: string;
  wind: number | null; snow: number | null; elev: boolean;
  elevSign: string; elevBase: number | null; elevMethod: string; note: string;
  consts: (number | null)[]; pid: string;
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

/** Excel を読み込み正規化（絶対列アドレスで読取） */
function readExcel(file: string): SrcRow[] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`シート「${SHEET}」が見つかりません: ${file}`);
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  const cell = (R: number, c: number): any => {
    const x = ws[XLSX.utils.encode_cell({ r: R, c })];
    return x == null ? "" : x.v;
  };
  const out: SrcRow[] = [];
  for (let R = DATA_START; R <= range.e.r; R++) {
    const ken = s(cell(R, COL.ken));
    if (!ken) continue; // 県名が無い行はスキップ
    out.push({
      ken,
      shi: s(cell(R, COL.shi)),
      k1: s(cell(R, COL.k1)),
      k2: s(cell(R, COL.k2)),
      k3: s(cell(R, COL.k3)),
      wind: numI(cell(R, COL.wind)),
      snow: numI(cell(R, COL.snow)),
      elev: s(cell(R, COL.elevFlag)) === "〇" || s(cell(R, COL.elevFlag)) === "○",
      elevSign: s(cell(R, COL.elevSign)),
      elevBase: numI(cell(R, COL.elevBase)),
      elevMethod: s(cell(R, COL.elevMethod)),
      note: s(cell(R, COL.note)),
      // 定数1〜19。係数（0.002 等）を含むため丸めない
      consts: Array.from({ length: CONST_COUNT }, (_, i) => num(cell(R, CONST_START + i))),
      pid: s(cell(R, COL.pid)),
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
    cur.consts = cur.consts.map((v, idx) => v ?? r.consts[idx]);
    cur.pid = cur.pid || r.pid;
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
  // 計算パターン（標高依存積雪の確定算出用）。定数1〜19
  r.consts.forEach((v, idx) => { if (v != null && idx < CFIELDS.length) f[CFIELDS[idx]] = v; });
  if (r.pid) f[F.pattern_id] = r.pid;
  return f;
}

/** 数値として比較するフィールド名の集合（diff 用） */
const NUMERIC_FIELDS = new Set<string>([F.wind, F.snow, F.elev_base, ...CFIELDS]);

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
    } else if (NUMERIC_FIELDS.has(k)) {
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
      consts: Array.from({ length: CONST_COUNT }, (_, i) => i + 1), pid: "K001",
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
