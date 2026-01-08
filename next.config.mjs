/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // PDF.js canvas module fix for browser-side rendering
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
