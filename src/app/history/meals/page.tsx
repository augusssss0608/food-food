import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { todayUtcRange } from '@/lib/timezone';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { HistoryDateNav } from '@/components/history-date-nav';

type Meal = {
  id: string;
  ate_at: string;
  source: 'preset' | 'photo_ai' | 'manual';
  dish_name: string | null;
  kcal: number | null;
};

type DailyAdvice = {
  content_md: string;
  generated_at: string | null;
  stale: boolean | null;
};

const SOURCE_LABEL: Record<Meal['source'], string> = {
  preset: 'preset',
  photo_ai: 'ai',
  manual: '手動',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryMealsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

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
  const { timezone, localDate: todayLocalDate } = todayUtcRange(tz);

  // 解析 date 查詢參數
  let date = params.date && DATE_RE.test(params.date) ? params.date : todayLocalDate;
  let dateDT = DateTime.fromISO(date, { zone: timezone });
  if (!dateDT.isValid) {
    date = todayLocalDate;
    dateDT = DateTime.fromISO(date, { zone: timezone });
  }
  // 不允許選未來：超過今天的 date 強制 clamp 回今天
  if (date > todayLocalDate) {
    date = todayLocalDate;
    dateDT = DateTime.fromISO(date, { zone: timezone });
  }

  const dayStart = dateDT.startOf('day');
  const startUtc = dayStart.toUTC().toISO()!;
  const endExclusiveUtc = dayStart.plus({ days: 1 }).toUTC().toISO()!;

  const [mealsRes, adviceRes] = await Promise.all([
    supa
      .from('meals')
      .select('id, ate_at, source, dish_name, kcal')
      .eq('user_id', userId)
      .gte('ate_at', startUtc)
      .lt('ate_at', endExclusiveUtc)
      .order('ate_at', { ascending: true }),
    supa
      .from('advice')
      .select('content_md, generated_at, stale')
      .eq('user_id', userId)
      .eq('kind', 'daily')
      .eq('period_start', date)
      .maybeSingle(),
  ]);
  if (mealsRes.error) throw mealsRes.error;
  if (adviceRes.error) throw adviceRes.error;

  const meals = (mealsRes.data ?? []) as Meal[];
  const advice = (adviceRes.data ?? null) as DailyAdvice | null;
  const totalKcal = Math.round(meals.reduce((s, m) => s + (m.kcal ?? 0), 0));

  const prevDate = dateDT.minus({ days: 1 }).toISODate()!;
  const nextDate = dateDT.plus({ days: 1 }).toISODate()!;
  const isToday = date === todayLocalDate;
  const dateLabel = dateDT.setLocale('zh-TW').toLocaleString({
    month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <PageShell>
      <PageHeader>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">history · meals</p>
        <h1 className="display-roman text-[32px] leading-none">飲食歷史</h1>
      </PageHeader>

      <HistoryDateNav
        date={date}
        dateLabel={dateLabel}
        todayDate={todayLocalDate}
        prevDate={prevDate}
        nextDate={nextDate}
        isToday={isToday}
      />

      <section className="mb-7">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">當日紀錄</p>
          <p className="text-[11px] text-text-3 font-mono tabular">
            {meals.length === 0 ? '無' : <>{totalKcal} <span className="text-text-4">kcal · {meals.length} 餐</span></>}
          </p>
        </div>
        {meals.length === 0 ? (
          <Card className="px-5 py-6 text-center">
            <p className="text-[13px] text-text-3">沒有紀錄</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li
                key={m.id}
                className="bg-surface border border-hairline rounded-xl px-4 py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-text font-medium truncate">{m.dish_name ?? '未命名'}</p>
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
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">AI 今日總評</p>
          {advice?.stale && (
            <p className="text-[10px] text-warm font-mono uppercase tracking-wide">已過時</p>
          )}
        </div>
        {advice ? (
          <Card className="px-4 py-4">
            <pre className="text-[13px] text-text-2 leading-relaxed whitespace-pre-wrap break-words font-sans">
              {advice.content_md}
            </pre>
            {advice.generated_at && (
              <p className="text-[10px] text-text-4 font-mono tabular mt-3">
                生成於 {new Date(advice.generated_at).toLocaleString('zh-TW', { timeZone: timezone })}
              </p>
            )}
          </Card>
        ) : (
          <Card className="px-5 py-6 text-center">
            <p className="text-[13px] text-text-3">無</p>
            {isToday && (
              <p className="text-[11px] text-text-4 mt-1">回主頁點「今天怎麼樣？」生成</p>
            )}
          </Card>
        )}
      </section>
    </PageShell>
  );
}
