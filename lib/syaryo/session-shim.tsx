"use client";

import { useAuth } from "@/lib/auth";

/**
 * next-auth/react 互換シム
 * syaryo モジュールが next-auth の useSession を前提にしているため、
 * MembrySubSystem の独自 JWT セッションにブリッジする。
 */
export interface SyaryoSession {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function useSession(): {
  data: SyaryoSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
} {
  const { user, status } = useAuth();
  if (status === "loading") return { data: null, status: "loading" };
  if (!user) return { data: null, status: "unauthenticated" };
  return {
    data: {
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      },
    },
    status: "authenticated",
  };
}

export async function signIn(_provider?: string, options?: { callbackUrl?: string }) {
  if (typeof window !== "undefined") {
    const callback = options?.callbackUrl ? `?callbackUrl=${encodeURIComponent(options.callbackUrl)}` : "";
    window.location.href = `/auth/signin${callback}`;
  }
}

export async function signOut(options?: { callbackUrl?: string }) {
  if (typeof window !== "undefined") {
    await fetch("/api/lark-auth", { method: "DELETE", credentials: "include" });
    window.location.href = options?.callbackUrl || "/auth/signin";
  }
}
