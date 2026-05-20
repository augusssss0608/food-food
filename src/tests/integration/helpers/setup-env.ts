import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.test.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && m[1]) {
      // 去掉 .env 文件里可能的两端双引号（supabase status -o env 会带引号）
      const raw = m[2] ?? '';
      const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
      process.env[m[1]] = value;  // 强制覆盖（测试环境必须用 .env.test.local）
    }
  }
}

// `supabase status -o env` 给出 API_URL / ANON_KEY / SERVICE_ROLE_KEY 这类名字，
// 但本项目用 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY_ADMIN。
// alias 归一化策略：source key 出现在文件里就覆盖 target（即使 source 值为空也覆盖，让坏文件 fast-fail 而不是串到 shell 残留）。
const ALIAS: Record<string, string> = {
  API_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  ANON_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SECRET_KEY_ADMIN',
};
for (const [from, to] of Object.entries(ALIAS)) {
  if (from in process.env) process.env[to] = process.env[from] ?? '';  // 存在即覆盖（含空字符串）
}
