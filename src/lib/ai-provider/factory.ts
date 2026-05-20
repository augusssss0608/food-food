import type { AiProvider, ProviderName } from './interface';
import { ClaudeApiProvider } from './claude-api';
import { SandboxAgentSdkProvider } from './sandbox-agent';
import { MockAiProvider } from './mock';

export function instantiate(name: ProviderName): AiProvider {
  switch (name) {
    case 'anthropic_api':
      return new ClaudeApiProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });
    case 'claude_agent_sdk':
      return new SandboxAgentSdkProvider({
        snapshotId: process.env.CLAUDE_AGENT_SNAPSHOT_ID!,
        oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
      });
    case 'mock':
      if (process.env.NODE_ENV === 'production') {
        throw new Error("ProviderName='mock' is not allowed in production");
      }
      return new MockAiProvider();
  }
}
