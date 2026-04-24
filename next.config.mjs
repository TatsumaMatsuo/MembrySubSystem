import { withSentryConfig } from "@sentry/nextjs";

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
  webpack: (config) => {
    // PDF.js canvas module fix for browser-side rendering
    config.resolve.alias.canvas = false;
    return config;
  },
};

// Sentry 設定が無ければ Sentry wrap をスキップ
const withSentry = process.env.SENTRY_ORG
  ? (c) =>
      withSentryConfig(c, {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        silent: !process.env.CI,
        widenClientFileUpload: true,
        tunnelRoute: "/monitoring",
        sourcemaps: { deleteSourcemapsAfterUpload: true },
      })
  : (c) => c;

export default withSentry(nextConfig);
