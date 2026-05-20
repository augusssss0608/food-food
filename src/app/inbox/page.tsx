import { createSupabaseServerClient } from '@/lib/supabase/server';

type InboxRow = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export default async function InboxPage() {
  const supa = await createSupabaseServerClient();
  const { data } = await supa.from('inbox').select('*').order('created_at', { ascending: false }).limit(50);
  const items = (data ?? []) as InboxRow[];
  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-3">通知</h1>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className={`border rounded p-3 ${it.read_at ? 'opacity-60' : ''}`}>
            <div className="font-medium">{it.title}</div>
            {it.body && <div className="text-sm text-gray-600">{it.body}</div>}
            <div className="text-xs text-gray-400">{it.created_at}</div>
          </li>
        ))}
        {items.length === 0 && <li className="text-gray-500 text-sm">暂无通知</li>}
      </ul>
    </main>
  );
}
