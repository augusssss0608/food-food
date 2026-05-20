import type { ProviderName } from './interface';

// Phase 1：单 primary，无 fallback
export const AI_PRIMARY_PROVIDER: ProviderName = 'anthropic_api';
export const AI_FALLBACK_PROVIDER: ProviderName | null = null;

// Phase 3（POC 通过后改为）：
// export const AI_PRIMARY_PROVIDER: ProviderName = 'claude_agent_sdk';
// export const AI_FALLBACK_PROVIDER: ProviderName | null = 'anthropic_api';
