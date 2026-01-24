"use client";

import { useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

export interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

// カスタム認証フック
export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    status: "loading",
  });

  useEffect(() => {
    // セッション確認 - credentials: "include" でCookieを確実に送信
    fetch("/api/lark-auth", {
      credentials: "include",
      cache: "no-store" // キャッシュを無効化して常に最新の状態を取得
    })
      .then((res) => {
        if (!res.ok) {
          console.error("[useAuth] Session check failed:", res.status);
          throw new Error("Session check failed");
        }
        return res.json();
      })
      .then((data) => {
        console.log("[useAuth] Session check result:", { hasUser: !!data.user });
        if (data.user) {
          setState({
            user: data.user as User,
            status: "authenticated",
          });
        } else {
          setState({
            user: null,
            status: "unauthenticated",
          });
        }
      })
      .catch((error) => {
        console.error("[useAuth] Session check error:", error);
        setState({
          user: null,
          status: "unauthenticated",
        });
      });
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/lark-auth", {
      method: "DELETE",
      credentials: "include"
    });
    setState({ user: null, status: "unauthenticated" });
    window.location.href = "/auth/signin";
  }, []);

  return { ...state, signOut };
}

// サーバーサイドでセッション取得
export async function getSession(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/lark");
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}
