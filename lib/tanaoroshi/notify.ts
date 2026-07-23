/**
 * 棚卸: Lark通知（F-10）
 *
 * 通知先は3層:
 *   ① 倉庫マスタの「通知先」列 = その倉庫の管理者（差分発行時の宛先）
 *   ② 棚卸_通知先マスタ = 管理者が登録する共通通知先（完了/締めの宛先）
 * 送信結果は 棚卸_通知ログ へ記録する（管理者が送信状況を確認できる）。
 *
 * 送信は Lark IM（im.v1.message.create）。メール宛は receive_id_type=email で個人チャット、
 * グループ宛は chat_id。送信失敗は棚卸処理を止めない（握りつぶしてログのみ）。
 */
import { getLarkClient } from "@/lib/lark-client";
import {
  getLarkTables,
  requireTanaoroshiTable,
  TANAOROSHI_WAREHOUSE_MASTER_FIELDS,
  TANAOROSHI_NOTIFY_TARGET_FIELDS,
  TANAOROSHI_NOTIFY_LOG_FIELDS,
} from "@/lib/lark-tables";
import { getBaseRecords, createBaseRecord } from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";

export type NotifyTrigger = "発行" | "完了" | "締め";
export type TargetKind = "メール" | "グループ";

export interface NotifyTarget {
  kind: TargetKind;
  value: string;
}

const norm = (v: any) => String(v ?? "").replace(/　/g, " ").trim();

/** アプリのベースURL（通知本文のリンク基点） */
export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/** 倉庫マスタの「通知先」列から、その倉庫の宛先（メール）を解決 */
export async function resolveWarehouseTargets(warehouseCode: string): Promise<NotifyTarget[]> {
  const W = TANAOROSHI_WAREHOUSE_MASTER_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_WAREHOUSE_MASTER;
  try {
    const res = await getBaseRecords(tableId, {
      filter: `CurrentValue.[${W.code}]="${escapeLarkFilterValue(warehouseCode)}"`,
    });
    const rec = res.data?.items?.[0];
    const raw = norm(rec?.fields?.[W.notify]);
    if (!raw) return [];
    return raw
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((value) => ({ kind: "メール" as TargetKind, value }));
  } catch (e) {
    console.error("[tanaoroshi/notify] resolveWarehouseTargets", e);
    return [];
  }
}

/** 通知先マスタから、契機（＋共通）の有効な宛先を解決 */
export async function resolveCommonTargets(trigger: NotifyTrigger): Promise<NotifyTarget[]> {
  const T = TANAOROSHI_NOTIFY_TARGET_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_NOTIFY_TARGET;
  if (!tableId) return [];
  try {
    const res = await getBaseRecords(tableId, { pageSize: 500 });
    const items = res.data?.items || [];
    return items
      .filter((r: any) => r.fields?.[T.is_active] !== false)
      .filter((r: any) => {
        const trg = norm(r.fields?.[T.trigger]);
        return trg === trigger || trg === "共通";
      })
      .map((r: any) => ({ kind: (norm(r.fields?.[T.kind]) || "メール") as TargetKind, value: norm(r.fields?.[T.value]) }))
      .filter((t) => t.value);
  } catch (e) {
    console.error("[tanaoroshi/notify] resolveCommonTargets", e);
    return [];
  }
}

/** 1件を Lark IM で送信 */
async function sendOne(target: NotifyTarget, text: string): Promise<{ ok: boolean; error?: string }> {
  const client = getLarkClient();
  if (!client) return { ok: false, error: "Lark client not initialized" };
  try {
    const res: any = await client.im.message.create({
      params: { receive_id_type: target.kind === "メール" ? "email" : "chat_id" },
      data: {
        receive_id: target.value,
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    });
    if (res.code && res.code !== 0) return { ok: false, error: `code=${res.code} msg=${res.msg}` };
    return { ok: true };
  } catch (e: any) {
    const detail = e?.response?.data;
    return { ok: false, error: detail ? `code=${detail.code} msg=${detail.msg}` : e?.message || "送信失敗" };
  }
}

/** 通知ログへ1件記録 */
async function writeLog(params: {
  trigger: NotifyTrigger;
  periodId: string;
  warehouseCode?: string;
  target: NotifyTarget;
  body: string;
  ok: boolean;
  error?: string;
  operator: string;
}): Promise<void> {
  const L = TANAOROSHI_NOTIFY_LOG_FIELDS;
  const tableId = getLarkTables().TANAOROSHI_NOTIFY_LOG;
  if (!tableId) return; // ログテーブル未作成時は記録スキップ
  try {
    await createBaseRecord(tableId, {
      [L.log_id]: `NLOG-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      [L.sent_at]: Date.now(),
      [L.trigger]: params.trigger,
      [L.period_id]: params.periodId,
      [L.warehouse_code]: params.warehouseCode || "",
      [L.kind]: params.target.kind,
      [L.value]: params.target.value,
      [L.body]: params.body,
      [L.result]: params.ok ? "成功" : "失敗",
      [L.error]: params.error || "",
      [L.operator]: params.operator,
    });
  } catch (e) {
    console.error("[tanaoroshi/notify] writeLog", e);
  }
}

/**
 * 宛先群へ送信し、それぞれログ記録する。失敗しても例外を投げない（棚卸処理を止めない）。
 */
export async function notify(params: {
  trigger: NotifyTrigger;
  targets: NotifyTarget[];
  text: string;
  periodId: string;
  warehouseCode?: string;
  operator: string;
}): Promise<{ sent: number; failed: number }> {
  // 同一宛先の重複を除去
  const seen = new Set<string>();
  const uniq = params.targets.filter((t) => {
    const k = `${t.kind}:${t.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let sent = 0;
  let failed = 0;
  for (const target of uniq) {
    const r = await sendOne(target, params.text);
    if (r.ok) sent++;
    else failed++;
    await writeLog({
      trigger: params.trigger,
      periodId: params.periodId,
      warehouseCode: params.warehouseCode,
      target,
      body: params.text,
      ok: r.ok,
      error: r.error,
      operator: params.operator,
    });
  }
  return { sent, failed };
}

/** 差分リスト発行時（①）: その倉庫の管理者へ「N回目を実施してください」 */
export async function notifyDiffIssued(params: {
  periodId: string;
  warehouseCode: string;
  warehouseName: string;
  round: number;
  diffCount: number;
  operator: string;
}): Promise<void> {
  const targets = await resolveWarehouseTargets(params.warehouseCode);
  if (!targets.length) return;
  const url = `${appBaseUrl()}/seizou/tanaoroshi/diff?period=${encodeURIComponent(params.periodId)}&warehouse=${encodeURIComponent(params.warehouseCode)}`;
  const text =
    `【棚卸】${params.warehouseName}（${params.warehouseCode}）\n` +
    `${params.round}回目の棚卸を実施してください。差分 ${params.diffCount} 件。\n${url}`;
  await notify({ trigger: "発行", targets, text, periodId: params.periodId, warehouseCode: params.warehouseCode, operator: params.operator });
}

/** 締め（③）: 共通通知先へ完了通知 */
export async function notifyClosed(params: {
  periodId: string;
  warehouseName: string;
  operator: string;
}): Promise<void> {
  const targets = await resolveCommonTargets("締め");
  if (!targets.length) return;
  const url = `${appBaseUrl()}/seizou/tanaoroshi/export?period=${encodeURIComponent(params.periodId)}`;
  const text = `【棚卸】${params.warehouseName} が締め（確定）になりました。\n基幹連携出力: ${url}`;
  await notify({ trigger: "締め", targets, text, periodId: params.periodId, operator: params.operator });
}

/** 全倉庫報告完了時（②）: 共通通知先へ */
export async function notifyAllReported(params: { periodId: string; operator: string }): Promise<void> {
  const targets = await resolveCommonTargets("完了");
  if (!targets.length) return;
  const url = `${appBaseUrl()}/seizou/tanaoroshi`;
  const text = `【棚卸】全倉庫の報告が揃いました。差分リストを発行できます。\n進捗ダッシュボード: ${url}`;
  await notify({ trigger: "完了", targets, text, periodId: params.periodId, operator: params.operator });
}
