import type { ProviderName } from './interface';

// 主 provider：Gemini 免费层（gemini-3.1-flash-lite）；单 primary，无 fallback
export const AI_PRIMARY_PROVIDER: ProviderName = 'gemini_api';
export const AI_FALLBACK_PROVIDER: ProviderName | null = null;

// 备选（需要时切 primary 或加 fallback）：
// - 'anthropic_api'：Claude API key，付费，结构化输出最稳，可作质量兜底
// - 'claude_agent_sdk'：订阅 OAuth，违反 Consumer ToS，勿用
