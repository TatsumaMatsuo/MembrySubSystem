import { createBaseRecord, getLarkBaseToken } from "@/lib/lark-client";
import { getLarkTables, SEISAN_KPI_AUDIT_FIELDS as UF } from "@/lib/lark-tables";

/**
 * KPIシステム共通 AUDIT(操作履歴)記録(#59 §3.2)。
 *
 * 生産本部KPI / 経営 の全更新系(作成/更新/削除)で「誰がいつ何を」を
 * SEISAN_KPI_AUDIT(生産KPI_変更履歴)へ記録する単一ヘルパ。
 * 監査記録の失敗は本処理を止めない(ログのみ)。
 */
export async function writeKpiAudit(input: {
  /** 対象テーブルの論理名(例: SEISAN_KPI_MEASURE / KAIKEI_ACTUAL) */
  table: string;
  /** 対象レコードの業務キー(例: 施策コード / 会計コード) */
  recordId: string;
  operation: "作成" | "更新" | "削除";
  before?: unknown;
  after?: unknown;
  operator: string;
}): Promise<void> {
  try {
    const t = getLarkTables();
    await createBaseRecord(
      t.SEISAN_KPI_AUDIT,
      {
        [UF.history_id]: `${input.table}-${input.recordId}-${Date.now()}`,
        [UF.target_table]: input.table,
        [UF.target_record_id]: input.recordId,
        [UF.operation]: input.operation,
        [UF.before]: input.before == null ? "" : JSON.stringify(input.before),
        [UF.after]: input.after == null ? "" : JSON.stringify(input.after),
        [UF.operator]: input.operator,
        [UF.operated_at]: Date.now(),
      },
      { baseToken: getLarkBaseToken() }
    );
  } catch (e) {
    console.error("[kpi-audit] writeKpiAudit failed:", e);
  }
}
