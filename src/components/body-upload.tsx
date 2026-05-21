'use client';
import { useState } from 'react';
import { PhotoInput } from '@/components/photo-input';
import { BodyPreviewCard, type BodyPreview } from '@/components/body-preview-card';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { useDeferredRefresh } from '@/components/use-deferred-refresh';

/**
 * 體重 / 體脂截圖上傳 + AI OCR + 確認入庫。
 * 用戶要求從主頁搬到 /history/body 頁。
 *
 * 用 useDeferredRefresh：mutation 後延遲 2.5s refresh，drawer 導航時可取消，
 * 避免 refresh 清 prefetch cache 影響 history 頁 cold navigation。
 */
export function BodyUpload() {
  const deferredRefresh = useDeferredRefresh();
  const toast = useToast();
  const [preview, setPreview] = useState<BodyPreview | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function upload(b64: string) {
    setExtractBusy(true);
    try {
      const r = await fetch('/api/body/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setPreview(await r.json() as BodyPreview);
    } catch (e: unknown) {
      toast.error('識別失敗', (e as Error).message);
    } finally {
      setExtractBusy(false);
    }
  }

  async function confirm(b: BodyPreview) {
    setConfirmBusy(true);
    try {
      const r = await fetch('/api/body/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          measured_at: b.measured_at ?? new Date().toISOString(),
          weight_kg: b.weight_kg,
          body_fat_pct: b.body_fat_pct,
          skeletal_muscle_pct: b.skeletal_muscle_pct,
          visceral_fat: b.visceral_fat,
          bmi: b.bmi,
          source: 'screenshot',
          ai_raw_json: {},
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setPreview(null);
      toast.success('已入庫', `${b.weight_kg} kg`);
      deferredRefresh();
    } catch (e: unknown) {
      toast.error('提交失敗', (e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="mb-7">
      <SectionLabel>新增體重 / 體脂截圖</SectionLabel>
      {!preview && !extractBusy && (
        <PhotoInput onPicked={upload} label="上傳體重秤截圖" />
      )}
      {extractBusy && (
        <Card className="h-28 flex items-center justify-center gap-3">
          <Spinner size={18} className="text-accent" />
          <span className="text-[13px] text-text-2">AI OCR 中…</span>
        </Card>
      )}
      {preview && (
        <BodyPreviewCard
          initial={preview}
          onConfirm={confirm}
          onCancel={() => setPreview(null)}
          busy={confirmBusy}
        />
      )}
    </section>
  );
}
