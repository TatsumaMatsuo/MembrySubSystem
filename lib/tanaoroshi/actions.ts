/**
 * 棚卸: 取消・修正のクライアント操作（F-03）
 *
 * 未送信データは端末（queue）から削除、送信済みデータはサーバで「取消」レコードに更新する
 * （追記専用＝物理削除しない・監査が残る）。
 */
import { getQueued, dequeue, enqueue } from "./local-store";
import type { EntryDraft } from "./types";

/** 送信済み実績をサーバで取消（状態=取消） */
export async function voidSent(entryIds: string[]): Promise<string[]> {
  const res = await fetch("/api/tanaoroshi/entries/void", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryIds }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.success === false) throw new Error(j?.error || `取消エラー (${res.status})`);
  return j.voided || [];
}

/** 1件を取消（未送信→queue削除 / 送信済み→サーバ取消） */
export async function cancelEntry(entryId: string): Promise<void> {
  const q = await getQueued(entryId);
  if (q) {
    await dequeue(entryId);
    return;
  }
  await voidSent([entryId]);
}

/**
 * 数量修正。
 * - 未送信: queue のレコードを書き換え（entryId 据え置き）
 * - 送信済み: 旧を取消 ＋ 新しい entryId で登録し直す（追記専用の修正 = 取消＋新規）
 */
export async function editEntryQty(
  entryId: string,
  newQty: number,
  rebuild: () => EntryDraft // 送信済みのときに使う新ドラフト生成（新 entryId）
): Promise<void> {
  const q = await getQueued(entryId);
  if (q) {
    await enqueue({ ...q, qty: newQty });
    return;
  }
  await voidSent([entryId]);
  await enqueue(rebuild());
}
