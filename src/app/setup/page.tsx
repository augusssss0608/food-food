'use client';
import { useState } from 'react';

export default function SetupPage() {
  const [profile, setProfile] = useState({
    height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
    sex: 'male' as 'male' | 'female', training_days_per_week: 3,
    preferred_timezone: 'Asia/Tokyo',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'failed');
      setMsg('OK，跳转主页…');
      setTimeout(() => location.href = '/', 1000);
    } catch (e: unknown) { setMsg(`错误: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  return (
    <main className="p-4 space-y-3 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">首次设置</h1>
      {(['height_cm','current_weight_kg','training_days_per_week'] as const).map((k) => (
        <label key={k} className="block text-sm">
          {k}: <input type="number" value={profile[k]} onChange={(e) => setProfile({ ...profile, [k]: Number(e.target.value) })} className="ml-2 border px-2 py-1 w-24" />
        </label>
      ))}
      <label className="block text-sm">
        生日: <input type="date" value={profile.birth_date} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} className="ml-2 border px-2 py-1" />
      </label>
      <label className="block text-sm">
        性别: <select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as 'male' | 'female' })} className="ml-2 border px-2 py-1">
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
      </label>
      <button onClick={submit} disabled={busy} className="bg-black text-white px-4 py-2 rounded">{busy ? '生成中...' : '生成初始目标'}</button>
      {msg && <p className="text-sm">{msg}</p>}
    </main>
  );
}
