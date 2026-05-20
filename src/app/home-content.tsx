'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FITNESS_MEAL_PRESETS } from '@/lib/fitness-meals';
import { PhotoInput } from '@/components/photo-input';
import { MealPreviewCard, type MealPreview } from '@/components/meal-preview-card';
import { BodyPreviewCard, type BodyPreview } from '@/components/body-preview-card';
import { PushEnableButton } from '@/components/push-enable-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { saveDraft, syncDrafts } from '@/lib/drafts/sync';
import { getDraftsDb, type LocalDraft } from '@/lib/drafts/db';

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

function isOfflineError(e: unknown): boolean {
  return e instanceof TypeError;
}

export function HomeContent() {
  const [mealPreview, setMealPreview] = useState<MealPreview | null>(null);
  const [bodyPreview, setBodyPreview] = useState<BodyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  async function submit(type: 'meal' | 'body_metric', endpoint: string, body: Record<string, unknown>): Promise<unknown | null> {
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
        setError('离线，已存入本地草稿，恢复网络后自动同步');
        return null;
      }
      setError(err.message ?? 'unknown');
      return null;
    }
  }

  async function pickFitnessMeal(key: string) {
    const r = await submit('meal', '/api/meals/log', {
      ate_at: new Date().toISOString(), source: 'preset', preset_key: key,
    });
    if (r) alert('已记录');
  }

  async function uploadMealPhoto(b64: string) {
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
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function confirmMeal(p: MealPreview, satiety: number | undefined) {
    const r = await submit('meal', '/api/meals/log', {
      ate_at: new Date().toISOString(), source: 'photo_ai',
      dish_name: p.dish_name, kcal: p.kcal, protein_g: p.protein_g,
      carb_g: p.carb_g, fat_g: p.fat_g, fiber_g: p.fiber_g,
      ai_raw_json: { confidence: p.confidence }, satiety,
    });
    if (r) { setMealPreview(null); alert('已入库'); }
  }

  async function uploadBodyPhoto(b64: string) {
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
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function confirmBody(b: BodyPreview) {
    const r = await submit('body_metric', '/api/body/log', {
      measured_at: b.measured_at ?? new Date().toISOString(),
      weight_kg: b.weight_kg, body_fat_pct: b.body_fat_pct,
      skeletal_muscle_pct: b.skeletal_muscle_pct,
      visceral_fat: b.visceral_fat, bmi: b.bmi,
      source: 'screenshot', ai_raw_json: {},
    });
    if (r) { setBodyPreview(null); alert('已入库'); }
  }

  async function triggerDailyAdvice() {
    try {
      const r = await fetch('/api/advice/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      alert(j.content_md.slice(0, 300));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    location.href = '/login';
  }

  return (
    <>
      <main className="p-4 space-y-6 max-w-md mx-auto">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">food-food</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="open menu"
            className="p-2 -mr-2 rounded hover:bg-gray-100 active:bg-gray-200"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </header>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {draftCount > 0 && (
          <p className="text-amber-700 text-sm">⏳ {draftCount} 条草稿待同步（恢复网络后自动）</p>
        )}

        <PushEnableButton />

        <section>
          <h2 className="font-semibold mb-2">选健身餐</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(FITNESS_MEAL_PRESETS).map(([k, v]) => (
              <button key={k} onClick={() => pickFitnessMeal(k)} className="border rounded p-2 text-sm">{v.name}<br />{v.kcal}kcal</button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">拍餐（其他餐）</h2>
          {!mealPreview && <PhotoInput onPicked={(b64) => uploadMealPhoto(b64)} />}
          {mealPreview && <MealPreviewCard initial={mealPreview} onConfirm={confirmMeal} onCancel={() => setMealPreview(null)} />}
        </section>

        <section>
          <h2 className="font-semibold mb-2">体重 / 体脂截图</h2>
          {!bodyPreview && <PhotoInput onPicked={(b64) => uploadBodyPhoto(b64)} />}
          {bodyPreview && <BodyPreviewCard initial={bodyPreview} onConfirm={confirmBody} onCancel={() => setBodyPreview(null)} />}
        </section>

        <section>
          <button onClick={triggerDailyAdvice} className="bg-black text-white px-4 py-3 rounded w-full">今天怎么样？</button>
        </section>
      </main>

      {/* Drawer overlay + side panel */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!drawerOpen}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">菜单</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="close menu" className="p-1 rounded hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <nav className="flex flex-col">
          <Link href="/inbox" onClick={() => setDrawerOpen(false)} className="px-4 py-3 hover:bg-gray-50 border-b">📥 通知中心</Link>
          <Link href="/settings" onClick={() => setDrawerOpen(false)} className="px-4 py-3 hover:bg-gray-50 border-b">⚙️ 修改目标</Link>
          <Link href="/setup" onClick={() => setDrawerOpen(false)} className="px-4 py-3 hover:bg-gray-50 border-b">📝 重新设置个人数据</Link>
          <Link href="/admin/debug" onClick={() => setDrawerOpen(false)} className="px-4 py-3 hover:bg-gray-50 border-b text-gray-600 text-sm">🔧 调试面板</Link>
          <button onClick={signOut} className="text-left px-4 py-3 hover:bg-gray-50 border-b text-red-600">退出登录</button>
        </nav>
      </aside>
    </>
  );
}
