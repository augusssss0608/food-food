'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { type MealPreview } from '@/components/meal-preview-card';
import { PushEnableButton } from '@/components/push-enable-button';
import { TodaySummary } from '@/components/today-summary';
import { TodayMeals, type TodayMeal } from '@/components/today-meals';
import { RecordMealSheet } from '@/components/record-meal-sheet';
import { WorkoutDayToggle } from '@/components/workout-day-toggle';
import { PageHeader } from '@/components/page-header';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { saveDraft, syncDrafts } from '@/lib/drafts/sync';
import { getDraftsDb, type LocalDraft } from '@/lib/drafts/db';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';
import type { HomeSnapshot, UserMealPreset, RecentPhotoMeal } from '@/lib/home-snapshot';
import type { MealPresetFormInput } from '@/components/meal-preset-form';

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
  return { id: j.meal?.id ?? j.id ?? j.mealId ?? draft.id };
}

const isOfflineError = (e: unknown): boolean => e instanceof TypeError;

const HOME_KEY = '/api/home/today';
const homeFetcher = async (url: string): Promise<HomeSnapshot> => {
  const r = await fetch(url, { headers: { 'sec-fetch-site': 'same-origin' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/**
 * 主頁狀態用 SWR cache 接管：
 * - 首屏 fallback 來自 RSC（loadHomeSnapshot 同 loader），無 loading 閃爍
 * - mutation 成功後直接 `mutate(HOME_KEY, updater, { revalidate: false })` 改 cache，UI 立即更新
 * - 不再用 router.refresh()，drawer 路由不受影響
 * - revalidateOnFocus 關（iOS PWA 切前後台會誤觸發），revalidateOnReconnect 開
 */
export function HomeContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const { data: snapshot, mutate } = useSWR<HomeSnapshot>(HOME_KEY, homeFetcher, {
    fallbackData: initialSnapshot,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
  });
  // fallbackData 保證永遠有值；下面以非空斷言取用
  const data = snapshot!;
  const { meals, timezone, todayDate, isWorkoutDay, workoutMarked, targets } = data;
  // customPresets / recentPhotoMeals 走 zod optional().default([])，部署窗口 RPC 還沒返回時為 []
  const customPresets = data.customPresets ?? [];
  const recentPhotoMeals = data.recentPhotoMeals ?? [];

  // SWR 細節：fallbackData 只填 hook returned data，**不寫入 cache**。
  // 後續 mutate((prev) => ...) 收到的 prev 來自 cache（undefined），不是 fallbackData。
  // mount 後把 initialSnapshot seed 進 cache，讓後續 patch 的 prev 永遠是 truthy。
  //
  // 重點：用 `prev ?? initialSnapshot` 而不是無條件覆蓋。
  // 切到別頁再回主頁時，Next Router Cache 會把舊 RSC payload 重新 hydrate，
  // 帶來的 initialSnapshot 是 mutation 前的舊快照；如果無條件 mutate 過去，
  // 會把 SWR cache 裡 patch 過的最新值打回去，造成「切頁再回 UI 還原」。
  // 這裡只在 cache 真的為空時填，已有值（含 mutation 後的最新值）一律保留。
  useEffect(() => {
    mutate((prev) => prev ?? initialSnapshot, { revalidate: false });
  }, [initialSnapshot, mutate]);

  const [mealPreview, setMealPreview] = useState<MealPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [addMealOpen, setAddMealOpen] = useState(false);

  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [mealExtractBusy, setMealExtractBusy] = useState(false);
  const [confirmMealBusy, setConfirmMealBusy] = useState(false);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [workoutBusy, setWorkoutBusy] = useState(false);
  const [createPresetBusy, setCreatePresetBusy] = useState(false);
  const [duplicatePresetName, setDuplicatePresetName] = useState(false);
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
    supa.auth.getUser().then(({ data: u }) => setUserId(u.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const tick = async () => {
      // 先查 pending；0 就跳過，避免首屏沒事也 mutate() 觸發 endpoint revalidate
      // （codex round D medium 反饋：違背「首屏只靠 RSC fallback」）
      const pending = await getDraftsDb().drafts
        .where({ ownerUserId: userId, status: 'pending' }).count();
      if (pending === 0) {
        setDraftCount(0);
        return;
      }
      await syncDrafts(userId, uploadDraft);
      await refreshDraftCount();
      // 真的同步了才拉新 snapshot
      mutate();
    };
    tick();
    window.addEventListener('online', tick);
    return () => window.removeEventListener('online', tick);
  }, [userId, refreshDraftCount, mutate]);

  // ============ 統一的 SWR cache patcher ============
  // base = prev ?? data：cache 未 seed 時退化用 displayed data（initialSnapshot），
  // 保證 patch 永遠基於最新可見快照。data 變化 → patcher rebuild → onMealDeleted/Updated
  // 也跟著 rebuild，傳遞到子層的 identity 會變，這是可接受成本（避免錯版本 patch）
  const patchMeals = useCallback((updater: (prev: TodayMeal[]) => TodayMeal[]) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      return { ...base, meals: updater(base.meals) };
    }, { revalidate: false });
  }, [mutate, data]);

  // 自定义菜单 cache patch：prepend 新 preset
  const patchCustomPresets = useCallback((preset: UserMealPreset) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      const existing = base.customPresets ?? [];
      return { ...base, customPresets: [preset, ...existing] };
    }, { revalidate: false });
  }, [mutate, data]);

  const patchUpdateCustomPreset = useCallback((preset: UserMealPreset) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      const existing = base.customPresets ?? [];
      return { ...base, customPresets: existing.map((p) => (p.id === preset.id ? preset : p)) };
    }, { revalidate: false });
  }, [mutate, data]);

  const patchDeleteCustomPreset = useCallback((id: string) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      const existing = base.customPresets ?? [];
      return { ...base, customPresets: existing.filter((p) => p.id !== id) };
    }, { revalidate: false });
  }, [mutate, data]);

  // 拍照入庫後：normalize 後同名替換，prepend，截 10
  const patchRecentPhotoMeals = useCallback((meal: TodayMeal) => {
    if (meal.source !== 'photo_ai') return;
    if (
      meal.dish_name == null ||
      meal.kcal == null ||
      meal.protein_g == null ||
      meal.carb_g == null ||
      meal.fat_g == null
    ) return;
    const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      const dishName = meal.dish_name!;
      const item: RecentPhotoMeal = {
        meal_id: meal.id,
        dish_name: dishName.trim(),
        kcal: meal.kcal!,
        protein_g: meal.protein_g!,
        carb_g: meal.carb_g!,
        fat_g: meal.fat_g!,
        fiber_g: meal.fiber_g ?? 0,
        created_at: new Date().toISOString(),
      };
      const existing = base.recentPhotoMeals ?? [];
      return {
        ...base,
        recentPhotoMeals: [
          item,
          ...existing.filter((x) => norm(x.dish_name) !== norm(dishName)),
        ].slice(0, 10),
      };
    }, { revalidate: false });
  }, [mutate, data]);

  const patchWorkout = useCallback((isWorkout: boolean) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      return {
        ...base,
        workoutMarked: true,
        isWorkoutDay: isWorkout,
        targets: isWorkout ? base.targetOptions.workout : base.targetOptions.rest,
      };
    }, { revalidate: false });
  }, [mutate, data]);

  // ============ workout day 切換（lift up from WorkoutDayToggle + TodaySummary）============
  async function setWorkoutDay(isWorkout: boolean): Promise<boolean> {
    if (workoutBusy) return false;
    setWorkoutBusy(true);
    try {
      const r = await fetch('/api/workout-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ date: todayDate, is_workout: isWorkout }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      patchWorkout(isWorkout);
      return true;
    } catch (e: unknown) {
      toast.error('切換失敗', (e as Error).message);
      return false;
    } finally {
      setWorkoutBusy(false);
    }
  }

  // ============ meal mutation 入口 ============
  async function submitMealPost(body: Record<string, unknown>): Promise<TodayMeal | null> {
    const idempotencyKey = crypto.randomUUID();
    try {
      const r = await fetch('/api/meals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      // 新 API contract：{ ok, meal }；舊兼容：{ mealId }
      if (j?.meal) return j.meal as TodayMeal;
      return null;
    } catch (e: unknown) {
      if (isOfflineError(e) && userId) {
        await saveDraft(userId, 'meal', { endpoint: '/api/meals/log', body, idempotencyKey } satisfies DraftPayload);
        await refreshDraftCount();
        toast.info('離線已暫存', '恢復網路後自動同步');
        return null;
      }
      toast.error('提交失敗', (e as Error).message ?? 'unknown');
      return null;
    }
  }

  async function pickCustomPreset(preset: UserMealPreset): Promise<boolean> {
    setPresetBusy(preset.id);
    const meal = await submitMealPost({
      ate_at: new Date().toISOString(),
      source: 'manual',
      preset_id: preset.id,
    });
    setPresetBusy(null);
    if (meal) {
      patchMeals((prev) => [meal, ...prev]);
      toast.success('已記錄', preset.name);
      setAddMealOpen(false);
      return true;
    }
    return false;
  }

  // 新建自定义菜单（AddMealSheet 「+」/「加入自定義菜單」共用）。
  // 返 boolean：true 表示成功（sheet 內切回 list view），false 表示失敗 / 重名（保留 form 讓用戶改）。
  async function createPreset(input: MealPresetFormInput): Promise<boolean> {
    setCreatePresetBusy(true);
    setDuplicatePresetName(false);
    try {
      const r = await fetch('/api/meal-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify(input),
      });
      if (r.status === 409) {
        setDuplicatePresetName(true);
        return false;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchCustomPresets(preset);
        toast.success('已加入', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('保存失敗', (e as Error).message ?? 'unknown');
      return false;
    } finally {
      setCreatePresetBusy(false);
    }
  }

  async function updatePreset(id: string, input: MealPresetFormInput): Promise<boolean> {
    setCreatePresetBusy(true);
    setDuplicatePresetName(false);
    try {
      const r = await fetch(`/api/meal-presets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify(input),
      });
      if (r.status === 409) {
        setDuplicatePresetName(true);
        return false;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchUpdateCustomPreset(preset);
        toast.success('已更新', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('更新失敗', (e as Error).message ?? 'unknown');
      return false;
    } finally {
      setCreatePresetBusy(false);
    }
  }

  async function deletePreset(id: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/meal-presets/${id}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      patchDeleteCustomPreset(id);
      return true;
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message ?? 'unknown');
      return false;
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
    const meal = await submitMealPost({
      ate_at: new Date().toISOString(), source: 'photo_ai',
      dish_name: p.dish_name, kcal: p.kcal, protein_g: p.protein_g,
      carb_g: p.carb_g, fat_g: p.fat_g, fiber_g: p.fiber_g,
      ai_raw_json: { confidence: p.confidence }, satiety,
    });
    setConfirmMealBusy(false);
    if (meal) {
      patchMeals((prev) => [meal, ...prev]);
      patchRecentPhotoMeals(meal);
      setMealPreview(null);
      toast.success('已入庫', p.dish_name);
      setAddMealOpen(false);
    }
  }

  // 子層上拋：刪除 / 編輯成功
  const onMealDeleted = useCallback((id: string) => {
    patchMeals((prev) => prev.filter((m) => m.id !== id));
  }, [patchMeals]);

  const onMealUpdated = useCallback((meal: TodayMeal) => {
    patchMeals((prev) => prev.map((m) => (m.id === meal.id ? meal : m)));
  }, [patchMeals]);

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
        <PageHeader>
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
        <WorkoutDayToggle
          workoutMarked={workoutMarked}
          onSetWorkoutDay={setWorkoutDay}
          busy={workoutBusy}
        />

        {/* 今日摘要（含可點切換的右上日狀態標籤） */}
        <TodaySummary
          consumed={consumed}
          targets={targets}
          workoutMarked={workoutMarked}
          isWorkoutDay={isWorkoutDay}
          onSetWorkoutDay={setWorkoutDay}
          busy={workoutBusy}
        />

        {/* 今日已記錄：inline 展開編輯，不再彈半窗 */}
        <TodayMeals
          meals={meals}
          timezone={timezone}
          onMealDeleted={onMealDeleted}
          onMealUpdated={onMealUpdated}
        />

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

      {/* 右下角 knob 打開的新增餐面板（cover-flow 風格） */}
      <RecordMealSheet
        open={addMealOpen}
        onOpen={tryOpenAddMeal}
        onClose={() => { setAddMealOpen(false); setDuplicatePresetName(false); }}
        customPresets={customPresets}
        recentPhotoMeals={recentPhotoMeals}
        recordingId={presetBusy}
        onPickCustomPreset={pickCustomPreset}
        presetBusy={createPresetBusy}
        duplicatePresetName={duplicatePresetName}
        onClearDuplicatePresetName={() => setDuplicatePresetName(false)}
        onCreatePreset={createPreset}
        onUpdatePreset={updatePreset}
        onDeletePreset={deletePreset}
        mealExtractBusy={mealExtractBusy}
        mealPreview={mealPreview}
        onUploadMealPhoto={uploadMealPhoto}
        onConfirmMeal={confirmMeal}
        onCancelMealPreview={() => setMealPreview(null)}
        confirmMealBusy={confirmMealBusy}
      />
    </>
  );
}
