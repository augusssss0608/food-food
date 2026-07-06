import type { AiProvider, ProviderName } from './interface';
import { ClaudeApiProvider } from './claude-api';
import { GeminiProvider } from './gemini-api';
import { SandboxAgentSdkProvider } from './sandbox-agent';
import { MockAiProvider } from './mock';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Required env ${name} is missing`);
  return v;
}

export function instantiate(name: ProviderName): AiProvider {
  switch (name) {
    case 'anthropic_api':
      return new ClaudeApiProvider({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
    case 'gemini_api':
      return new GeminiProvider({ apiKey: requireEnv('GEMINI_API_KEY') });
    case 'claude_agent_sdk':
      return new SandboxAgentSdkProvider({
        snapshotId: requireEnv('CLAUDE_AGENT_SNAPSHOT_ID'),
        oauthToken: requireEnv('CLAUDE_CODE_OAUTH_TOKEN'),
      });
    case 'mock':
      if (process.env.NODE_ENV === 'production') {
        throw new Error("ProviderName='mock' is not allowed in production");
      }
      return new MockAiProvider();
  }
}
