import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 15 默認 staleTimes.dynamic = 0，dynamic route 的 RSC prefetch
    // 一拉到客戶端就失效，每次點 <Link> 都會重新 server fetch（包括 / 的 Supabase
    // claims + profile 查詢）。設 30s 讓返回類點擊（30 秒內）能瞬切。
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
