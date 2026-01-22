"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function LarkCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const callbackUrl = state ? decodeURIComponent(state) : "/";

    if (!code) {
      setError("認証コードが見つかりません");
      return;
    }

    // Lark認証APIを呼び出し
    fetch("/api/lark-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("[Lark Callback] Response:", data);
        if (data.success) {
          // 認証成功 - リダイレクト
          router.push(callbackUrl);
        } else {
          // エラー情報を表示
          setError("認証に失敗しました: " + (data.error || "不明なエラー") +
            (data.debug ? "\n\nDebug: " + JSON.stringify(data.debug, null, 2) : ""));
        }
      })
      .catch((err) => {
        console.error("[Lark Callback] Auth error:", err);
        setError("認証に失敗しました: " + err.message);
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">認証エラー</div>
            <pre className="text-gray-600 mb-4 text-left text-sm whitespace-pre-wrap">{error}</pre>
            <button
              onClick={() => router.push("/auth/signin")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ログインページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">認証中...</p>
        </div>
      </div>
    </div>
  );
}

export default function LarkCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">読み込み中...</p>
            </div>
          </div>
        </div>
      }
    >
      <LarkCallbackContent />
    </Suspense>
  );
}
