/**
 * 棚卸: システム在庫情報の EXCEL 取込ロジック（純関数 + パース）
 *
 * - EXCEL 48列 と Lark「システム在庫情報」48列は列名・列順が完全一致（Phase 0 実査済）。
 *   したがって列マッピングは恒等写像。ここでは「型変換」と「検証」だけを担う。
 * - サーバ/クライアント両方から import できる純ロジック（parseStockFile のみ XLSX に依存）。
 */
import * as XLSX from "xlsx";

/** 期待するEXCELヘッダー（この順・この名称でなければ取込を中止する） */
export const STOCK_EXPECTED_HEADER = [
  "締日", "倉庫コード", "倉庫", "棚番", "品番", "品名", "品名2", "単位",
  "標準単価", "繰越日", "繰越金額", "繰越", "入庫", "出庫", "在庫数",
  "補正入庫数", "補正出庫数", "移動入庫数", "移動出庫数", "調整入庫数", "調整出庫数",
  "棚卸数", "調整数", "前月単価", "最終仕入日", "最終仕入単価", "仕入数量", "仕入金額",
  "返品数量", "返品金額", "在庫単価", "入庫金額", "出庫金額", "移動入庫金額", "移動出庫金額",
  "調整入庫金額", "調整出庫金額", "棚卸調整金額", "調整金額", "在庫金額",
  "繰越金額_旧単価", "入庫金額_旧単価", "出庫金額_旧単価", "調整金額2_旧単価", "在庫金額_旧単価",
  "差異単価", "差異金額", "計算方法",
] as const;

/** Lark 側で DateTime 型の列（epoch ms で書き込む）。※「最終仕入日」は Lark 側 Text なので含めない */
export const STOCK_DATE_COLS = new Set(["締日", "繰越日"]);

/** Lark 側で Number 型の列（数値で書き込む）。それ以外は Text（文字列のまま） */
export const STOCK_NUMBER_COLS = new Set([
  "倉庫コード", "調整入庫数", "調整出庫数", "棚卸数", "調整数", "返品数量", "返品金額",
]);

/** 突合の一意性に必須の列（空だとエラー） */
export const STOCK_REQUIRED_COLS = ["締日", "倉庫コード", "倉庫", "品番"] as const;

export type Cell = string | number | boolean | null;

/** カンマ区切り文字列("75,480")や全角空白を含む在庫数値をパースする。数値化できなければ null */
export function parseStockNumber(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").replace(/[　\s]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "YYYY/MM/DD" または "YYYY-MM-DD" を JST 真夜中の epoch ms へ。Excelシリアル数値も許容 */
export function ymdToJstEpoch(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  // Excel シリアル値（1900日付システム）。通常は parseStockFile が Date→文字列にするため稀
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000); // 1970-01-01 からの日数換算（UTC）
    const dt = new Date(ms);
    return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) - 9 * 3600 * 1000; // JST真夜中へ
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d)) - 9 * 3600 * 1000;
}

/** ヘッダー検証。問題があればメッセージ配列を返す（空なら正常） */
export function validateStockHeader(header: string[]): string[] {
  const issues: string[] = [];
  const norm = header.map((h) => String(h ?? "").trim());
  if (norm.length !== STOCK_EXPECTED_HEADER.length) {
    issues.push(`列数が違います（期待 ${STOCK_EXPECTED_HEADER.length} / 実際 ${norm.length}）`);
  }
  for (let i = 0; i < STOCK_EXPECTED_HEADER.length; i++) {
    if (norm[i] !== STOCK_EXPECTED_HEADER[i]) {
      issues.push(`${i + 1}列目: 期待"${STOCK_EXPECTED_HEADER[i]}" 実際"${norm[i] ?? "(無し)"}"`);
    }
  }
  return issues;
}

/**
 * 1行（ヘッダー順のセル配列）を Lark フィールドへ変換。
 * 空セルはキー自体をセットしない（Lark 側は未設定 = 空扱い）。
 */
export function buildStockFields(header: string[], row: Cell[]): {
  fields: Record<string, any>;
  error?: string;
} {
  const fields: Record<string, any> = {};
  for (let i = 0; i < header.length; i++) {
    const col = header[i];
    const v = row[i];
    if (v === null || v === undefined || v === "") continue;

    if (STOCK_DATE_COLS.has(col)) {
      const ms = ymdToJstEpoch(v);
      if (ms !== null) fields[col] = ms;
    } else if (STOCK_NUMBER_COLS.has(col)) {
      const n = parseStockNumber(v);
      if (n !== null) fields[col] = n;
    } else {
      const s = String(v).trim();
      if (s !== "" && s !== "　") fields[col] = s;
    }
  }

  // 必須列チェック（突合の一意性が壊れると棚卸全体が破綻するため、部分取込しない）
  for (const req of STOCK_REQUIRED_COLS) {
    if (fields[req] === undefined) {
      return { fields, error: `必須列 "${req}" が空です` };
    }
  }
  return { fields };
}

export interface ParsedStockFile {
  sheetName: string;
  header: string[];
  rows: Cell[][];
  headerIssues: string[];
  /** 必須列が空などの行エラー（先頭数件）。削除を始める前にこれで取込可否を判断する */
  rowIssues: string[];
  /** rowIssues の総数（rowIssues は先頭のみ保持するため別途件数を持つ） */
  rowIssueCount: number;
  /** 倉庫コードの DISTINCT 数（プレビュー用） */
  warehouseCount: number;
}

/** 1行の必須列が埋まっているかを検証（buildStockFields と同じ必須ルール）。問題があればメッセージ */
export function validateStockRow(header: string[], row: Cell[], rowNumber: number): string | null {
  for (const req of STOCK_REQUIRED_COLS) {
    const i = header.indexOf(req);
    const v = i >= 0 ? row[i] : null;
    const empty = v === null || v === undefined || String(v).trim() === "" || String(v).trim() === "　";
    if (empty) return `行 ${rowNumber}: 必須列 "${req}" が空です`;
  }
  return null;
}

/**
 * クライアント側で EXCEL をパースする。
 * 日付列（締日/繰越日）は Date セルを "YYYY/MM/DD" 文字列へ正規化してから返す
 * （JSON 送信でタイムゾーンがぶれないようにするため）。
 */
export function parseStockFile(buf: ArrayBuffer): ParsedStockFile {
  const wb = XLSX.read(buf, { cellDates: true });
  const sheetName = wb.SheetNames.includes("data") ? "data" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // cellDates:true では日付セルが Date で入るため any[][] で受ける
  const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const header = (aoa[0] || []).map((h) => String(h ?? "").trim());
  const dateIdx = new Set(header.map((h, i) => (STOCK_DATE_COLS.has(h) ? i : -1)).filter((i) => i >= 0));
  const whIdx = header.indexOf("倉庫コード");

  const warehouses = new Set<string>();
  const rows: Cell[][] = [];
  const rowIssues: string[] = [];
  let rowIssueCount = 0;
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (!row.some((c) => c !== null && c !== undefined && c !== "")) continue; // 空行スキップ
    const out: Cell[] = header.map((_, i) => {
      const cell = row[i] ?? null;
      if (dateIdx.has(i) && cell instanceof Date) {
        return `${cell.getFullYear()}/${String(cell.getMonth() + 1).padStart(2, "0")}/${String(cell.getDate()).padStart(2, "0")}`;
      }
      return cell as Cell;
    });
    if (whIdx >= 0 && out[whIdx] != null) warehouses.add(String(out[whIdx]));

    // 事前検証: 必須列の空を検出（削除より前に取込可否を判断するため）
    const issue = validateStockRow(header, out, r + 1); // r+1 = EXCELの行番号(ヘッダー=1行目)
    if (issue) {
      rowIssueCount++;
      if (rowIssues.length < 10) rowIssues.push(issue);
    }
    rows.push(out);
  }

  return {
    sheetName,
    header,
    rows,
    headerIssues: validateStockHeader(header),
    rowIssues,
    rowIssueCount,
    warehouseCount: warehouses.size,
  };
}
