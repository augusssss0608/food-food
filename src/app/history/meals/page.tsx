import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { todayUtcRange } from '@/lib/timezone';
import { PageShell } from '@/components/ui/page-shell';
import { Card } from '@/components/ui/card';

type Meal = {
  id: string;
  ate_at: string;
  source: 'preset' | 'photo_ai' | 'manual';
  dish_name: string | null;
  kcal: number | null;
};

const SOURCE_LABEL: Record<Meal['source'], string> = {
  preset: 'preset',
  photo_ai: 'ai',
  manual: '手動',
};

export default async function HistoryMealsPage() {
  const supa = await createSupabaseServerClient();
  const { data: claims, error: claimsError } = await supa.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect('/login');
  const userId = claims.claims.sub as string;

  const { data: profile, error: profileError } = await supa
    .from('profiles')
    .select('preferred_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const tz = (profile?.preferred_timezone ?? null) as string | null;
  const { timezone } = todayUtcRange(tz);

  // 近 60 天，按用戶 timezone 算起點
  const sixtyDaysAgoUtc = DateTime.now()
    .setZone(timezone)
    .minus({ days: 60 })
    .startOf('day')
    .toUTC()
    .toISO()!;

  const { data: mealsData, error: mealsError } = await supa
    .from('meals')
    .select('id, ate_at, source, dish_name, kcal')
    .eq('user_id', userId)
    .gte('ate_at', sixtyDaysAgoUtc)
    .order('ate_at', { ascending: false });
  if (mealsError) throw mealsError;

  const grouped = groupByLocalDate((mealsData ?? []) as Meal[], timezone);

  return (
    <PageShell>
      <header className="mb-8">
        <Link
          href="/"
          prefetch
          replace
          className="inline-flex items-center text-[13px] text-text-3 hover:text-text transition-colors mb-4 -ml-1"
        >
          ← 主頁
        </Link>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">history · meals</p>
        <h1 className="display-roman text-[32px] leading-none">飲食歷史</h1>
        <p className="text-text-3 text-[13px] mt-2">近 60 天每日紀錄，只看不改</p>
      </header>

      {grouped.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-text-3 text-[13px]">沒有紀錄</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, meals, totalKcal }) => (
            <section key={date}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[12px] uppercase tracking-[0.18em] text-accent font-mono">{date}</p>
                <p className="text-[11px] text-text-3 font-mono tabular">
                  {totalKcal} <span className="text-text-4">kcal · {meals.length} 餐</span>
                </p>
              </div>
              <ul className="space-y-2">
                {meals.map((m) => (
                  <li
                    key={m.id}
                    className="bg-surface border border-hairline rounded-xl px-4 py-2.5 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-text font-medium truncate">
                        {m.dish_name ?? '未命名'}
                      </p>
                      <p className="text-[10px] text-text-4 font-mono tabular mt-0.5">
                        {new Date(m.ate_at).toLocaleTimeString('zh-TW', {
                          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
                        })}
                        {' · '}
                        {SOURCE_LABEL[m.source]}
                      </p>
                    </div>
                    <p className="text-[14px] font-mono text-accent tabular flex-shrink-0">
                      {m.kcal == null ? '—' : Math.round(m.kcal)}
                      <span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function groupByLocalDate(
  meals: Meal[],
  tz: string,
): { date: string; meals: Meal[]; totalKcal: number }[] {
  const groups = new Map<string, Meal[]>();
  for (const m of meals) {
    const localDate = DateTime.fromISO(m.ate_at).setZone(tz).toISODate()!;
    const arr = groups.get(localDate) ?? [];
    arr.push(m);
    groups.set(localDate, arr);
  }
  return Array.from(groups.entries())
    .map(([date, arr]) => ({
      date,
      meals: arr,
      totalKcal: Math.round(arr.reduce((s, m) => s + (m.kcal ?? 0), 0)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
