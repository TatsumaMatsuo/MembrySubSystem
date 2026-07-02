"use client";

export const dynamic = "force-dynamic";

import { SankouZuView } from "@/app/eigyo/sankou-zu/page";

// 設計部ルート(/sekkei/sankou-zu): 登録/編集を有効化。
// 営業部(/eigyo/sankou-zu)とは別URL・別プログラムIDにして、メニュー切替を確実に反映する。
export default function SekkeiSankouZuPage() {
  return <SankouZuView canRegister deptLabel="設計部 > 支援ツール > 参考図台帳検索" />;
}
