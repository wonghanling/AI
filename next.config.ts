import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 图片优化
  images: {
    domains: ['via.placeholder.com'], // 添加允许的图片域名
    formats: ['image/webp', 'image/avif'], // 使用现代图片格式
  },

  // 编译优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // 生产环境移除 console
  },

  // 实验性功能
  experimental: {
    optimizeCss: true, // CSS 优化
  },

  // 压缩
  compress: true,

  // 性能优化
  poweredByHeader: false, // 移除 X-Powered-By 头
  reactStrictMode: true, // 启用严格模式
};

export default nextConfig;
