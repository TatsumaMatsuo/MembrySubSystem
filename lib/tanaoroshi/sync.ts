/**
 * 棚卸: 送信ワーカー（F-12 再送信）
 *
 * 端末の queue（未送信）を batchで /api/tanaoroshi/entries へ送る。
 * サーバは冪等（accepted/duplicated を返す）ため、accepted∪duplicated を queue から削除する。
 * → 通信断・二重タップ・再起動のいずれでも二重計上しない。
 */
import { loadQueue, dequeue, markSent } from "./local-store";
import type { EntryDraft } from "./types";

const BATCH = 50;

export interface FlushResult {
  sent: number;
  remaining: number;
  error?: string;
}

let _flushing = false;

/** キューを送信する。多重起動は抑止（前回完了まで待つ） */
export async function flushQueue(): Promise<FlushResult> {
  if (_flushing) return { sent: 0, remaining: await pendingCount() };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, remaining: await pendingCount(), error: "オフライン" };
  }
  _flushing = true;
  let sent = 0;
  try {
    const queue = await loadQueue();
    for (let i = 0; i < queue.length; i += BATCH) {
      const batch = queue.slice(i, i + BATCH);
      const res = await fetch("/api/tanaoroshi/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: batch }),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        return { sent, remaining: await pendingCount(), error: "サーバ応答を解釈できません" };
      }
      if (!res.ok || json?.success === false) {
        return { sent, remaining: await pendingCount(), error: json?.error || `送信エラー (${res.status})` };
      }
      // accepted∪duplicated を queue から除去（冪等の要）
      const done: string[] = [...(json.accepted || []), ...(json.duplicated || [])];
      await markSent(done);
      for (const id of done) await dequeue(id);
      sent += (json.accepted || []).length;
    }
    return { sent, remaining: await pendingCount() };
  } catch (e: any) {
    return { sent, remaining: await pendingCount(), error: e?.message || "送信に失敗しました" };
  } finally {
    _flushing = false;
  }
}

export async function pendingCount(): Promise<number> {
  return (await loadQueue()).length;
}

/** 未送信の合計数量など、UI表示用のサマリ */
export async function queueSummary(): Promise<{ count: number; items: number }> {
  const q: EntryDraft[] = await loadQueue();
  return { count: q.length, items: new Set(q.map((e) => e.itemCode)).size };
}
