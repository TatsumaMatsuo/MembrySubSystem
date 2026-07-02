"use client";

export const dynamic = "force-dynamic";

import { SankouZuView } from "./SankouZuView";

// 営業部ルート(/eigyo/sankou-zu): 閲覧のみ。登録/編集ボタンは非表示。
export default function SankouZuPage() {
  return <SankouZuView canRegister={false} deptLabel="営業部 > 参考図台帳検索" />;
}
