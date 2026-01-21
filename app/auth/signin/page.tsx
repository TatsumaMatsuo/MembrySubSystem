"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FileText, Shield } from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const handleSignIn = () => {
    // Lark OAuth認証URLにリダイレクト
    const appId = process.env.NEXT_PUBLIC_LARK_OAUTH_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_LARK_OAUTH_REDIRECT_URI;

    // state パラメータにcallbackUrlを含める
    const state = encodeURIComponent(callbackUrl);

    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri || "")}&state=${state}`;

    window.location.href = authUrl;
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-600 p-4 rounded-2xl">
            <FileText className="h-10 w-10 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">売約情報システム</h1>
        <p className="text-gray-600 mt-2">Lark連携 売約情報管理システム</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <Shield className="h-5 w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800">
              <p className="font-semibold">認証エラー</p>
              <p className="mt-1 text-sm">
                {error === "OAuthAccountNotLinked"
                  ? "このメールアドレスは既に別のアカウントと連携されています。"
                  : error === "OAuthCallback"
                  ? "認証中にエラーが発生しました。もう一度お試しください。"
                  : error === "CredentialsSignin"
                  ? "認証に失敗しました。もう一度お試しください。"
                  : "ログインに失敗しました。もう一度お試しください。"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Shield className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-blue-800">
            <p className="font-semibold text-sm">安全なログイン</p>
            <p className="mt-1 text-sm">
              Lark (Feishu) アカウントでログインすると、組織内のデータに安全にアクセスできます。
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSignIn}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <svg
          className="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        Lark でログイン
      </button>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-4">
        <Suspense fallback={<LoadingFallback />}>
          <SignInContent />
        </Suspense>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Powered by Lark & Next.js</p>
        </div>
      </div>
    </div>
  );
}
