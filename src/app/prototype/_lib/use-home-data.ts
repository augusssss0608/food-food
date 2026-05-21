'use client';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';
import type { TodayMeal } from '@/components/today-meals';
import { useToast } from '@/components/ui/toast';

const HOME_KEY = '/api/home/today';
const homeFetcher = async (url: string): Promise<HomeSnapshot> => {
  const r = await fetch(url, { headers: { 'sec-fetch-site': 'same-origin' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/**
 * 共用 hook：4 個 prototype variant 都用它拿真實 snapshot + mutations。
 * 跟主頁 home-content 同模式：SWR + fallbackData + cache patch。
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

  // mount 後把 initialSnapshot seed 到 cache（用 prev ?? initialSnapshot 防切頁返回時舊 payload 覆蓋新 cache）
  useEffect(() => {
    mutate((prev) => prev ?? initialSnapshot, { revalidate: false });
  }, [initialSnapshot, mutate]);

  const toast = useToast();

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
      if (r.status === 409) {
        setDuplicateName(true);
        return false;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchCustomPresets((prev) => [preset, ...prev]);
        toast.success('已新增', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('保存失敗', (e as Error).message ?? 'unknown');
      return false;
    } finally {
      setPresetBusy(false);
    }
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
      if (r.status === 409) {
        setDuplicateName(true);
        return false;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const preset = j?.preset as UserMealPreset | undefined;
      if (preset) {
        patchCustomPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)));
        toast.success('已更新', preset.name);
      }
      return true;
    } catch (e: unknown) {
      toast.error('更新失敗', (e as Error).message ?? 'unknown');
      return false;
    } finally {
      setPresetBusy(false);
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
      patchCustomPresets((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message ?? 'unknown');
      return false;
    }
  }

  return {
    snapshot,
    presets: snapshot.customPresets ?? [],
    meals: snapshot.meals,
    timezone: snapshot.timezone,
    recordingId,
    presetBusy,
    duplicateName,
    clearDuplicate: () => setDuplicateName(false),
    recordCustomPreset,
    addPreset,
    updatePreset,
    deletePreset,
  };
}

export type HomeDataApi = ReturnType<typeof useHomeData>;
