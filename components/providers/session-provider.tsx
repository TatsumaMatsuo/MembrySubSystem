"use client";

import { ReactNode } from "react";

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * カスタム認証を使用するため、NextAuthのSessionProviderは不要
 * 互換性のためにchildrenをそのまま返す
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return <>{children}</>;
}
