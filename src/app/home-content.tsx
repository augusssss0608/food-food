'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type MealPreview } from '@/components/meal-preview-card';
import { PhotoInput } from '@/components/photo-input';
import { BodyPreviewCard, type BodyPreview } from '@/components/body-preview-card';
import { PushEnableButton } from '@/components/push-enable-button';
import { TodaySummary } from '@/components/today-summary';
import { TodayMeals, type TodayMeal } from '@/components/today-meals';
import { MealDetailSheet } from '@/components/meal-detail-sheet';
import { AddMealSheet } from '@/components/add-meal-sheet';
import { WorkoutDayToggle } from '@/components/workout-day-toggle';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { saveDraft, syncDrafts } from '@/lib/drafts/sync';
import { getDraftsDb, type LocalDraft } from '@/lib/drafts/db';
import { Button } from '@/components/ui/button';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Drawer, DrawerItem } from '@/components/ui/drawer';
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
  const [mealPreview, setMealPreview] = useState<MealPreview | null>(null);
  const [bodyPreview, setBodyPreview] = useState<BodyPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<TodayMeal | null>(null);
  const [addMealOpen, setAddMealOpen] = useState(false);

  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [mealExtractBusy, setMealExtractBusy] = useState(false);
  const [bodyExtractBusy, setBodyExtractBusy] = useState(false);
  const [confirmMealBusy, setConfirmMealBusy] = useState(false);
  const [confirmBodyBusy, setConfirmBodyBusy] = useState(false);
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
      router.refresh();
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
      router.refresh();
    }
  }

  async function uploadBodyPhoto(b64: string) {
    setBodyExtractBusy(true);
    try {
      const r = await fetch('/api/body/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      setBodyPreview(await r.json() as BodyPreview);
    } catch (e: unknown) {
      toast.error('識別失敗', (e as Error).message);
    } finally {
      setBodyExtractBusy(false);
    }
  }

  async function confirmBody(b: BodyPreview) {
    setConfirmBodyBusy(true);
    const r = await submit('body_metric', '/api/body/log', {
      measured_at: b.measured_at ?? new Date().toISOString(),
      weight_kg: b.weight_kg, body_fat_pct: b.body_fat_pct,
      skeletal_muscle_pct: b.skeletal_muscle_pct,
      visceral_fat: b.visceral_fat, bmi: b.bmi,
      source: 'screenshot', ai_raw_json: {},
    });
    setConfirmBodyBusy(false);
    if (r) {
      setBodyPreview(null);
      toast.success('已入庫', `${b.weight_kg} kg`);
      router.refresh();
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

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    location.replace('/login');
  }

  function tryOpenAddMeal() {
    if (!workoutMarked) {
      toast.info('請先選擇今日是訓練日或休息日');
      return;
    }
    // 互斥：開「新增餐」前先關詳情面板，避免兩 sheet 同時 fixed 定位 / body 鎖滾打架
    setSelectedMeal(null);
    setAddMealOpen(true);
  }

  function handleSelectMeal(m: TodayMeal) {
    // 互斥：開詳情前關「新增餐」
    setAddMealOpen(false);
    setSelectedMeal(m);
  }

  const today = new Date().toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'long', timeZone: timezone,
  });
  const workoutHint = workoutMarked
    ? (isWorkoutDay ? '訓練日' : '休息日')
    : '未標記';

  return (
    <>
      <PageShell>
        {/* Header — 左：漢堡，右：「+」新增餐 */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="open menu"
              className="p-2 -ml-2 text-text-2 hover:text-text active:scale-95 transition-all rounded-md"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="13" x2="20" y2="13" />
                <line x1="4" y1="19" x2="14" y2="19" />
              </svg>
            </button>
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
          </div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">{today}</p>
          <h1 className="display-roman text-[34px] leading-none">
            food <span className="display">·</span> food
          </h1>
        </header>

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

        {/* 今日狀態切換：訓練日 / 休息日 */}
        <WorkoutDayToggle
          date={todayDate}
          workoutMarked={workoutMarked}
          isWorkoutDay={isWorkoutDay}
        />

        {/* 今日摘要 */}
        <TodaySummary consumed={consumed} targets={targets} workoutHint={workoutHint} />

        {/* 今日已記錄的 meals */}
        <TodayMeals meals={meals} timezone={timezone} onSelect={handleSelectMeal} />

        {/* 體重 / 體脂截圖 — 留在主頁，不進 AddMealSheet（功能性不同） */}
        <section className="mb-8">
          <SectionLabel>體重 / 體脂截圖</SectionLabel>
          {!bodyPreview && !bodyExtractBusy && (
            <PhotoInput onPicked={uploadBodyPhoto} label="上傳體重秤截圖" />
          )}
          {bodyExtractBusy && (
            <Card className="h-28 flex items-center justify-center gap-3">
              <Spinner size={18} className="text-accent" />
              <span className="text-[13px] text-text-2">AI OCR 中…</span>
            </Card>
          )}
          {bodyPreview && (
            <BodyPreviewCard
              initial={bodyPreview}
              onConfirm={confirmBody}
              onCancel={() => setBodyPreview(null)}
              busy={confirmBodyBusy}
            />
          )}
        </section>

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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <DrawerItem
          icon={<IconBell />}
          label="通知中心"
          hint="本週 / 本月建議、提醒"
          href="/inbox"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconHistory />}
          label="飲食歷史"
          hint="近 60 天每日紀錄"
          href="/history/meals"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconChart />}
          label="身體數據"
          hint="體重 / 體脂 / 肌肉 趨勢圖"
          href="/history/body"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconSliders />}
          label="修改目標"
          hint="卡路里 · 蛋白 · 碳水 · 脂肪"
          href="/settings"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconUser />}
          label="個人資料"
          hint="身高 / 體重 / 訓練頻率"
          href="/setup"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconActivity />}
          label="偵錯面板"
          hint="AI 呼叫 · 錯誤日誌 · cron"
          href="/admin/debug"
          onClick={() => setDrawerOpen(false)}
        />
        <DrawerItem
          icon={<IconLogout />}
          label="登出"
          onClick={signOut}
          danger
        />
        <div className="px-5 py-6 text-[11px] uppercase tracking-[0.16em] text-text-4 font-mono">
          v0.1 · single-user beta
        </div>
      </Drawer>

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

      {/* 今日 meal 詳情 / 編輯 / 刪除 */}
      <MealDetailSheet meal={selectedMeal} timezone={timezone} onClose={() => setSelectedMeal(null)} />
    </>
  );
}

/* —— icons —— */
const ic = (path: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const IconBell = () => ic(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>);
const IconSliders = () => ic(<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>);
const IconUser = () => ic(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
const IconActivity = () => ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const IconLogout = () => ic(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);
const IconHistory = () => ic(<><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 10 9 10" /><polyline points="12 7 12 12 15 14" /></>);
const IconChart = () => ic(<><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></>);
