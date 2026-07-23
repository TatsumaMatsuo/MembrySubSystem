/**
 * 棚卸: 集計・突合の純関数（Lark 非依存。単体テスト対象）
 *
 * 業務上の正しさの中心。差分算出（F-07）と確定値決定（F-11）をここに集約する。
 */
import type { DiffRow } from "./types";

/** 実績の品目別集計 */
export interface ActualAgg {
  qty: number; // 有効実績の数量合計
  itemName: string; // 品名スナップショット（品名+規格）
  states: Record<string, number>; // 在庫状態内訳 例 {良品:20, 不良品:4}
  reasonCode?: string; // 差分理由（最新入力）
}

/** システム在庫の品目情報 */
export interface StockInfo {
  systemQty: number;
  itemName: string;
  spec: string;
}

/** 在庫状態内訳を "良品 20 / 不良品 4" に整形 */
export function formatStateBreakdown(states: Record<string, number>): string {
  return Object.entries(states)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v}`)
    .join(" / ");
}

/**
 * 差分算出（倉庫＋品目単位）。
 * - 実棚 ≠ システム在庫 → 差分行
 * - システム在庫あり＆報告なし → 実棚0として差分（F-07）
 * - 実棚あり＆システム在庫なし → 差分（差分数 = 実棚）
 * 一致は除外。
 */
export function computeDiffs(
  actual: Map<string, ActualAgg>,
  stock: Map<string, StockInfo>,
  round: number
): DiffRow[] {
  const codes = new Set<string>([...actual.keys(), ...stock.keys()]);
  const rows: DiffRow[] = [];
  for (const code of codes) {
    const a = actual.get(code);
    const s = stock.get(code);
    const actualQty = a?.qty ?? 0;
    const systemQty = s?.systemQty ?? 0;
    if (actualQty === systemQty) continue;
    // 品名と規格は分けて持つ（差分リストで別列に出力するため）
    const name = s?.itemName || a?.itemName || "";
    const spec = s?.spec || "";
    rows.push({
      itemCode: code,
      itemName: name,
      spec,
      systemQty,
      actualQty,
      diffQty: actualQty - systemQty,
      stateBreakdown: a ? formatStateBreakdown(a.states) : "",
      reasonCode: a?.reasonCode,
      round,
    });
  }
  return rows.sort((x, y) => x.itemCode.localeCompare(y.itemCode));
}

/** 確定値の1行（基幹連携出力 F-11） */
export interface ConfirmedRow {
  warehouseCode: string;
  warehouseName: string;
  itemCode: string;
  itemName: string;
  spec: string;
  qty: number; // 確定実棚数量（最大回数の値）
  systemQty: number;
  diffQty: number;
  round: number; // 採用した回数
  reasonCode?: string;
  staff: string;
}

/** 倉庫＋品目ごとの、回数別実績（confirmedValue 用の入力） */
export interface RoundValue {
  round: number;
  qty: number;
  reasonCode?: string;
  staff: string;
}

/**
 * 確定値の決定（F-11）：同一 倉庫＋品目 に複数回の入力があれば
 * 最も回数の大きい（＝最新の）棚卸回数の値を正として採用する。
 * その回に報告が無い品目は、報告のあった最大回数の値を採用（無ければ0）。
 */
export function pickConfirmedQty(values: RoundValue[]): RoundValue | null {
  if (!values.length) return null;
  return values.reduce((best, v) => (v.round > best.round ? v : best));
}
