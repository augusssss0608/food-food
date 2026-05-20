import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(__dirname, '.env.test.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && m[1]) {
      const raw = m[2] ?? '';
      const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
      process.env[m[1]] = value;
    }
  }
}
const ALIAS: Record<string, string> = {
  API_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  ANON_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SECRET_KEY_ADMIN',
};
for (const [from, to] of Object.entries(ALIAS)) {
  if (from in process.env) process.env[to] = process.env[from] ?? '';
}

const STORAGE = path.join(__dirname, 'src/tests/e2e/.auth/owner.json');
const OWNER_UID = '00000000-0000-0000-0000-000000000001';
const CRON_SECRET = 'food-food-e2e-cron-secret-12345';
const DEV_SECRET = 'food-food-e2e-dev-secret-12345';
// 真实 VAPID keypair（codex round B 用 web-push 生成）；
// 没有 PRIVATE_KEY 时 push/send.ts 会抛 config 错，发送 failed 的根因就成 "配置错误" 而不是 "endpoint 不可达"
const VAPID_PUBLIC_KEY = 'BF6zyYd7LQGHLr47dHAr9ryUYvyc0JHAvQ28svoJYSd1MMNPQFjIzN04a4hK9o5fll7eZImLW9MT0m7-17EDH4Q';
const VAPID_PRIVATE_KEY = 'zmfRDO6MOjQDyx70ye1Ke_JYZV9O_7bw3yIiBcZYJaM';

export default defineConfig({
  testDir: './src/tests/e2e',
  testIgnore: ['**/global-setup.ts'],
  globalSetup: './src/tests/e2e/global-setup.ts',
  fullyParallel: false,
  // dev mode 首次编译 API route 较慢；5 workers 并发会让编译相互争抢，单 worker 顺序跑更稳
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    storageState: STORAGE,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      MOCK_AI: '1',
      ALLOWED_USER_ID: OWNER_UID,
      CRON_SECRET,
      DEV_SECRET,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: 'mailto:e2e@food-food.local',
    },
  },
});
