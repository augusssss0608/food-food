import { DateTime } from 'luxon';

export type PeriodUtcRange = {
  startUtc: string;
  endExclusiveUtc: string;
};

/**
 * 用户本地日期 (periodStartDate / periodEndDate) → UTC 半开区间。
 * 含 periodEndDate 的整天（即 [start 00:00 local, (end+1) 00:00 local)）。
 */
export function periodUtcRange(
  periodStartDate: string,
  periodEndDate: string,
  timezone: string,
): PeriodUtcRange {
  const startUtc = DateTime
    .fromISO(periodStartDate, { zone: timezone })
    .startOf('day')
    .toUTC()
    .toISO();

  const endExclusiveUtc = DateTime
    .fromISO(periodEndDate, { zone: timezone })
    .plus({ days: 1 })
    .startOf('day')
    .toUTC()
    .toISO();

  if (!startUtc || !endExclusiveUtc) throw new Error('periodUtcRange: invalid input');
  return { startUtc, endExclusiveUtc };
}
