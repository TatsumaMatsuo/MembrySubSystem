/**
 * 棚卸: 送信ワーカー（F-12 再送信）
 *
 * 端末の queue（未送信）を batchで /api/tanaoroshi/entries へ送る。
 * サーバは冪等（accepted/duplicated を返す）ため、accepted∪duplicated を queue から削除する。
 * → 通信断・二重タップ・再起動のいずれでも二重計上しない。
 */
import { loadQueue, dequeue, markSent, enqueue } from "./local-store";
import type { EntryDraft } from "./types";

const BATCH = 50;

/** 1枚の写真をアップロードして file_token を得る */
async function uploadPhoto(blob: Blob): Promise<string> {
  const res = await fetch(`/api/tanaoroshi/photo?name=photo_${Date.now()}.jpg`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.success === false || !j?.fileToken) throw new Error(j?.error || "写真アップロード失敗");
  return j.fileToken;
}

/**
 * 送信前に写真をアップロードして photoTokens 化し、Blob を落とした送信用エントリを返す。
 * 一度アップロードした分は queue を更新（tokens 保持・Blob 破棄）して再アップロードを防ぐ。
 */
async function preparePhotos(entry: EntryDraft): Promise<EntryDraft> {
  if (!entry.photos || entry.photos.length === 0) {
    const { photos, ...rest } = entry;
    void photos;
    return rest;
  }
  const tokens = [...(entry.photoTokens || [])];
  for (const blob of entry.photos) tokens.push(await uploadPhoto(blob));
  const updated: EntryDraft = { ...entry, photoTokens: tokens, photos: [] };
  await enqueue(updated); // アップロード済みを永続化（送信失敗時の再アップロード防止）
  const { photos, ...rest } = updated;
  void photos;
  return rest;
}

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
      const slice = queue.slice(i, i + BATCH);
      // 写真を先にアップロードし、Blob を落とした送信用エントリにする
      const batch = [];
      for (const e of slice) batch.push(await preparePhotos(e));
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
