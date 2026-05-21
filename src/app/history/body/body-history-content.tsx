'use client';
import { useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { LineChart } from '@/components/line-chart';
import { TimelineCard, TableCard, HybridCard } from '@/components/body-charts';
import { BodyUpload } from '@/components/body-upload';
import { useToast } from '@/components/ui/toast';
import type { BodyRow, BodySnapshot } from '@/lib/body-snapshot';

const BODY_KEY = '/api/body/snapshot';
const fetcher = async (url: string): Promise<BodySnapshot> => {
  const r = await fetch(url, { headers: { 'sec-fetch-site': 'same-origin' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

type Variant = 'timeline' | 'table' | 'hybrid' | 'line';
type ChartDef = {
  key: keyof Omit<BodyRow, 'measured_at'>;
  label: string;
  unit: string;
  color: string;
  variant: Variant;
};

// 同頁並列展示三種能看到逐筆歷史的風格 + 兩個原折線作對比：
// D → 體重（縱向時間軸）
// E → 體脂（表格 + 進度條）
// F → 骨骼肌（折線圖 + 列表混合）
// 內臟脂肪 / BMI 保留現有折線圖供對比
const CHARTS: ChartDef[] = [
  { key: 'weight_kg',           label: '體重 · D',     unit: 'kg', color: '#c8ff00', variant: 'timeline' },
  { key: 'body_fat_pct',        label: '體脂 · E',     unit: '%',  color: '#ff7a45', variant: 'table' },
  { key: 'skeletal_muscle_pct', label: '骨骼肌 · F',   unit: '%',  color: '#dcff3a', variant: 'hybrid' },
  { key: 'visceral_fat',        label: '內臟脂肪',     unit: '',   color: '#a4a4ac', variant: 'line' },
  { key: 'bmi',                 label: 'BMI',          unit: '',   color: '#4ade80', variant: 'line' },
];

/**
 * 身體數據頁的 client 容器：
 * - 用 useSWR 接管 body_metrics snapshot，跟主頁同模式
 * - BodyUpload 入庫成功後直接 patch SWR cache，折線圖立即多一點
 * - 不再 router.refresh，drawer 路由不卡
 *
 * Seed cache + prev ?? data fallback：跟主頁 home-content 一樣防 fallbackData
 * 不等於 cache 的坑。
 */
export function BodyHistoryContent({ initialSnapshot }: { initialSnapshot: BodySnapshot }) {
  const { data: snapshot, mutate } = useSWR<BodySnapshot>(BODY_KEY, fetcher, {
    fallbackData: initialSnapshot,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
  });
  const data = snapshot!;
  const rows = data.rows;

  // 主動把 initialSnapshot seed 到 cache（fallbackData 只填 hook returned data，不寫 cache）。
  // 只在 cache 為空時填：切頁返回時 Router Cache 帶來的 initialSnapshot 是舊的，
  // 無條件覆蓋會把 patch 過的新 row 打回去（折線圖點消失）。
  useEffect(() => {
    mutate((prev) => prev ?? initialSnapshot, { revalidate: false });
  }, [initialSnapshot, mutate]);

  const toast = useToast();

  // body-upload 入庫成功上拋的 callback
  const onBodyInserted = useCallback((row: BodyRow) => {
    mutate((prev) => {
      const base = prev ?? data;
      if (!base) return base;
      // 90 天窗口檢查：超出窗口的 row 不插入圖表（會被 server revalidate 沖掉，看起來像
      // 「點突然消失」），只 toast 提示
      const rowTime = new Date(row.measured_at).getTime();
      const startTime = new Date(base.windowStartUtc).getTime();
      if (rowTime < startTime) {
        toast.info('已入庫', '時間超出近 90 天圖表範圍');
        return base;
      }
      const merged = [...base.rows, row].sort(
        (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
      );
      return { ...base, rows: merged };
    }, { revalidate: false });
  }, [mutate, data, toast]);

  return (
    <PageShell>
      <PageHeader>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">history · body</p>
        <h1 className="display-roman text-[32px] leading-none">身體數據</h1>
        <p className="text-text-3 text-[13px] mt-2">近 90 天趨勢 · 共 {rows.length} 筆</p>
      </PageHeader>

      <BodyUpload onInserted={onBodyInserted} />

      {rows.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-text-3 text-[13px]">沒有紀錄</p>
          <p className="text-text-4 text-[11px] mt-1">上方上傳體重秤截圖開始</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {CHARTS.map((c) => {
            const series = rows.map((r) => ({ date: r.measured_at, value: r[c.key] }));
            if (c.variant === 'timeline') {
              return <TimelineCard key={c.key} label={c.label} series={series} unit={c.unit} color={c.color} />;
            }
            if (c.variant === 'table') {
              return <TableCard key={c.key} label={c.label} series={series} unit={c.unit} color={c.color} />;
            }
            if (c.variant === 'hybrid') {
              return <HybridCard key={c.key} label={c.label} series={series} unit={c.unit} color={c.color} />;
            }
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
