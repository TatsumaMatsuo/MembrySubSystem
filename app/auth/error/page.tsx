"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return {
          title: "設定エラー",
          description: "認証の設定に問題があります。システム管理者に連絡してください。",
        };
      case "AccessDenied":
        return {
          title: "アクセス拒否",
          description: "このアプリケーションへのアクセス権限がありません。",
        };
      case "Verification":
        return {
          title: "検証エラー",
          description: "トークンの検証に失敗しました。もう一度ログインしてください。",
        };
      case "OAuthSignin":
        return {
          title: "OAuth サインインエラー",
          description: "OAuthプロバイダーへのサインインに失敗しました。",
        };
      case "OAuthCallback":
        return {
          title: "OAuth コールバックエラー",
          description: "認証プロセス中にエラーが発生しました。",
        };
      case "OAuthAccountNotLinked":
        return {
          title: "アカウント未リンク",
          description: "このメールアドレスは既に別のアカウントと連携されています。",
        };
      case "SessionRequired":
        return {
          title: "セッション必須",
          description: "このページにアクセスするにはログインが必要です。",
        };
      default:
        return {
          title: "認証エラー",
          description: "予期しないエラーが発生しました。もう一度お試しください。",
        };
    }
  };

  const errorInfo = getErrorMessage(error);

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-red-600 p-3 rounded-full">
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-red-900">{errorInfo.title}</h1>
        <p className="text-gray-600 mt-2">{errorInfo.description}</p>
      </div>

      {error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-600 font-mono">
            エラーコード: {error}
          </p>
        </div>
      )}

      <div className="text-sm text-gray-700 mb-6">
        <p className="font-semibold mb-2">解決方法:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>もう一度ログインを試してください</li>
          <li>ブラウザのキャッシュをクリアしてください</li>
          <li>問題が解決しない場合は、システム管理者に連絡してください</li>
        </ul>
      </div>

      <div className="flex gap-2">
        <Link
          href="/"
          className="flex-1 text-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ホームに戻る
        </Link>
        <Link
          href="/auth/signin"
          className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          再度ログイン
        </Link>
      </div>
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

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
      <div className="w-full max-w-md px-4">
        <Suspense fallback={<LoadingFallback />}>
          <AuthErrorContent />
        </Suspense>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>サポートが必要な場合は、システム管理者にお問い合わせください</p>
        </div>
      </div>
    </div>
  );
}
