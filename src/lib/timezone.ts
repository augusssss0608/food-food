import { DateTime } from 'luxon';

const FALLBACK_TZ = 'Asia/Tokyo';

/**
 * 把「用戶 timezone 下的今天」轉成 UTC 起 / 訖 + 本地日期。
 * 主頁今日摘要、daily advice、未來的歷史頁都應該走這個 helper，保持口徑一致。
 *
 * - 參數接 string | null | undefined（DB 欄位可能 null）
 * - 無效 IANA tz → fallback `Asia/Tokyo`（不讓首頁炸）
 * - 回傳 `timezone` 是 resolved 後的值，client 顯示日期/時間時用這個避免和 server 不一致
 * - `endExclusiveUtc` 名稱明確：查詢用 `.lt(endExclusiveUtc)`，不是 `.lte`
 */
export function todayUtcRange(timezone?: string | null): {
  timezone: string;
  startUtc: string;
  endExclusiveUtc: string;
  localDate: string;
} {
  const candidate = (timezone ?? '').trim() || FALLBACK_TZ;
  const probe = DateTime.now().setZone(candidate);
  const resolvedTz = probe.isValid ? candidate : FALLBACK_TZ;
  const now = probe.isValid ? probe : DateTime.now().setZone(FALLBACK_TZ);
  const start = now.startOf('day');
  return {
    timezone: resolvedTz,
    startUtc: start.toUTC().toISO()!,
    endExclusiveUtc: start.plus({ days: 1 }).toUTC().toISO()!,
    localDate: now.toISODate()!,
  };
}
