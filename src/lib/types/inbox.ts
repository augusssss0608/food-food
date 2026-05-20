export type InboxType = 'weekly_advice_ready' | 'monthly_advice_ready' | 'body_metrics_overdue';

export type InboxData =
  | { type: 'weekly_advice_ready'; adviceId: string; periodStart: string }
  | { type: 'monthly_advice_ready'; adviceId: string; periodStart: string }
  | { type: 'body_metrics_overdue'; lastMeasuredAt: string | null };
