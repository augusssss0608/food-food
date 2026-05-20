export type AIErrorCategory =
  | 'transport'
  | 'auth_oauth'
  | 'schema_invalid'
  | 'rate_limit'
  | 'fallback_cap_cron_skip'
  | 'cancelled'
  | 'unknown';

export class AIError extends Error {
  constructor(
    public readonly category: AIErrorCategory,
    public readonly retryable: boolean,
    message: string,
    public override cause?: unknown,
    public attempts?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}
