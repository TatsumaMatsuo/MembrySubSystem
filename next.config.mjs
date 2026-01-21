/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
