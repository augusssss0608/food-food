import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DateTime } from 'luxon';
import { todayUtcRange } from '@/lib/timezone';

// 固定「現在」= 2026-05-21T05:30:00Z（UTC），所有 case 用同一個 now 作為基準
const FIXED_NOW_ISO = '2026-05-21T05:30:00Z';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('todayUtcRange', () => {
  it('Asia/Tokyo: UTC 05:30 是日本 14:30，當天 00:00 JST = 2026-05-20T15:00:00Z', () => {
    const r = todayUtcRange('Asia/Tokyo');
    expect(r.timezone).toBe('Asia/Tokyo');
    expect(r.localDate).toBe('2026-05-21');
    expect(DateTime.fromISO(r.startUtc).toUTC().toISO()).toBe('2026-05-20T15:00:00.000Z');
    expect(DateTime.fromISO(r.endExclusiveUtc).toUTC().toISO()).toBe('2026-05-21T15:00:00.000Z');
  });

  it('America/New_York: UTC 05:30 是 NY 01:30（同日 5/21），當天 00:00 ET = 2026-05-21T04:00:00Z（DST）', () => {
    const r = todayUtcRange('America/New_York');
    expect(r.timezone).toBe('America/New_York');
    expect(r.localDate).toBe('2026-05-21');
    expect(DateTime.fromISO(r.startUtc).toUTC().toISO()).toBe('2026-05-21T04:00:00.000Z');
    expect(DateTime.fromISO(r.endExclusiveUtc).toUTC().toISO()).toBe('2026-05-22T04:00:00.000Z');
  });

  it('invalid tz fallback 到 Asia/Tokyo', () => {
    const r = todayUtcRange('Bad/Zone');
    expect(r.timezone).toBe('Asia/Tokyo');
    expect(r.localDate).toBe('2026-05-21');
  });

  it('null / undefined / 空字串 fallback 到 Asia/Tokyo', () => {
    expect(todayUtcRange(null).timezone).toBe('Asia/Tokyo');
    expect(todayUtcRange(undefined).timezone).toBe('Asia/Tokyo');
    expect(todayUtcRange('').timezone).toBe('Asia/Tokyo');
    expect(todayUtcRange('   ').timezone).toBe('Asia/Tokyo');
  });

  it('start / end 剛好 24h 整距', () => {
    const r = todayUtcRange('Asia/Tokyo');
    const diff = DateTime.fromISO(r.endExclusiveUtc).diff(DateTime.fromISO(r.startUtc), 'hours').hours;
    expect(diff).toBe(24);
  });
});
