"use client";

import { useState, useEffect } from "react";

/**
 * 画面幅がブレークポイント以下かを返す(SSR/初期描画はデスクトップ扱い)。
 * インラインスタイルのページでモバイル時にレイアウトを切替える用途。
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}
