/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // AWS Amplify SSR用: 環境変数をビルド時に埋め込み
  // ※App Routerではprocess.envが直接使用されるため、envオブジェクトでの明示的な設定は不要
  // ただしAWS Amplifyでは.env.productionファイルが必要な場合がある
  env: {
    NEXT_PUBLIC_LARK_OAUTH_CLIENT_ID: process.env.LARK_OAUTH_CLIENT_ID,
    NEXT_PUBLIC_LARK_OAUTH_REDIRECT_URI: process.env.LARK_OAUTH_REDIRECT_URI,
  },
  webpack: (config) => {
    // PDF.js canvas module fix for browser-side rendering
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
