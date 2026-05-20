import type { AiProvider } from './interface';
import { AI_PRIMARY_PROVIDER, AI_FALLBACK_PROVIDER } from './config';
import { instantiate } from './factory';
import { withFallback } from './fallback';
import { MockAiProvider } from './mock';

let _cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (_cached) return _cached;
  // mock 入口：非生产环境 + MOCK_AI=1 即走 mock（dev / test 都覆盖，方便整个开发期不打真 API）
  if (process.env.NODE_ENV !== 'production' && process.env.MOCK_AI === '1') {
    _cached = new MockAiProvider();
    return _cached;
  }
  const primary = instantiate(AI_PRIMARY_PROVIDER);
  _cached = AI_FALLBACK_PROVIDER == null
    ? primary
    : withFallback(primary, instantiate(AI_FALLBACK_PROVIDER));
  return _cached;
}

export function _resetAiProviderCache(): void {
  _cached = null;
}

export type { AiProvider, CallContext, AiMeta, ProviderName, AiCallKind } from './interface';
export { AIError } from './errors';
export type { AIErrorCategory } from './errors';
