'use client';
import { useCallback, useEffect, useState } from 'react';
import { FITNESS_MEAL_PRESETS } from '@/lib/fitness-meals';
import { PhotoInput } from '@/components/photo-input';
import { MealPreviewCard, type MealPreview } from '@/components/meal-preview-card';
import { BodyPreviewCard, type BodyPreview } from '@/components/body-preview-card';
import { PushEnableButton } from '@/components/push-enable-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { saveDraft, syncDrafts } from '@/lib/drafts/sync';
import { getDraftsDb, type LocalDraft } from '@/lib/drafts/db';
import { Button } from '@/components/ui/button';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Drawer, DrawerItem } from '@/components/ui/drawer';
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

export function HomeContent() {
  const [mealPreview, setMealPreview] = useState<MealPreview | null>(null);
  const [bodyPreview, setBodyPreview] = useState<BodyPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [mealExtractBusy, setMealExtractBusy] = useState(false);
  const [bodyExtractBusy, setBodyExtractBusy] = useState(false);
  const [confirmMealBusy, setConfirmMealBusy] = useState(false);
  const [confirmBodyBusy, setConfirmBodyBusy] = useState(false);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const toast = useToast();

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
    if (r) toast.success('已記錄', name);
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
    if (r) { setMealPreview(null); toast.success('已入庫', p.dish_name); }
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
    if (r) { setBodyPreview(null); toast.success('已入庫', `${b.weight_kg} kg`); }
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
    location.href = '/login';
  }

  const today = new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <>
      <main className="min-h-dvh flex flex-col px-5 pt-6 pb-12 max-w-md mx-auto">
        <div className="m-auto w-full">
          {/* Header */}
          <header className="flex items-start justify-between mb-7">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">{today}</p>
              <h1 className="display-roman text-[34px] leading-none">
                food <span className="display">·</span> food
              </h1>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="open menu"
              className="p-2 -mr-2 text-text-2 hover:text-text active:scale-95 transition-all rounded-md"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="13" x2="20" y2="13" />
                <line x1="4" y1="19" x2="14" y2="19" />
              </svg>
            </button>
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

          {/* Section: Preset meals */}
          <section className="mb-7">
            <SectionLabel>選健身餐</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FITNESS_MEAL_PRESETS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => pickFitnessMeal(k, v.name)}
                  disabled={presetBusy !== null}
                  className={[
                    'group relative bg-surface border border-hairline rounded-xl p-4 text-left transition-colors',
                    'hover:border-hairline-strong hover:bg-surface-2',
                    'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  <p className="text-[14px] text-text font-medium leading-tight">{v.name}</p>
                  <p className="text-[18px] font-mono text-accent tabular mt-2 leading-none">{v.kcal}<span className="text-[10px] text-text-3 ml-1">kcal</span></p>
                  {presetBusy === k && (
                    <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Spinner size={18} className="text-accent" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Section: Meal photo */}
          <section className="mb-7">
            <SectionLabel>拍餐 · 其他</SectionLabel>
            {!mealPreview && !mealExtractBusy && (
              <PhotoInput onPicked={uploadMealPhoto} label="拍照 / 選圖識別" />
            )}
            {mealExtractBusy && (
              <Card className="h-28 flex items-center justify-center gap-3">
                <Spinner size={18} className="text-accent" />
                <span className="text-[13px] text-text-2">AI 識別中…</span>
              </Card>
            )}
            {mealPreview && (
              <MealPreviewCard
                initial={mealPreview}
                onConfirm={confirmMeal}
                onCancel={() => setMealPreview(null)}
                busy={confirmMealBusy}
              />
            )}
          </section>

          {/* Section: Body screenshot */}
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

          {/* Section: Daily advice CTA */}
          <section>
            <Button
              onClick={triggerDailyAdvice}
              loading={adviceBusy}
              size="lg"
              className="w-full"
            >
              {adviceBusy ? 'AI 思考中…' : '今天怎麼樣？'}
            </Button>
            <p className="text-center text-[11px] text-text-4 mt-2 font-mono uppercase tracking-wide">
              AI generates a daily summary
            </p>
          </section>
        </div>
      </main>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <DrawerItem
          icon={<IconBell />}
          label="通知中心"
          hint="本週 / 本月建議、提醒"
          href="/inbox"
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
