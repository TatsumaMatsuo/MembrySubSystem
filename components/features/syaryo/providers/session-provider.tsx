"use client";

import { ReactNode } from "react";

/**
 * MembrySubSystem ではカスタム JWT 認証を使うため、
 * NextAuth の SessionProvider は不要。ここはパススルーのみ。
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
