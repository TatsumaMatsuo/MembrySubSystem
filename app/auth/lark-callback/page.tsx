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
    const errorParam = searchParams.get("error");
    const debugParam = searchParams.get("debug");
    const callbackUrl = state ? decodeURIComponent(state) : "/";

    // エラーパラメータがある場合（認証APIからのリダイレクト）
    if (errorParam) {
      let errorMsg = "認証に失敗しました: " + errorParam;
      if (debugParam) {
        try {
          errorMsg += "\n\nDebug: " + JSON.stringify(JSON.parse(debugParam), null, 2);
        } catch {
          errorMsg += "\n\nDebug: " + debugParam;
        }
      }
      setError(errorMsg);
      return;
    }

    if (!code) {
      setError("認証コードが見つかりません");
      return;
    }

    // GET リクエストで認証API にリダイレクト
    // AWS Amplify SSR では POST ハンドラーで環境変数にアクセスできないため
    const authUrl = new URL("/api/lark-auth", window.location.origin);
    authUrl.searchParams.set("code", code);
    authUrl.searchParams.set("callbackUrl", callbackUrl);

    // リダイレクト（認証APIがCookieを設定して最終目的地にリダイレクト）
    window.location.href = authUrl.toString();
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
