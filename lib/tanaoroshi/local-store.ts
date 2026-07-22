/**
 * 棚卸: 端末側ストレージ（IndexedDB ラッパ）
 *
 * F-12（一時保存・再送信）の中核。localStorage は容量が小さく写真Blobを持てないため IndexedDB を使う。
 * 依存を増やさないため素の IndexedDB を薄くラップする（"use client" 側からのみ利用）。
 *
 * ストア:
 *   session : current 1件のみ（期・倉庫・回数・端末ID）
 *   catalog : 品目コードをキーに対象品目
 *   queue   : 未送信の入力（entryId キー）
 *   sent    : 送信確定済み entryId（再送時の除外に使う）
 */
import type { CatalogItem, EntryDraft, TanaoroshiSession } from "./types";

const DB_NAME = "tanaoroshi";
const DB_VERSION = 1;
const STORES = ["session", "catalog", "queue", "sent"] as const;
type StoreName = (typeof STORES)[number];

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("この端末では IndexedDB が使えません"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("session")) db.createObjectStore("session");
      if (!db.objectStoreNames.contains("catalog")) db.createObjectStore("catalog", { keyPath: "itemCode" });
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "entryId" });
      if (!db.objectStoreNames.contains("sent")) db.createObjectStore("sent");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function getAll<T>(store: StoreName): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const t = db.transaction(store, "readonly");
        const req = t.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

/* ---------- session ---------- */
export async function saveSession(s: TanaoroshiSession): Promise<void> {
  await tx("session", "readwrite", (st) => st.put(s, "current"));
}
export function loadSession(): Promise<TanaoroshiSession | undefined> {
  return tx("session", "readonly", (st) => st.get("current"));
}
export async function clearSession(): Promise<void> {
  await tx("session", "readwrite", (st) => st.delete("current"));
}

/* ---------- catalog ---------- */
export async function saveCatalog(items: CatalogItem[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("catalog", "readwrite");
    const store = t.objectStore("catalog");
    store.clear();
    for (const it of items) store.put(it);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export function loadCatalog(): Promise<CatalogItem[]> {
  return getAll<CatalogItem>("catalog");
}
export function getCatalogItem(itemCode: string): Promise<CatalogItem | undefined> {
  return tx("catalog", "readonly", (st) => st.get(itemCode));
}

/* ---------- queue（未送信） ---------- */
export async function enqueue(entry: EntryDraft): Promise<void> {
  await tx("queue", "readwrite", (st) => st.put(entry));
}
export function loadQueue(): Promise<EntryDraft[]> {
  return getAll<EntryDraft>("queue");
}
export async function dequeue(entryId: string): Promise<void> {
  await tx("queue", "readwrite", (st) => st.delete(entryId));
}
export function getQueued(entryId: string): Promise<EntryDraft | undefined> {
  return tx("queue", "readonly", (st) => st.get(entryId));
}
export async function queueCount(): Promise<number> {
  return tx("queue", "readonly", (st) => st.count());
}

/* ---------- sent（送信済み entryId。再送時の重複判定） ---------- */
export async function markSent(entryIds: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("sent", "readwrite");
    const store = t.objectStore("sent");
    const now = Date.now();
    for (const id of entryIds) store.put(now, id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export function isSent(entryId: string): Promise<number | undefined> {
  return tx("sent", "readonly", (st) => st.get(entryId));
}

/** 端末ID（初回生成して永続化）。障害調査・複数端末識別用 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await tx<string | undefined>("session", "readonly", (st) => st.get("deviceId"));
  if (existing) return existing;
  const id = `dev-${(crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 12)}`;
  await tx("session", "readwrite", (st) => st.put(id, "deviceId"));
  return id;
}
