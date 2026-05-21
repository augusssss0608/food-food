'use client';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { type MealPreview } from '@/components/meal-preview-card';
import { PushEnableButton } from '@/components/push-enable-button';
import { TodaySummary } from '@/components/today-summary';
import { TodayMeals, type TodayMeal } from '@/components/today-meals';
import { AddMealSheet } from '@/components/add-meal-sheet';
import { WorkoutDayToggle } from '@/components/workout-day-toggle';
import { PageHeader } from '@/components/page-header';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { saveDraft, syncDrafts } from '@/lib/drafts/sync';
import { getDraftsDb, type LocalDraft } from '@/lib/drafts/db';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';

type DraftPayload = { endpoint: string; body: Record<string, unknown>; idempotencyKey: string };

async function uploadDraft(draft: LocalDraft): Promise<{ id: string }> {
  const p = draft.payload as DraftPayload;
  const r = await fetch(p.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': p.idempotencyKey },
    body: JSON.stringify(p.body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return { id: j.mealId ?? j.id ?? draft.id };
}

const isOfflineError = (e: unknown): boolean => e instanceof TypeError;

type Targets = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

export function HomeContent({
  meals,
  targets,
  timezone,
  todayDate,
  isWorkoutDay,
  workoutMarked,
}: {
  meals: TodayMeal[];
  isWorkoutDay: boolean;
  workoutMarked: boolean;
  targets: Targets;
  timezone: string;
  todayDate: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mealPreview, setMealPreview] = useState<MealPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [addMealOpen, setAddMealOpen] = useState(false);

  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [mealExtractBusy, setMealExtractBusy] = useState(false);
  const [confirmMealBusy, setConfirmMealBusy] = useState(false);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const toast = useToast();

  const consumed = useMemo(() => meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carb_g: acc.carb_g + (m.carb_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  ), [meals]);

  const refreshDraftCount = useCallback(async () => {
    if (!userId) return;
    const pending = await getDraftsDb().drafts
      .where({ ownerUserId: userId, status: 'pending' }).count();
    setDraftCount(pending);
  }, [userId]);

  useEffect(() => {
    const supa = createSupabaseBrowserClient();
    supa.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const tick = () => syncDrafts(userId, uploadDraft).then(refreshDraftCount);
    tick();
    window.addEventListener('online', tick);
    return () => window.removeEventListener('online', tick);
  }, [userId, refreshDraftCount]);

  async function submit(
    type: 'meal' | 'body_metric',
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<unknown | null> {
    const idempotencyKey = crypto.randomUUID();
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      return await r.json();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (isOfflineError(e) && userId) {
        await saveDraft(userId, type, { endpoint, body, idempotencyKey } satisfies DraftPayload);
        await refreshDraftCount();
        toast.info('離線已暫存', '恢復網路後自動同步');
        return null;
      }
      toast.error('提交失敗', err.message ?? 'unknown');
      return null;
    }
  }

  async function pickFitnessMeal(key: string, name: string) {
    setPresetBusy(key);
    const r = await submit('meal', '/api/meals/log', {
      ate_at: new Date().toISOString(), source: 'preset', preset_key: key,
    });
    setPresetBusy(null);
    if (r) {
      toast.success('已記錄', name);
      setAddMealOpen(false);
      // useTransition：refresh 不阻塞後續導航（修用戶反饋「新增完馬上點 drawer 跳轉卡 2-3s」）
      startTransition(() => router.refresh());
    }
  }

  async function uploadMealPhoto(b64: string) {
    setMealExtractBusy(true);
    try {
      const r = await fetch('/api/meals/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      setMealPreview(await r.json() as MealPreview);
    } catch (e: unknown) {
      toast.error('識別失敗', (e as Error).message);
    } finally {
      setMealExtractBusy(false);
    }
  }

  async function confirmMeal(p: MealPreview, satiety: number | undefined) {
    setConfirmMealBusy(true);
    const r = await submit('meal', '/api/meals/log', {
      ate_at: new Date().toISOString(), source: 'photo_ai',
      dish_name: p.dish_name, kcal: p.kcal, protein_g: p.protein_g,
      carb_g: p.carb_g, fat_g: p.fat_g, fiber_g: p.fiber_g,
      ai_raw_json: { confidence: p.confidence }, satiety,
    });
    setConfirmMealBusy(false);
    if (r) {
      setMealPreview(null);
      toast.success('已入庫', p.dish_name);
      setAddMealOpen(false);
      startTransition(() => router.refresh());
    }
  }

  async function triggerDailyAdvice() {
    setAdviceBusy(true);
    try {
      const r = await fetch('/api/advice/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      toast.info('今日總評', j.content_md.slice(0, 300));
    } catch (e: unknown) {
      toast.error('生成失敗', (e as Error).message);
    } finally {
      setAdviceBusy(false);
    }
  }

  function tryOpenAddMeal() {
    if (!workoutMarked) {
      toast.info('請先選擇今日是訓練日或休息日');
      return;
    }
    setAddMealOpen(true);
  }

  const today = new Date().toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'long', timeZone: timezone,
  });

  return (
    <>
      <PageShell>
        <PageHeader
          rightAction={
            <button
              type="button"
              onClick={tryOpenAddMeal}
              aria-label="add meal"
              className={[
                'p-2 -mr-2 active:scale-95 transition-all rounded-md',
                workoutMarked ? 'text-accent hover:text-accent-press' : 'text-text-3 hover:text-text-2',
              ].join(' ')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          }
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">{today}</p>
          <h1 className="display-roman text-[34px] leading-none">
            food <span className="display">·</span> food
          </h1>
        </PageHeader>

        {/* Push state + draft chip */}
        <div className="flex items-center justify-between mb-6 min-h-[1.5rem]">
          <PushEnableButton />
          {draftCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-warm font-mono uppercase tracking-wide">
              <Spinner size={10} className="text-warm" />
              {draftCount} 待同步
            </div>
          )}
        </div>

        {/* 今日狀態：未標記時顯示 toggle；標記後該行消失，切換交給 TodaySummary 右上標籤 */}
        <WorkoutDayToggle date={todayDate} workoutMarked={workoutMarked} />

        {/* 今日摘要（含可點切換的右上日狀態標籤） */}
        <TodaySummary
          consumed={consumed}
          targets={targets}
          workoutMarked={workoutMarked}
          isWorkoutDay={isWorkoutDay}
          todayDate={todayDate}
        />

        {/* 今日已記錄：inline 展開編輯，不再彈半窗 */}
        <TodayMeals meals={meals} timezone={timezone} />

        {/* AI 今日總評 */}
        <section>
          <Button onClick={triggerDailyAdvice} loading={adviceBusy} size="lg" className="w-full">
            {adviceBusy ? 'AI 思考中…' : '今天怎麼樣？'}
          </Button>
          <p className="text-center text-[11px] text-text-4 mt-2 font-mono uppercase tracking-wide">
            AI generates a daily summary
          </p>
        </section>
      </PageShell>

      {/* 「+」打開的新增餐面板 */}
      <AddMealSheet
        open={addMealOpen}
        onClose={() => setAddMealOpen(false)}
        presetBusy={presetBusy}
        onPickPreset={pickFitnessMeal}
        mealExtractBusy={mealExtractBusy}
        onUploadMealPhoto={uploadMealPhoto}
        mealPreview={mealPreview}
        onConfirmMeal={confirmMeal}
        onCancelMealPreview={() => setMealPreview(null)}
        confirmMealBusy={confirmMealBusy}
      />
    </>
  );
}
