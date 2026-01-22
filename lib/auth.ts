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
    // セッション確認
    fetch("/api/lark-auth")
      .then((res) => res.json())
      .then((data) => {
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
      .catch(() => {
        setState({
          user: null,
          status: "unauthenticated",
        });
      });
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/lark-auth", { method: "DELETE" });
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
