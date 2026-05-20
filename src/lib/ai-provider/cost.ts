import type { AnthropicUsage } from './retry';

// USD per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
};

export function estimateCostCents(model: string, usage?: AnthropicUsage): number {
  if (!usage) return 0;
  const p = PRICING[model] ?? PRICING['claude-sonnet-4-6']!;
  const usd = ((usage.input_tokens ?? 0) * p.input + (usage.output_tokens ?? 0) * p.output) / 1_000_000;
  return Math.round(usd * 100);
}
