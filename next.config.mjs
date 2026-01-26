/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // AWS Amplify SSR用: 環境変数をビルド時に埋め込み
  env: {
    NEXT_PUBLIC_LARK_OAUTH_CLIENT_ID: process.env.LARK_OAUTH_CLIENT_ID,
    NEXT_PUBLIC_LARK_OAUTH_REDIRECT_URI: process.env.LARK_OAUTH_REDIRECT_URI,
  },
  // サーバーサイドで使用する環境変数（ビルド時に埋め込み）
  serverRuntimeConfig: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LARK_APP_ID: process.env.LARK_APP_ID,
    LARK_APP_SECRET: process.env.LARK_APP_SECRET,
    LARK_BASE_TOKEN: process.env.LARK_BASE_TOKEN,
    LARK_BASE_TOKEN_MASTER: process.env.LARK_BASE_TOKEN_MASTER,
  },
  webpack: (config) => {
    // PDF.js canvas module fix for browser-side rendering
    config.resolve.alias.canvas = false;
    return config;
  },
  // AWS Amplify SSR対応
  output: 'standalone',
};

export default nextConfig;
