import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 幂等地确保一个测试用户存在。
 * Supabase auth 即使 listUsers 查不到也可能因为内存残留拒绝同 email 的 createUser，
 * 所以 createUser 失败时翻页 listUsers 找出来并重置密码。
 */
export async function ensureTestUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<{ id: string }> {
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.data.user) return r.data.user;
  for (let page = 1; page <= 10; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    const found = list.users.find((u) => u.email === email);
    if (found) {
      await admin.auth.admin.updateUserById(found.id, { password });
      return found;
    }
    if (list.users.length < 100) break;
  }
  throw new Error(`ensureTestUser('${email}') 失败：createUser err=${r.error?.message ?? 'null'}, listUsers no hit`);
}
