/**
 * 棚卸: Lark Base アクセス層（サーバ専用）
 * テーブルIDは lib/lark-tables.ts の requireTanaoroshiTable() で env から解決する。
 */
import {
  getBaseRecords,
  batchDeleteBaseRecords,
  batchCreateBaseRecords,
  batchUpdateBaseRecords,
  createBaseRecord,
  updateBaseRecord,
  deleteBaseRecord,
  getLarkClient,
  getLarkBaseToken,
} from "@/lib/lark-client";
import {
  getLarkTables,
  requireTanaoroshiTable,
  TANAOROSHI_PERIOD_FIELDS,
  TANAOROSHI_AUDIT_FIELDS,
  TANAOROSHI_ENTRY_FIELDS,
  TANAOROSHI_DIFF_FIELDS,
  TANAOROSHI_STOCK_FIELDS,
  TANAOROSHI_WH_STATUS_FIELDS,
  TANAOROSHI_REASON_FIELDS,
  TANAOROSHI_ITEM_MASTER_FIELDS,
  TANAOROSHI_RESULT_FIELDS,
  TANAOROSHI_WAREHOUSE_MASTER_FIELDS,
  TANAOROSHI_NOTIFY_TARGET_FIELDS,
  TANAOROSHI_NOTIFY_LOG_FIELDS,
} from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { parseStockNumber } from "./stock-import";
import { computeDiffs, pickConfirmedQty, type ActualAgg, type StockInfo, type ConfirmedRow, type RoundValue } from "./aggregate";
import { notifyDiffIssued, notifyClosed, notifyAllReported } from "./notify";
import type { Warehouse, CatalogItem, ReasonCode, DiffRow, ProgressRow } from "./types";

/** 参照テーブル（既存・env にフォールバックIDあり） */
export const STOCK_TABLE_ID = () => getLarkTables().TANAOROSHI_STOCK;
export const RESULT_TABLE_ID = () => getLarkTables().TANAOROSHI_RESULT;

/**
 * 初期化可能なテーブルのホワイトリスト（誤って業務テーブルを消さないため明示）。
 * needsActivePeriodGuard: 実施中の棚卸期があるとき初期化を拒否するか。
 */
export const PURGEABLE_TABLES: Record<
  string,
  { id: () => string; label: string; needsActivePeriodGuard: boolean }
> = {
  stock: { id: STOCK_TABLE_ID, label: "システム在庫情報", needsActivePeriodGuard: true },
  result: { id: RESULT_TABLE_ID, label: "棚卸在庫情報", needsActivePeriodGuard: false },
  // 棚卸稼働データ（F-15: 締め後にアーカイブ→初期化）
  entry: { id: () => requireTanaoroshiTable("TANAOROSHI_ENTRY"), label: "棚卸_実績", needsActivePeriodGuard: true },
  diff: { id: () => requireTanaoroshiTable("TANAOROSHI_DIFF"), label: "棚卸_差分リスト", needsActivePeriodGuard: true },
  wh_status: { id: () => requireTanaoroshiTable("TANAOROSHI_WH_STATUS"), label: "棚卸_倉庫進捗", needsActivePeriodGuard: true },
};

/** アーカイブ可能なテーブル（EXCEL出力用）。列順は *_FIELDS の定義順に従う */
export const ARCHIVABLE_TABLES: Record<
  string,
  { id: () => string; label: string; fields: Record<string, string> }
> = {
  entry: { id: () => requireTanaoroshiTable("TANAOROSHI_ENTRY"), label: "棚卸_実績", fields: TANAOROSHI_ENTRY_FIELDS },
  diff: { id: () => requireTanaoroshiTable("TANAOROSHI_DIFF"), label: "棚卸_差分リスト", fields: TANAOROSHI_DIFF_FIELDS },
};

/**
 * list API で全ページ取得（文字列フィルタ対応）。
 * search API は filter が構造化オブジェクト必須のため、単純な突合には list API を使う。
 * 返り値は fields をトップレベルに展開し record_id を付与（r[列名] / r.record_id でアクセス可能）。
 */
async function listAll(
  tableId: string,
  opts?: { filter?: string; fieldNames?: string[]; baseToken?: string }
): Promise<Record<string, any>[]> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const appToken = opts?.baseToken || getLarkBaseToken();
  const out: Record<string, any>[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: appToken, table_id: tableId },
      params: {
        filter: opts?.filter,
        field_names: opts?.fieldNames ? JSON.stringify(opts.fieldNames) : undefined,
        page_size: 500,
        page_token: pageToken,
      },
    });
    if (res.code !== 0) throw new Error(`Lark取得失敗 table=${tableId} code=${res.code} msg=${res.msg}`);
    for (const it of res.data?.items || []) out.push({ ...(it.fields || {}), record_id: it.record_id });
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

/** 全レコードを取得（アーカイブ用。フィールド値はテキスト展開） */
export async function fetchAllRecords(tableId: string): Promise<Record<string, any>[]> {
  let token: string | undefined;
  const out: Record<string, any>[] = [];
  do {
    const res = await getBaseRecords(tableId, { pageSize: 500, pageToken: token });
    for (const it of res.data?.items || []) out.push((it as any).fields || {});
    token = res.data?.has_more ? res.data?.page_token : undefined;
  } while (token);
  return out;
}

/** 先頭 limit 件の record_id を取得（削除ループ用） */
export async function fetchRecordIds(tableId: string, limit = 500): Promise<string[]> {
  const res = await getBaseRecords(tableId, { pageSize: limit });
  const items = res.data?.items || [];
  return items.map((i: any) => i.record_id).filter(Boolean);
}

/** テーブルの全レコード件数（進捗表示用。全ページ走査） */
export async function countRecords(tableId: string): Promise<number> {
  let count = 0;
  let token: string | undefined;
  do {
    const res = await getBaseRecords(tableId, { pageSize: 500, pageToken: token });
    count += (res.data?.items || []).length;
    token = res.data?.has_more ? res.data?.page_token : undefined;
  } while (token);
  return count;
}

/** 500件チャンクで削除 */
export async function deleteRecordIds(tableId: string, recordIds: string[]): Promise<void> {
  if (recordIds.length) await batchDeleteBaseRecords(tableId, recordIds);
}

/** 500件チャンクで登録 */
export async function createRecords(tableId: string, records: Record<string, any>[]): Promise<void> {
  if (records.length) await batchCreateBaseRecords(tableId, records);
}

/** 「実施中」の棚卸期の件数（在庫初期化のガードに使う） */
export async function countActivePeriods(): Promise<number> {
  const F = TANAOROSHI_PERIOD_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_PERIOD"), {
    filter: `CurrentValue.[${F.status}]="${escapeLarkFilterValue("実施中")}"`,
    fieldNames: [F.status],
  });
  return rows.length;
}

/* ===================== Phase 1: 入力機能 ===================== */

const norm = (v: any) => String(v ?? "").replace(/　/g, " ").trim(); // 全角空白→半角、trim
const S = TANAOROSHI_STOCK_FIELDS;

/** システム在庫の行を取得（必要列のみ・全ページ） */
async function fetchStockRows(): Promise<any[]> {
  return listAll(STOCK_TABLE_ID(), {
    fieldNames: [S.warehouse_code, S.warehouse_name, S.item_code, S.item_name, S.item_name2, S.unit, S.stock_qty],
  });
}

/** 倉庫一覧（システム在庫の 倉庫コード DISTINCT）。コード昇順 */
export async function getWarehouses(): Promise<Warehouse[]> {
  const rows = await fetchStockRows();
  const map = new Map<string, string>();
  for (const r of rows) {
    const code = norm(r[S.warehouse_code]);
    if (!code) continue;
    if (!map.has(code)) map.set(code, norm(r[S.warehouse_name]));
  }
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => Number(a.code) - Number(b.code) || a.code.localeCompare(b.code));
}

/** 指定倉庫の品目カタログ（システム在庫ベース） */
export async function getCatalogForWarehouse(warehouseCode: string): Promise<CatalogItem[]> {
  const rows = await fetchStockRows();
  const out: CatalogItem[] = [];
  for (const r of rows) {
    if (norm(r[S.warehouse_code]) !== norm(warehouseCode)) continue;
    const itemCode = norm(r[S.item_code]);
    if (!itemCode) continue;
    out.push({
      itemCode,
      itemName: norm(r[S.item_name]),
      spec: norm(r[S.item_name2]),
      unit: norm(r[S.unit]),
      systemQty: parseStockNumber(r[S.stock_qty]) ?? 0,
      inTarget: true, // 1回目は全対象（2回目以降の差分制御は Phase 3）
    });
  }
  return out;
}

/** 品目マスタから品名・規格・単位を引く（在庫にない品番の解決用）。無ければ null */
export async function getItemFromMaster(
  code: string
): Promise<{ itemName: string; spec: string; unit: string } | null> {
  const M = TANAOROSHI_ITEM_MASTER_FIELDS;
  const rows = await listAll(getLarkTables().TANAOROSHI_ITEM_MASTER, {
    filter: `CurrentValue.[${M.item_code}]="${escapeLarkFilterValue(code)}"`,
    fieldNames: [M.item_code, M.item_name, M.item_name2, M.unit],
  });
  if (!rows.length) return null;
  const r = rows[0];
  return { itemName: norm(r[M.item_name]), spec: norm(r[M.item_name2]), unit: norm(r[M.unit]) };
}

/**
 * 再棚卸（2回目以降）の対象カタログ。前回回数の差分リスト掲載品目のみを対象とする（F-08）。
 */
export async function getReTanaoroshiCatalog(
  periodId: string,
  warehouseCode: string,
  round: number
): Promise<CatalogItem[]> {
  const diffs = await getDiffRows(periodId, warehouseCode, round - 1);
  if (!diffs.length) return [];
  const stock = await buildStockMap(warehouseCode);
  return diffs.map((d) => {
    const st = stock.get(d.itemCode);
    return {
      itemCode: d.itemCode,
      itemName: st?.itemName || d.itemName,
      spec: st?.spec || "",
      unit: "",
      systemQty: st?.systemQty ?? d.systemQty,
      inTarget: true,
    };
  });
}

/** 実施中の棚卸期（無ければ null）。同時に実施中は1件の想定 */
export async function getActivePeriod(): Promise<{ periodId: string; name: string; closingDate: number | null } | null> {
  const P = TANAOROSHI_PERIOD_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_PERIOD"), {
    filter: `CurrentValue.[${P.status}]="${escapeLarkFilterValue("実施中")}"`,
  });
  if (!rows.length) return null;
  const r = rows[0];
  const cd = r[P.closing_date];
  return {
    periodId: norm(r[P.period_id]),
    name: norm(r[P.name]),
    closingDate: typeof cd === "number" ? cd : null,
  };
}

/** 差分理由コードマスタ（有効・表示順） */
export async function getReasons(): Promise<ReasonCode[]> {
  const R = TANAOROSHI_REASON_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_REASON"));
  return rows
    .filter((r) => r[R.is_active] !== false)
    .map((r) => ({ code: norm(r[R.code]), name: norm(r[R.name]), sort: Number(r[R.sort_order] ?? 0) }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ code, name }) => ({ code, name }));
}

/** 倉庫進捗（無ければ既定：未着手・回数1） */
export async function getWhStatus(
  periodId: string,
  warehouseCode: string
): Promise<{ recordId: string | null; round: number; status: string }> {
  const W = TANAOROSHI_WH_STATUS_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_WH_STATUS"), {
    filter: `AND(CurrentValue.[${W.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${W.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}")`,
  });
  if (!rows.length) return { recordId: null, round: 1, status: "未着手" };
  const r = rows[0];
  return { recordId: r.record_id || null, round: Number(r[W.current_round] ?? 1) || 1, status: norm(r[W.status]) || "実施中" };
}

/** 当該 期・倉庫・回数 で報告済みの品目コード（有効レコードのみ） */
export async function getReportedItemCodes(periodId: string, warehouseCode: string, round: number): Promise<string[]> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_ENTRY"), {
    filter: `AND(CurrentValue.[${E.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${E.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}",CurrentValue.[${E.round}]=${round},CurrentValue.[${E.status}]="${escapeLarkFilterValue("有効")}")`,
    fieldNames: [E.item_code],
  });
  return [...new Set(rows.map((r) => norm(r[E.item_code])).filter(Boolean))];
}

/**
 * 実績の冪等バッチ登録。
 * 既存の 実績ID を除外してから batchCreate する（再送・二重タップでも二重計上しない）。
 * @returns accepted=今回登録した実績ID / duplicated=既存だった実績ID
 */
export async function submitEntries(
  entries: import("./types").EntryDraft[]
): Promise<{ accepted: string[]; duplicated: string[] }> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const tableId = requireTanaoroshiTable("TANAOROSHI_ENTRY");
  if (!entries.length) return { accepted: [], duplicated: [] };

  // 既存 実績ID を検索（バッチ内のIDに限定）
  const ids = entries.map((e) => e.entryId);
  const orClauses = ids.map((id) => `CurrentValue.[${E.entry_id}]="${escapeLarkFilterValue(id)}"`);
  const existing = new Set<string>();
  // filter が長くなりすぎないよう50件ずつ
  for (let i = 0; i < orClauses.length; i += 50) {
    const chunk = orClauses.slice(i, i + 50);
    const filter = chunk.length === 1 ? chunk[0] : `OR(${chunk.join(",")})`;
    const rows = await listAll(tableId, { filter, fieldNames: [E.entry_id] });
    for (const r of rows) existing.add(norm(r[E.entry_id]));
  }

  const toCreate = entries.filter((e) => !existing.has(e.entryId));
  const now = Date.now();
  const records = toCreate.map((e) => {
    const rec: Record<string, any> = {
      [E.entry_id]: e.entryId,
      [E.period_id]: e.periodId,
      [E.warehouse_code]: e.warehouseCode,
      [E.warehouse_name]: e.warehouseName,
      [E.item_code]: e.itemCode,
      [E.item_name]: e.itemName,
      [E.qty]: e.qty,
      [E.stock_state]: e.stockState,
      [E.input_method]: e.inputMethod,
      [E.round]: e.round,
      [E.reason_code]: e.reasonCode || "",
      [E.status]: "有効",
      [E.no_system_stock]: e.noSystemStock,
      [E.input_by]: e.inputBy,
      [E.input_by_email]: e.inputByEmail,
      [E.input_at]: e.inputAt,
      [E.sent_at]: now,
      [E.device_id]: e.deviceId,
    };
    // 写真（アップロード済み file_token を添付列へ）
    if (e.photoTokens && e.photoTokens.length) {
      rec[E.photos] = e.photoTokens.map((t) => ({ file_token: t }));
    }
    return rec;
  });
  if (records.length) await batchCreateBaseRecords(tableId, records);

  return {
    accepted: toCreate.map((e) => e.entryId),
    duplicated: entries.filter((e) => existing.has(e.entryId)).map((e) => e.entryId),
  };
}

/** 当該 期・倉庫・回数 の「自分の」有効実績（個別レコード。F-03 一覧・修正用） */
export async function getMyEntries(
  periodId: string,
  warehouseCode: string,
  round: number,
  email: string
): Promise<import("./types").EntryRow[]> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_ENTRY"), {
    filter: `AND(CurrentValue.[${E.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${E.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}",CurrentValue.[${E.round}]=${round},CurrentValue.[${E.status}]="${escapeLarkFilterValue("有効")}",CurrentValue.[${E.input_by_email}]="${escapeLarkFilterValue(email)}")`,
  });
  return rows
    .map((r) => ({
      entryId: norm(r[E.entry_id]),
      itemCode: norm(r[E.item_code]),
      itemName: norm(r[E.item_name]),
      qty: Number(r[E.qty] ?? 0),
      stockState: (norm(r[E.stock_state]) || "良品") as any,
      inputMethod: (norm(r[E.input_method]) || "読取") as any,
      noSystemStock: r[E.no_system_stock] === true,
      inputAt: typeof r[E.input_at] === "number" ? r[E.input_at] : 0,
      sent: true,
    }))
    .sort((a, b) => b.inputAt - a.inputAt);
}

/**
 * 実績を取消（追記専用のため物理削除せず 状態=取消 に更新）。F-03。
 * @returns 取消できた entryId
 */
export async function voidEntries(entryIds: string[], operator: string): Promise<string[]> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const tableId = requireTanaoroshiTable("TANAOROSHI_ENTRY");
  if (!entryIds.length) return [];

  // entryId → record_id（有効なものだけ）
  const targets: { recordId: string; entryId: string }[] = [];
  const clauses = entryIds.map((id) => `CurrentValue.[${E.entry_id}]="${escapeLarkFilterValue(id)}"`);
  for (let i = 0; i < clauses.length; i += 50) {
    const chunk = clauses.slice(i, i + 50);
    const filter = chunk.length === 1 ? chunk[0] : `OR(${chunk.join(",")})`;
    const rows = await listAll(tableId, { filter, fieldNames: [E.entry_id, E.status] });
    for (const r of rows) {
      if (norm(r[E.status]) === "有効" && r.record_id) {
        targets.push({ recordId: r.record_id, entryId: norm(r[E.entry_id]) });
      }
    }
  }
  if (!targets.length) return [];

  const now = Date.now();
  await batchUpdateBaseRecords(
    tableId,
    targets.map((t) => ({ record_id: t.recordId, fields: { [E.status]: "取消" } }))
  );
  // 監査（件数のみサマリで1件）
  await writeAudit({
    action: "取消",
    targetKey: targets.map((t) => t.entryId).join(","),
    after: `${targets.length}件を取消`,
    operator,
    note: String(now),
  }).catch(() => {});
  return targets.map((t) => t.entryId);
}

/** 倉庫進捗を upsert（入力があったら実施中・最終報告日時を更新。件数集計は Phase 3） */
export async function touchWhStatus(
  periodId: string,
  warehouseCode: string,
  warehouseName: string,
  round: number
): Promise<void> {
  const W = TANAOROSHI_WH_STATUS_FIELDS;
  const tableId = requireTanaoroshiTable("TANAOROSHI_WH_STATUS");
  const cur = await getWhStatus(periodId, warehouseCode);
  const now = Date.now();
  if (cur.recordId) {
    await updateBaseRecord(tableId, cur.recordId, {
      [W.status]: cur.status === "未着手" ? "実施中" : cur.status,
      [W.last_reported_at]: now,
      [W.updated_at]: now,
    });
  } else {
    await createBaseRecord(tableId, {
      [W.status_id]: `${periodId}|${warehouseCode}`,
      [W.period_id]: periodId,
      [W.warehouse_code]: warehouseCode,
      [W.warehouse_name]: warehouseName,
      [W.current_round]: round,
      [W.status]: "実施中",
      [W.last_reported_at]: now,
      [W.updated_at]: now,
    });
  }
}

/* ===================== Phase 3: 差分リスト発行・進捗・出力 ===================== */

/** 実績を品目別に集計（期＋倉庫＋回数＋有効） */
async function buildActualAgg(periodId: string, warehouseCode: string, round: number): Promise<Map<string, ActualAgg>> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_ENTRY"), {
    filter: `AND(CurrentValue.[${E.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${E.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}",CurrentValue.[${E.round}]=${round},CurrentValue.[${E.status}]="${escapeLarkFilterValue("有効")}")`,
  });
  const map = new Map<string, ActualAgg>();
  for (const r of rows) {
    const code = norm(r[E.item_code]);
    if (!code) continue;
    const qty = Number(r[E.qty] ?? 0);
    const state = norm(r[E.stock_state]) || "良品";
    const reason = norm(r[E.reason_code]);
    const cur = map.get(code) || { qty: 0, itemName: norm(r[E.item_name]), states: {}, reasonCode: undefined };
    cur.qty += qty;
    cur.states[state] = (cur.states[state] || 0) + qty;
    if (reason) cur.reasonCode = reason; // 最新の理由で上書き
    if (!cur.itemName) cur.itemName = norm(r[E.item_name]);
    map.set(code, cur);
  }
  return map;
}

/** システム在庫を品目別に（指定倉庫） */
async function buildStockMap(warehouseCode: string): Promise<Map<string, StockInfo>> {
  const rows = await fetchStockRows();
  const map = new Map<string, StockInfo>();
  for (const r of rows) {
    if (norm(r[S.warehouse_code]) !== norm(warehouseCode)) continue;
    const code = norm(r[S.item_code]);
    if (!code) continue;
    map.set(code, {
      systemQty: parseStockNumber(r[S.stock_qty]) ?? 0,
      itemName: norm(r[S.item_name]),
      spec: norm(r[S.item_name2]),
    });
  }
  return map;
}

/** 理由コード→名称の対応 */
async function reasonNameMap(): Promise<Map<string, string>> {
  const reasons = await getReasons();
  return new Map(reasons.map((r) => [r.code, r.name]));
}

/** 差分リストを読む（期＋倉庫? ＋回数?） */
export async function getDiffRows(
  periodId: string,
  warehouseCode?: string,
  round?: number
): Promise<(DiffRow & { warehouseCode: string; warehouseName: string; resolved: boolean })[]> {
  const D = TANAOROSHI_DIFF_FIELDS;
  const clauses = [`CurrentValue.[${D.period_id}]="${escapeLarkFilterValue(periodId)}"`];
  if (warehouseCode) clauses.push(`CurrentValue.[${D.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}"`);
  if (round) clauses.push(`CurrentValue.[${D.round}]=${round}`);
  const filter = clauses.length === 1 ? clauses[0] : `AND(${clauses.join(",")})`;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_DIFF"), { filter });
  return rows.map((r) => ({
    itemCode: norm(r[D.item_code]),
    itemName: norm(r[D.item_name]),
    systemQty: Number(r[D.system_qty] ?? 0),
    actualQty: Number(r[D.actual_qty] ?? 0),
    diffQty: Number(r[D.diff_qty] ?? 0),
    stateBreakdown: norm(r[D.state_breakdown]),
    reasonCode: norm(r[D.reason_code]) || undefined,
    round: Number(r[D.round] ?? 1),
    warehouseCode: norm(r[D.warehouse_code]),
    warehouseName: norm(r[D.warehouse_name]),
    resolved: r[D.resolved] === true,
  }));
}

/** 進捗ダッシュボード（倉庫別）。実績1回取得＋在庫＋倉庫進捗から算出 */
export async function getProgress(periodId: string): Promise<ProgressRow[]> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const W = TANAOROSHI_WH_STATUS_FIELDS;

  const [warehouses, stockRows, entries, whRows] = await Promise.all([
    getWarehouses(),
    fetchStockRows(),
    listAll(requireTanaoroshiTable("TANAOROSHI_ENTRY"), {
      filter: `AND(CurrentValue.[${E.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${E.status}]="${escapeLarkFilterValue("有効")}")`,
      fieldNames: [E.warehouse_code, E.item_code, E.round],
    }),
    listAll(requireTanaoroshiTable("TANAOROSHI_WH_STATUS"), {
      filter: `CurrentValue.[${W.period_id}]="${escapeLarkFilterValue(periodId)}"`,
    }),
  ]);

  // 倉庫→対象品目数
  const target = new Map<string, number>();
  for (const r of stockRows) {
    const c = norm(r[S.warehouse_code]);
    if (!c) continue;
    target.set(c, (target.get(c) || 0) + 1);
  }
  // 倉庫進捗
  const whMap = new Map<string, any>();
  for (const r of whRows) whMap.set(norm(r[W.warehouse_code]), r);

  // 倉庫→回数→報告済み品目セット
  const reportedByWh = new Map<string, Map<number, Set<string>>>();
  for (const e of entries) {
    const c = norm(e[E.warehouse_code]);
    const round = Number(e[E.round] ?? 1);
    const code = norm(e[E.item_code]);
    if (!reportedByWh.has(c)) reportedByWh.set(c, new Map());
    const byRound = reportedByWh.get(c)!;
    if (!byRound.has(round)) byRound.set(round, new Set());
    byRound.get(round)!.add(code);
  }

  return warehouses.map((w) => {
    const wh = whMap.get(w.code);
    const round = wh ? Number(wh[W.current_round] ?? 1) || 1 : 1;
    const status = wh ? norm(wh[W.status]) || "未着手" : "未着手";
    const reported = reportedByWh.get(w.code)?.get(round)?.size ?? 0;
    return {
      warehouseCode: w.code,
      warehouseName: w.name,
      round,
      status,
      targetItems: target.get(w.code) ?? 0,
      reportedItems: reported,
      diffCount: wh ? Number(wh[W.diff_count] ?? 0) : 0,
      lastReportedAt: wh && typeof wh[W.last_reported_at] === "number" ? wh[W.last_reported_at] : null,
    };
  });
}

/**
 * 差分リスト発行＝回数確定（F-07）。倉庫ごとに再実行安全に処理する。
 * @returns 倉庫ごとの結果
 */
export async function issueDiff(
  periodId: string,
  warehouseCodes: string[],
  operator: string
): Promise<{ warehouseCode: string; diffCount: number; newRound: number; status: string; skipped?: string }[]> {
  const W = TANAOROSHI_WH_STATUS_FIELDS;
  const D = TANAOROSHI_DIFF_FIELDS;
  const whTableId = requireTanaoroshiTable("TANAOROSHI_WH_STATUS");
  const diffTableId = requireTanaoroshiTable("TANAOROSHI_DIFF");
  const reasonMap = await reasonNameMap();
  const results: { warehouseCode: string; diffCount: number; newRound: number; status: string; skipped?: string }[] = [];

  for (const warehouseCode of warehouseCodes) {
    const cur = await getWhStatus(periodId, warehouseCode);
    if (cur.status === "発行処理中") {
      results.push({ warehouseCode, diffCount: 0, newRound: cur.round, status: cur.status, skipped: "発行処理中" });
      continue;
    }
    const round = cur.round;
    const wh = await getWarehouseName(warehouseCode);

    // ロック
    await upsertWhStatus(whTableId, periodId, warehouseCode, wh, { [W.status]: "発行処理中", [W.updated_at]: Date.now() });

    try {
      const [actual, stock] = await Promise.all([buildActualAgg(periodId, warehouseCode, round), buildStockMap(warehouseCode)]);
      const rows = computeDiffs(actual, stock, round);

      // 既存の同一(期,倉庫,回数)差分を削除 → 再作成（再実行の冪等性）
      const existing = await getDiffRecordIds(periodId, warehouseCode, round);
      if (existing.length) await batchDeleteBaseRecords(diffTableId, existing);

      if (rows.length) {
        await batchCreateBaseRecords(
          diffTableId,
          rows.map((r) => ({
            [D.diff_id]: `${periodId}|${warehouseCode}|${r.itemCode}|${round}`,
            [D.period_id]: periodId,
            [D.warehouse_code]: warehouseCode,
            [D.warehouse_name]: wh,
            [D.item_code]: r.itemCode,
            [D.item_name]: r.itemName,
            [D.system_qty]: r.systemQty,
            [D.actual_qty]: r.actualQty,
            [D.diff_qty]: r.diffQty,
            [D.state_breakdown]: r.stateBreakdown,
            [D.round]: round,
            [D.reason_code]: r.reasonCode || "",
            [D.reason_name]: r.reasonCode ? reasonMap.get(r.reasonCode) || "" : "",
            [D.resolved]: false,
            [D.issued_by]: operator,
            [D.issued_at]: Date.now(),
          }))
        );
      }

      // ステータス・回数の更新
      const isClose = rows.length === 0 || round >= 3;
      const newRound = isClose ? round : round + 1;
      const status = isClose ? "締め" : `${round}回目確定`;
      await upsertWhStatus(whTableId, periodId, warehouseCode, wh, {
        [W.status]: status,
        [W.current_round]: newRound,
        [W.diff_count]: rows.length,
        [W.updated_at]: Date.now(),
      });

      await writeAudit({
        periodId,
        action: "差分リスト発行",
        targetKey: warehouseCode,
        after: `${round}回目 差分${rows.length}件 → ${status}`,
        operator,
      }).catch(() => {});

      // Lark通知（F-10）。失敗しても発行処理は止めない
      if (isClose) {
        await notifyClosed({ periodId, warehouseName: wh, operator }).catch((e) => console.error("[issueDiff] notifyClosed", e));
      } else if (rows.length > 0) {
        // ①差分リスト発行時 → その倉庫の管理者へ「N回目を実施してください」
        await notifyDiffIssued({
          periodId,
          warehouseCode,
          warehouseName: wh,
          round: newRound,
          diffCount: rows.length,
          operator,
        }).catch((e) => console.error("[issueDiff] notifyDiffIssued", e));
      }

      results.push({ warehouseCode, diffCount: rows.length, newRound, status });
    } catch (e) {
      // ロック解除（実施中へ戻す）
      await upsertWhStatus(whTableId, periodId, warehouseCode, wh, { [W.status]: "実施中", [W.updated_at]: Date.now() }).catch(() => {});
      throw e;
    }
  }

  // ②全倉庫の当該回報告が揃ったら共通通知先へ（発行後に判定）
  try {
    const progress = await getProgress(periodId);
    const allReported = progress.length > 0 && progress.every((p) => p.status === "締め" || p.reportedItems >= p.targetItems);
    if (allReported) await notifyAllReported({ periodId, operator });
  } catch (e) {
    console.error("[issueDiff] notifyAllReported", e);
  }

  return results;
}

/** 倉庫名（システム在庫から） */
async function getWarehouseName(code: string): Promise<string> {
  const ws = await getWarehouses();
  return ws.find((w) => w.code === code)?.name || "";
}

/** 倉庫進捗レコードを upsert（record_id 検索 → 更新 or 作成） */
async function upsertWhStatus(
  tableId: string,
  periodId: string,
  warehouseCode: string,
  warehouseName: string,
  fields: Record<string, any>
): Promise<void> {
  const W = TANAOROSHI_WH_STATUS_FIELDS;
  const cur = await getWhStatus(periodId, warehouseCode);
  if (cur.recordId) {
    await updateBaseRecord(tableId, cur.recordId, fields);
  } else {
    await createBaseRecord(tableId, {
      [W.status_id]: `${periodId}|${warehouseCode}`,
      [W.period_id]: periodId,
      [W.warehouse_code]: warehouseCode,
      [W.warehouse_name]: warehouseName,
      [W.current_round]: 1,
      ...fields,
    });
  }
}

/**
 * 確定値の算出（F-11）。倉庫＋品目ごとに、最も回数の大きい実棚を採用。
 * 対象は「システム在庫にある品目 ∪ 実棚報告のあった品目」。
 */
export async function computeConfirmed(periodId: string, warehouseCodes?: string[]): Promise<ConfirmedRow[]> {
  const E = TANAOROSHI_ENTRY_FIELDS;
  const warehouses = await getWarehouses();
  const whFilter = warehouseCodes && warehouseCodes.length ? new Set(warehouseCodes) : null;
  const targetWh = warehouses.filter((w) => !whFilter || whFilter.has(w.code));

  // 全実績（期＋有効）を1回取得し倉庫＋品目＋回数で集計
  const entries = await listAll(requireTanaoroshiTable("TANAOROSHI_ENTRY"), {
    filter: `AND(CurrentValue.[${E.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${E.status}]="${escapeLarkFilterValue("有効")}")`,
    fieldNames: [E.warehouse_code, E.item_code, E.qty, E.round, E.reason_code, E.input_by],
  });
  // 倉庫|品目 → 回数 → {qty,reason,staff}
  const byKey = new Map<string, Map<number, RoundValue>>();
  for (const e of entries) {
    const wc = norm(e[E.warehouse_code]);
    if (whFilter && !whFilter.has(wc)) continue;
    const code = norm(e[E.item_code]);
    const round = Number(e[E.round] ?? 1);
    const key = `${wc}|${code}`;
    if (!byKey.has(key)) byKey.set(key, new Map());
    const byRound = byKey.get(key)!;
    const cur = byRound.get(round) || { round, qty: 0, reasonCode: undefined, staff: norm(e[E.input_by]) };
    cur.qty += Number(e[E.qty] ?? 0);
    const reason = norm(e[E.reason_code]);
    if (reason) cur.reasonCode = reason;
    byRound.set(round, cur);
  }

  const stockRows = await fetchStockRows();
  const out: ConfirmedRow[] = [];
  for (const w of targetWh) {
    const stock = new Map<string, StockInfo>();
    for (const r of stockRows) {
      if (norm(r[S.warehouse_code]) !== w.code) continue;
      const code = norm(r[S.item_code]);
      if (code)
        stock.set(code, {
          systemQty: parseStockNumber(r[S.stock_qty]) ?? 0,
          itemName: norm(r[S.item_name]),
          spec: norm(r[S.item_name2]),
        });
    }
    // 対象品目 = 在庫品目 ∪ 報告品目
    const reportedCodes = new Set<string>();
    for (const key of byKey.keys()) {
      const [wc, code] = key.split("|");
      if (wc === w.code) reportedCodes.add(code);
    }
    const allCodes = new Set<string>([...stock.keys(), ...reportedCodes]);

    for (const code of allCodes) {
      const roundMap = byKey.get(`${w.code}|${code}`);
      const picked = roundMap ? pickConfirmedQty([...roundMap.values()]) : null;
      const qty = picked?.qty ?? 0; // 報告なしは0
      const st = stock.get(code);
      const systemQty = st?.systemQty ?? 0;
      out.push({
        warehouseCode: w.code,
        warehouseName: w.name,
        itemCode: code,
        itemName: st?.itemName || "",
        spec: st?.spec || "",
        qty,
        systemQty,
        diffQty: qty - systemQty,
        round: picked?.round ?? 0,
        reasonCode: picked?.reasonCode,
        staff: picked?.staff || "",
      });
    }
  }
  return out.sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode) || a.itemCode.localeCompare(b.itemCode));
}

/**
 * 基幹連携: 確定値を「棚卸在庫情報」テーブルへ書き戻す（F-11）。
 * 対象期・倉庫の既存行を削除してから batchCreate（再実行安全）。
 */
export async function writeBackToKikan(periodId: string, warehouseCodes: string[], operator: string): Promise<number> {
  const R = TANAOROSHI_RESULT_FIELDS;
  const tableId = RESULT_TABLE_ID();
  const confirmed = await computeConfirmed(periodId, warehouseCodes);

  // 既存の対象倉庫行を削除
  const RC = TANAOROSHI_RESULT_FIELDS;
  const existing = await listAll(tableId, { fieldNames: [RC.warehouse_code] });
  const whSet = new Set(warehouseCodes);
  const toDelete = existing.filter((r) => whSet.has(norm(r[RC.warehouse_code]))).map((r) => r.record_id).filter(Boolean);
  if (toDelete.length) await batchDeleteBaseRecords(tableId, toDelete);

  const records = confirmed.map((c) => ({
    [R.warehouse_code]: Number(c.warehouseCode) || c.warehouseCode,
    [R.warehouse_name]: c.warehouseName,
    [R.item_code]: c.itemCode,
    [R.item_name]: c.itemName,
    [R.item_name2]: c.spec,
    [R.qty]: c.qty,
    [R.theoretical_qty]: c.systemQty,
    [R.diff_qty]: c.diffQty,
    [R.staff_name]: c.staff,
    [R.note]: [c.reasonCode ? `理由:${c.reasonCode}` : "", c.systemQty === 0 && c.qty > 0 ? "システム在庫なし" : ""].filter(Boolean).join(" "),
  }));
  if (records.length) await batchCreateBaseRecords(tableId, records);

  await writeAudit({ periodId, action: "基幹出力", targetKey: warehouseCodes.join(","), after: `${records.length}件を書き戻し`, operator }).catch(() => {});
  return records.length;
}

/** 差分レコードの record_id（期＋倉庫＋回数） */
async function getDiffRecordIds(periodId: string, warehouseCode: string, round: number): Promise<string[]> {
  const D = TANAOROSHI_DIFF_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_DIFF"), {
    filter: `AND(CurrentValue.[${D.period_id}]="${escapeLarkFilterValue(periodId)}",CurrentValue.[${D.warehouse_code}]="${escapeLarkFilterValue(warehouseCode)}",CurrentValue.[${D.round}]=${round})`,
    fieldNames: [D.diff_id],
  });
  return rows.map((r) => r.record_id).filter(Boolean);
}

/* ---------- 棚卸期の管理（S-08） ---------- */

export interface PeriodRow {
  recordId: string;
  periodId: string;
  name: string;
  closingDate: number | null;
  status: string;
  createdBy: string;
  createdAt: number | null;
}

/** 棚卸期の一覧（作成日時の新しい順） */
export async function listPeriods(): Promise<PeriodRow[]> {
  const P = TANAOROSHI_PERIOD_FIELDS;
  const rows = await listAll(requireTanaoroshiTable("TANAOROSHI_PERIOD"));
  return rows
    .map((r) => ({
      recordId: r.record_id,
      periodId: norm(r[P.period_id]),
      name: norm(r[P.name]),
      closingDate: typeof r[P.closing_date] === "number" ? r[P.closing_date] : null,
      status: norm(r[P.status]) || "準備中",
      createdBy: norm(r[P.created_by]),
      createdAt: typeof r[P.created_at] === "number" ? r[P.created_at] : null,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * 棚卸期を作成し、実施中にする。
 * 同時に実施中は1件のみ → 既存の実施中があれば拒否（作業の取り違え防止）。
 */
export async function createAndActivatePeriod(params: {
  name: string;
  closingDate: number | null;
  operator: string;
}): Promise<{ periodId: string }> {
  const active = await getActivePeriod();
  if (active) throw new Error(`実施中の棚卸期「${active.name}」があります。先に締めてください`);

  const P = TANAOROSHI_PERIOD_FIELDS;
  const now = Date.now();
  const jst = new Date(now + 9 * 3600 * 1000);
  const periodId = `TN-${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(
    jst.getUTCDate()
  ).padStart(2, "0")}${String(jst.getUTCHours()).padStart(2, "0")}${String(jst.getUTCMinutes()).padStart(2, "0")}`;
  await createBaseRecord(requireTanaoroshiTable("TANAOROSHI_PERIOD"), {
    [P.period_id]: periodId,
    [P.name]: params.name,
    [P.closing_date]: params.closingDate ?? undefined,
    [P.status]: "実施中",
    [P.created_by]: params.operator,
    [P.created_at]: now,
    [P.updated_at]: now,
  });
  return { periodId };
}

/** 棚卸期のステータスを変更（締め等） */
export async function setPeriodStatus(recordId: string, status: string): Promise<void> {
  const P = TANAOROSHI_PERIOD_FIELDS;
  await updateBaseRecord(requireTanaoroshiTable("TANAOROSHI_PERIOD"), recordId, {
    [P.status]: status,
    [P.updated_at]: Date.now(),
  });
}

/* ===================== Lark通知 F-10: 通知先マスタ・倉庫通知先・通知ログ ===================== */

export interface NotifyTargetRow {
  recordId: string;
  trigger: string;
  kind: string;
  value: string;
  isActive: boolean;
  note: string;
}

/** 共通通知先マスタの一覧 */
export async function listNotifyTargets(): Promise<NotifyTargetRow[]> {
  const T = TANAOROSHI_NOTIFY_TARGET_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_NOTIFY_TARGET;
  if (!tableId) return [];
  const rows = await listAll(tableId);
  return rows.map((r) => ({
    recordId: r.record_id,
    trigger: norm(r[T.trigger]) || "共通",
    kind: norm(r[T.kind]) || "メール",
    value: norm(r[T.value]),
    isActive: r[T.is_active] !== false,
    note: norm(r[T.note]),
  }));
}

/** 共通通知先の作成/更新 */
export async function upsertNotifyTarget(p: {
  recordId?: string;
  trigger: string;
  kind: string;
  value: string;
  isActive: boolean;
  note?: string;
}): Promise<void> {
  const T = TANAOROSHI_NOTIFY_TARGET_FIELDS;
  const tableId = requireTanaoroshiTable("TANAOROSHI_NOTIFY_TARGET");
  const fields: Record<string, any> = {
    [T.trigger]: p.trigger,
    [T.kind]: p.kind,
    [T.value]: p.value,
    [T.is_active]: p.isActive,
    [T.note]: p.note || "",
  };
  if (p.recordId) {
    await updateBaseRecord(tableId, p.recordId, fields);
  } else {
    await createBaseRecord(tableId, { [T.target_id]: `NT-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, ...fields });
  }
}

export async function deleteNotifyTarget(recordId: string): Promise<void> {
  await deleteBaseRecord(requireTanaoroshiTable("TANAOROSHI_NOTIFY_TARGET"), recordId);
}

export interface WarehouseNotifyRow {
  recordId: string;
  warehouseCode: string;
  warehouseName: string;
  notify: string;
}

/** 倉庫マスタの一覧（倉庫別通知先の編集用） */
export async function listWarehouseNotify(): Promise<WarehouseNotifyRow[]> {
  const W = TANAOROSHI_WAREHOUSE_MASTER_FIELDS;
  const rows = await listAll(getLarkTables().TANAOROSHI_WAREHOUSE_MASTER);
  return rows
    .map((r) => ({
      recordId: r.record_id,
      warehouseCode: norm(r[W.code]),
      warehouseName: norm(r[W.name]),
      notify: norm(r[W.notify]),
    }))
    .sort((a, b) => Number(a.warehouseCode) - Number(b.warehouseCode) || a.warehouseCode.localeCompare(b.warehouseCode));
}

/** 倉庫マスタの通知先列を更新（倉庫コードでレコード解決） */
export async function setWarehouseNotify(warehouseCode: string, notify: string): Promise<void> {
  const W = TANAOROSHI_WAREHOUSE_MASTER_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_WAREHOUSE_MASTER;
  const rows = await listAll(tableId, {
    filter: `CurrentValue.[${W.code}]="${escapeLarkFilterValue(warehouseCode)}"`,
    fieldNames: [W.code],
  });
  const recordId = rows[0]?.record_id;
  if (!recordId) throw new Error(`倉庫マスタに倉庫コード「${warehouseCode}」がありません`);
  await updateBaseRecord(tableId, recordId, { [W.notify]: notify });
}

export interface NotifyLogRow {
  sentAt: number | null;
  trigger: string;
  periodId: string;
  warehouseCode: string;
  kind: string;
  value: string;
  body: string;
  result: string;
  error: string;
  operator: string;
}

/** 通知ログの一覧（新しい順） */
export async function listNotifyLog(limit = 300): Promise<NotifyLogRow[]> {
  const L = TANAOROSHI_NOTIFY_LOG_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_NOTIFY_LOG;
  if (!tableId) return [];
  const rows = await listAll(tableId);
  return rows
    .map((r) => ({
      sentAt: typeof r[L.sent_at] === "number" ? r[L.sent_at] : null,
      trigger: norm(r[L.trigger]),
      periodId: norm(r[L.period_id]),
      warehouseCode: norm(r[L.warehouse_code]),
      kind: norm(r[L.kind]),
      value: norm(r[L.value]),
      body: norm(r[L.body]),
      result: norm(r[L.result]),
      error: norm(r[L.error]),
      operator: norm(r[L.operator]),
    }))
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
    .slice(0, limit);
}

/** 操作履歴の記録（取消・修正・管理操作用） */
export async function writeAudit(params: {
  periodId?: string;
  targetKey?: string;
  action: string; // 単一選択の選択肢に一致させること
  before?: string;
  after?: string;
  note?: string;
  operator: string;
}): Promise<void> {
  const F = TANAOROSHI_AUDIT_FIELDS;
  await createBaseRecord(requireTanaoroshiTable("TANAOROSHI_AUDIT"), {
    [F.audit_id]: `AUD-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    [F.period_id]: params.periodId || "",
    [F.target_key]: params.targetKey || "",
    [F.action]: params.action,
    [F.before]: params.before || "",
    [F.after]: params.after || "",
    [F.note]: params.note || "",
    [F.operator]: params.operator,
    [F.operated_at]: Date.now(),
  });
}
