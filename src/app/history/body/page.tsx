import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { todayUtcRange } from '@/lib/timezone';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { LineChart } from '@/components/line-chart';
import { BodyUpload } from '@/components/body-upload';

type BodyRow = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  skeletal_muscle_pct: number | null;
  visceral_fat: number | null;
  bmi: number | null;
};

type ChartDef = {
  key: keyof Omit<BodyRow, 'measured_at'>;
  label: string;
  unit: string;
  color: string;
};

const CHARTS: ChartDef[] = [
  { key: 'weight_kg', label: '體重', unit: 'kg', color: '#c8ff00' },
  { key: 'body_fat_pct', label: '體脂', unit: '%', color: '#ff7a45' },
  { key: 'skeletal_muscle_pct', label: '骨骼肌', unit: '%', color: '#dcff3a' },
  { key: 'visceral_fat', label: '內臟脂肪', unit: '', color: '#a4a4ac' },
  { key: 'bmi', label: 'BMI', unit: '', color: '#4ade80' },
];

export default async function HistoryBodyPage() {
  const supa = await createSupabaseServerClient();
  const { data: claims, error: claimsError } = await supa.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect('/login');
  const userId = claims.claims.sub as string;

  const { data: profile, error: profileError } = await supa
    .from('profiles')
    .select('preferred_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const tz = (profile?.preferred_timezone ?? null) as string | null;
  const { timezone } = todayUtcRange(tz);

  const ninetyDaysAgoUtc = DateTime.now()
    .setZone(timezone)
    .minus({ days: 90 })
    .startOf('day')
    .toUTC()
    .toISO()!;

  const { data: rowsData, error: rowsError } = await supa
    .from('body_metrics')
    .select('measured_at, weight_kg, body_fat_pct, skeletal_muscle_pct, visceral_fat, bmi')
    .eq('user_id', userId)
    .gte('measured_at', ninetyDaysAgoUtc)
    .order('measured_at', { ascending: true });
  if (rowsError) throw rowsError;
  const rows = (rowsData ?? []) as BodyRow[];

  return (
    <PageShell>
      <PageHeader>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">history · body</p>
        <h1 className="display-roman text-[32px] leading-none">身體數據</h1>
        <p className="text-text-3 text-[13px] mt-2">近 90 天趨勢 · 共 {rows.length} 筆</p>
      </PageHeader>

      {/* 上傳新體重 / 體脂截圖（從主頁搬過來） */}
      <BodyUpload />

      {rows.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-text-3 text-[13px]">沒有紀錄</p>
          <p className="text-text-4 text-[11px] mt-1">上方上傳體重秤截圖開始</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {CHARTS.map((c) => {
            const series = rows.map((r) => ({ date: r.measured_at, value: r[c.key] }));
            return (
              <Card key={c.key} className="p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-text-2 font-mono">
                    {c.label}
                  </p>
                  <p className="text-[10px] font-mono text-text-2 tabular">
                    {c.unit ? `單位 ${c.unit}` : ''}
                  </p>
                </div>
                <LineChart data={series} unit={c.unit} color={c.color} />
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
