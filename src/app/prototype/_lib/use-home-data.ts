'use client';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import type { HomeSnapshot, UserMealPreset, Nutrients } from '@/lib/home-snapshot';
import type { TodayMeal } from '@/components/today-meals';
import { useToast } from '@/components/ui/toast';

const HOME_KEY = '/api/home/today';
const homeFetcher = async (url: string): Promise<HomeSnapshot> => {
  const r = await fetch(url, { headers: { 'sec-fetch-site': 'same-origin' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/**
 * 共用 hook：4 個 prototype variant 都用它拿真實 snapshot + 全套 mutations。
 * 跟主頁 home-content 同模式：SWR + fallbackData + cache patch。
 * 暴露 meals / workout / preset CRUD 所有 mutation。
 */
export function useHomeData(initialSnapshot: HomeSnapshot) {
  const { data, mutate } = useSWR<HomeSnapshot>(HOME_KEY, homeFetcher, {
    fallbackData: initialSnapshot,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
  });
  const snapshot = data!;

  useEffect(() => {
    mutate((prev) => prev ?? initialSnapshot, { revalidate: false });
  }, [initialSnapshot, mutate]);

  const toast = useToast();

  // ============ patch helpers ============
  const patchMeals = useCallback((updater: (prev: TodayMeal[]) => TodayMeal[]) => {
    mutate((prev) => {
      const base = prev ?? snapshot;
      if (!base) return base;
      return { ...base, meals: updater(base.meals) };
    }, { revalidate: false });
  }, [mutate, snapshot]);

  const patchCustomPresets = useCallback((updater: (prev: UserMealPreset[]) => UserMealPreset[]) => {
    mutate((prev) => {
      const base = prev ?? snapshot;
      if (!base) return base;
      return { ...base, customPresets: updater(base.customPresets ?? []) };
    }, { revalidate: false });
  }, [mutate, snapshot]);

  const patchWorkout = useCallback((isWorkout: boolean) => {
    mutate((prev) => {
      const base = prev ?? snapshot;
      if (!base) return base;
      return {
        ...base,
        workoutMarked: true,
        isWorkoutDay: isWorkout,
        targets: isWorkout ? base.targetOptions.workout : base.targetOptions.rest,
      };
    }, { revalidate: false });
  }, [mutate, snapshot]);

  // ============ Workout day ============
  const [workoutBusy, setWorkoutBusy] = useState(false);
  async function setWorkoutDay(isWorkout: boolean): Promise<boolean> {
    if (workoutBusy) return false;
    setWorkoutBusy(true);
    try {
      const r = await fetch('/api/workout-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ date: snapshot.todayDate, is_workout: isWorkout }),
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

  // ============ Meals ============
  const [recordingId, setRecordingId] = useState<string | null>(null);
  async function recordCustomPreset(preset: UserMealPreset): Promise<boolean> {
    setRecordingId(preset.id);
    try {
      const r = await fetch('/api/meals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          ate_at: new Date().toISOString(),
          source: 'manual',
          preset_id: preset.id,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const meal = j?.meal as TodayMeal | undefined;
      if (meal) {
        patchMeals((prev) => [meal, ...prev]);
        toast.success('已記錄', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('提交失敗', (e as Error).message ?? 'unknown');
      return false;
    } finally {
      setRecordingId(null);
    }
  }

  const onMealDeleted = useCallback((id: string) => {
    patchMeals((prev) => prev.filter((m) => m.id !== id));
  }, [patchMeals]);

  const onMealUpdated = useCallback((meal: TodayMeal) => {
    patchMeals((prev) => prev.map((m) => (m.id === meal.id ? meal : m)));
  }, [patchMeals]);

  // ============ Presets CRUD ============
  const [presetBusy, setPresetBusy] = useState(false);
  const [duplicateName, setDuplicateName] = useState(false);

  async function addPreset(name: string, kcal: number): Promise<boolean> {
    setPresetBusy(true);
    setDuplicateName(false);
    try {
      const r = await fetch('/api/meal-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ name, kcal }),
      });
      if (r.status === 409) { setDuplicateName(true); return false; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchCustomPresets((prev) => [preset, ...prev]);
        toast.success('已新增', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('保存失敗', (e as Error).message);
      return false;
    } finally { setPresetBusy(false); }
  }

  async function updatePreset(id: string, name: string, kcal: number): Promise<boolean> {
    setPresetBusy(true);
    setDuplicateName(false);
    try {
      const r = await fetch(`/api/meal-presets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ name, kcal }),
      });
      if (r.status === 409) { setDuplicateName(true); return false; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchCustomPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)));
        toast.success('已更新', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('更新失敗', (e as Error).message);
      return false;
    } finally { setPresetBusy(false); }
  }

  async function deletePreset(id: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/meal-presets/${id}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      patchCustomPresets((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message);
      return false;
    }
  }

  // ============ AI 建議 ============
  const [adviceBusy, setAdviceBusy] = useState(false);
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
    } finally { setAdviceBusy(false); }
  }

  // consumed 即時計算（同主頁）
  const consumed: Nutrients = snapshot.meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carb_g: acc.carb_g + (m.carb_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  );

  return {
    snapshot,
    presets: snapshot.customPresets ?? [],
    meals: snapshot.meals,
    timezone: snapshot.timezone,
    todayDate: snapshot.todayDate,
    workoutMarked: snapshot.workoutMarked,
    isWorkoutDay: snapshot.isWorkoutDay,
    targets: snapshot.targets,
    consumed,
    // busy flags
    recordingId,
    workoutBusy,
    presetBusy,
    adviceBusy,
    duplicateName,
    clearDuplicate: () => setDuplicateName(false),
    // mutations
    setWorkoutDay,
    recordCustomPreset,
    onMealDeleted,
    onMealUpdated,
    addPreset,
    updatePreset,
    deletePreset,
    triggerDailyAdvice,
  };
}

export type HomeDataApi = ReturnType<typeof useHomeData>;
