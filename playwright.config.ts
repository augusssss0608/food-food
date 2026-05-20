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

export default defineConfig({
  testDir: './src/tests/e2e',
  testIgnore: ['**/global-setup.ts'],
  globalSetup: './src/tests/e2e/global-setup.ts',
  fullyParallel: false,
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
    },
  },
});
