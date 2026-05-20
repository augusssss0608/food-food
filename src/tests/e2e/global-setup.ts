import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const OWNER_UID = '00000000-0000-0000-0000-000000000001';
const OWNER_EMAIL = 'owner@food-food.local';
const OWNER_PASSWORD = 'food-food-e2e-test-password-12345';
const STORAGE = path.join(__dirname, '.auth', 'owner.json');

export default async function globalSetup(config: FullConfig) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const adminKey = process.env.SUPABASE_SECRET_KEY_ADMIN;
  if (!adminKey) throw new Error('SUPABASE_SECRET_KEY_ADMIN missing; run `npx supabase status -o env > .env.test.local`');

  const admin = createClient(url, adminKey, { auth: { persistSession: false } });
  const { data: existing } = await admin.auth.admin.getUserById(OWNER_UID);
  if (existing.user) {
    await admin.auth.admin.updateUserById(OWNER_UID, { password: OWNER_PASSWORD, email: OWNER_EMAIL });
  } else {
    const r = await admin.auth.admin.createUser({
      id: OWNER_UID,
      email: OWNER_EMAIL, password: OWNER_PASSWORD, email_confirm: true,
    });
    if (r.error) throw new Error(`createUser failed: ${r.error.message}`);
  }

  await admin.schema('app_private').from('app_owner').upsert({
    id: true, owner_user_id: OWNER_UID,
  } as never, { onConflict: 'id' });

  await admin.from('meals').delete().eq('user_id', OWNER_UID);
  await admin.from('body_metrics').delete().eq('user_id', OWNER_UID);
  await admin.from('advice').delete().eq('user_id', OWNER_UID);
  await admin.from('inbox').delete().eq('user_id', OWNER_UID);
  await admin.from('workout_days').delete().eq('user_id', OWNER_UID);

  await admin.from('profiles').upsert({
    user_id: OWNER_UID,
    height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
    sex: 'male', training_days_per_week: 3,
    kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
    carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
    targets_source: 'user_override', targets_updated_at: new Date().toISOString(),
    preferred_timezone: 'Asia/Tokyo',
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'user_id' });

  process.env.ALLOWED_USER_ID = OWNER_UID;
  process.env.CRON_SECRET = 'food-food-e2e-cron-secret-12345';

  fs.mkdirSync(path.dirname(STORAGE), { recursive: true });
  const baseURL = config.projects[0]!.use.baseURL!;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  await page.fill('#email', OWNER_EMAIL);
  await page.fill('#password', OWNER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15_000 });
  await context.storageState({ path: STORAGE });
  await browser.close();
}

export { OWNER_UID, OWNER_EMAIL };
