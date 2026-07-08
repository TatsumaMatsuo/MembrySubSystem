import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// iOS Safari の Date.prototype.toISOString() は Invalid Date に対して
// 「the string did not match the expected pattern」を投げる。
// 事前にチェックして、不正な日付は呼び出し側で扱えるよう例外に統一する。
export function toApiDateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("日付が不正です。正しい日付を入力してください。")
  }
  return date.toISOString()
}

/**
 * 1:1書類（免許証など）で、複数レコードが残っている場合に「表示すべき1件」を選ぶ。
 * 却下後の再申請では却下レコードが残ったまま新しい pending が追加されるため、
 * 却下より pending/approved（アクティブ）を優先し、同区分では後勝ち（配列の後方＝最新）を採用する。
 */
export function pickLatestActive<T extends { approval_status?: string }>(
  docs: T[]
): T | null {
  return docs.reduce<T | null>((best, cur) => {
    if (!best) return cur
    const curActive = cur.approval_status !== "rejected"
    const bestRejected = best.approval_status === "rejected"
    // curがアクティブ、またはbestが却下なら cur を採用（後勝ち）
    return curActive || bestRejected ? cur : best
  }, null)
}
