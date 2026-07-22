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
} from "@/lib/lark-tables";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { parseStockNumber } from "./stock-import";
import type { Warehouse, CatalogItem, ReasonCode } from "./types";

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
