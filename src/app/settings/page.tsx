'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type ProfileRow = {
  user_id: string;
  kcal_workout_day: number | null;
  kcal_rest_day: number | null;
  protein_g: number | null;
  carb_workout_day: number | null;
  carb_rest_day: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

const NUM_KEYS = ['kcal_workout_day','kcal_rest_day','protein_g','carb_workout_day','carb_rest_day','fat_g','fiber_g'] as const;
type NumKey = typeof NUM_KEYS[number];

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const supa = createSupabaseBrowserClient();

  useEffect(() => {
    supa.from('profiles').select('*').single().then(({ data }) => setProfile(data as ProfileRow | null));
  }, [supa]);

  async function save() {
    if (!profile) return;
    setMsg(null);
    const r = await supa.from('profiles').update({
      ...profile,
      targets_source: 'user_override',
      targets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never).eq('user_id', profile.user_id);
    setMsg(r.error ? `错误: ${r.error.message}` : '已保存');
  }

  if (!profile) return <p>loading...</p>;
  return (
    <main className="p-4 space-y-3 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">设置目标</h1>
      {NUM_KEYS.map((k) => (
        <label key={k} className="block text-sm">
          {k}: <input type="number" value={profile[k] ?? 0} onChange={(e) => setProfile({ ...profile, [k as NumKey]: Number(e.target.value) })} className="ml-2 border px-2 py-1 w-24" />
        </label>
      ))}
      <button onClick={save} className="bg-black text-white px-4 py-2 rounded">保存</button>
      {msg && <p>{msg}</p>}
    </main>
  );
}
