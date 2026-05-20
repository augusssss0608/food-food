import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/integration/helpers/setup-env.ts'],
    include: ['src/tests/unit/**/*.test.ts', 'src/tests/integration/**/*.test.ts'],
    // 集成测共享同一个 Supabase DB（修改 app_owner / meals 等共享状态），必须串行跑
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // server-only 在 vitest 环境（不走 webpack）会 throw 模块级错误，
      // 用 empty module（server-only 自带的 react-server 条件入口）替换让测试可 import
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
});
