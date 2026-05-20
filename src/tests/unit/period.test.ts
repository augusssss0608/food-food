import { describe, it, expect } from 'vitest';
import { periodUtcRange } from '@/lib/time/period';

describe('periodUtcRange', () => {
  it('Asia/Tokyo (+9) week 周一 → 周日 → UTC 半开区间', () => {
    const r = periodUtcRange('2026-05-18', '2026-05-24', 'Asia/Tokyo');
    expect(r.startUtc.startsWith('2026-05-17T15:00:00')).toBe(true);
    expect(r.endExclusiveUtc.startsWith('2026-05-24T15:00:00')).toBe(true);
  });

  it('UTC zone week 直接对齐', () => {
    const r = periodUtcRange('2026-05-18', '2026-05-24', 'UTC');
    expect(r.startUtc.startsWith('2026-05-18T00:00:00')).toBe(true);
    expect(r.endExclusiveUtc.startsWith('2026-05-25T00:00:00')).toBe(true);
  });

  it('daily single day window (start = end)', () => {
    const r = periodUtcRange('2026-05-19', '2026-05-19', 'Asia/Tokyo');
    expect(r.startUtc.startsWith('2026-05-18T15:00:00')).toBe(true);
    expect(r.endExclusiveUtc.startsWith('2026-05-19T15:00:00')).toBe(true);
  });

  it('month boundary (Jan → Feb)', () => {
    const r = periodUtcRange('2026-01-01', '2026-01-31', 'Asia/Tokyo');
    expect(r.startUtc.startsWith('2025-12-31T15:00:00')).toBe(true);
    expect(r.endExclusiveUtc.startsWith('2026-01-31T15:00:00')).toBe(true);
  });
});
