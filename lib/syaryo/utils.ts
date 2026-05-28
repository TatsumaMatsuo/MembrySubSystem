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
