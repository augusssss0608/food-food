import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  AiProvider, CallContext, ProviderName, AiMeta, WithMeta,
} from './interface';
import type {
  NutritionEstimate, BodyMetricsExtracted, TargetSet, AdviceResult,
  ProfileInput, DailyContext, WeeklyContext, MonthlyContext,
} from '@/lib/types/ai';
import { NutritionEstimateSchema, BodyMetricsExtractedSchema, TargetSetSchema } from './types';
import { callWithRetry } from './retry';
import type { AnthropicUsage } from './retry';
import { startAiCall, finishAiCall } from './ai-calls';
import { settleAiBudget } from './budget';
import { assertInRange } from './sanity';
import { estimateCostCents } from './cost';
import { scanAdviceForDanger } from './danger-words';
import {
  SYSTEM_RULES,
  buildNutritionPrompt, NUTRITION_PROMPT_VERSION,
  buildBodyMetricsPrompt, BODY_METRICS_PROMPT_VERSION,
  buildInitialTargetsPrompt, INITIAL_TARGETS_PROMPT_VERSION,
  buildDailyAdvicePrompt, DAILY_ADVICE_PROMPT_VERSION,
  buildWeeklyAdvicePrompt, WEEKLY_ADVICE_PROMPT_VERSION,
  buildMonthlyAdvicePrompt, MONTHLY_ADVICE_PROMPT_VERSION,
} from './prompts';
import { AIError } from './errors';

const MEAL_MODEL = 'claude-sonnet-4-6';
const BODY_MODEL = 'claude-sonnet-4-6';
const INITIAL_MODEL = 'claude-sonnet-4-6';
const DAILY_MODEL = 'claude-sonnet-4-6';
const WEEKLY_MODEL = 'claude-sonnet-4-6';
const MONTHLY_MODEL = 'claude-opus-4-7';

const RETRY_OPTS = { maxTransportAttempts: 4, maxSchemaRetries: 1 };

type ContentBlock = { type: string; text?: string };

export class ClaudeApiProvider implements AiProvider {
  readonly providerName: ProviderName = 'anthropic_api';
  private client: Anthropic;

  constructor(opts: { apiKey: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async estimateMealFromImage(input: { imageBase64: string }, ctx: CallContext) {
    return this.runStructured<NutritionEstimate>({
      ctx, model: MEAL_MODEL, promptVersion: NUTRITION_PROMPT_VERSION,
      buildMessages: () => ([{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 } },
          { type: 'text', text: buildNutritionPrompt() },
        ],
      }]),
      schema: NutritionEstimateSchema,
      postValidate: (r) => {
        assertInRange('kcal_per_meal', r.kcal);
      },
    });
  }

  async extractBodyMetrics(input: { imageBase64: string }, ctx: CallContext) {
    return this.runStructured<BodyMetricsExtracted>({
      ctx, model: BODY_MODEL, promptVersion: BODY_METRICS_PROMPT_VERSION,
      buildMessages: () => ([{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 } },
          { type: 'text', text: buildBodyMetricsPrompt() },
        ],
      }]),
      schema: BodyMetricsExtractedSchema,
      postValidate: (r) => {
        assertInRange('weight_kg', r.weight_kg);
        if (r.body_fat_pct != null) assertInRange('body_fat_pct', r.body_fat_pct);
      },
    });
  }

  async computeInitialTargets(input: ProfileInput, ctx: CallContext) {
    return this.runStructured<TargetSet>({
      ctx, model: INITIAL_MODEL, promptVersion: INITIAL_TARGETS_PROMPT_VERSION,
      buildMessages: () => ([{ role: 'user', content: buildInitialTargetsPrompt(input) }]),
      schema: TargetSetSchema,
      postValidate: (r) => {
        assertInRange('kcal_per_day_target', r.kcal_workout_day);
        assertInRange('kcal_per_day_target', r.kcal_rest_day);
      },
    });
  }

  async generateDailyAdvice(input: DailyContext, ctx: CallContext) {
    return this.runAdvice({
      ctx, model: DAILY_MODEL, promptVersion: DAILY_ADVICE_PROMPT_VERSION,
      buildText: () => buildDailyAdvicePrompt(input),
    });
  }

  async generateWeeklyAdvice(input: WeeklyContext, ctx: CallContext) {
    return this.runAdvice({
      ctx, model: WEEKLY_MODEL, promptVersion: WEEKLY_ADVICE_PROMPT_VERSION,
      buildText: () => buildWeeklyAdvicePrompt(input),
    });
  }

  async generateMonthlyAdvice(input: MonthlyContext, ctx: CallContext) {
    return this.runAdvice({
      ctx, model: MONTHLY_MODEL, promptVersion: MONTHLY_ADVICE_PROMPT_VERSION,
      buildText: () => buildMonthlyAdvicePrompt(input),
    });
  }

  // ---------- internals ----------

  private async runStructured<T extends object>(opts: {
    ctx: CallContext;
    model: string;
    promptVersion: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildMessages: () => any;
    schema: z.ZodType<T>;
    postValidate?: (r: T) => void;
  }): Promise<T & WithMeta> {
    const t0 = performance.now();
    const callId = await startAiCall({
      userId: opts.ctx.userId, correlationId: opts.ctx.correlationId,
      provider: this.providerName, kind: opts.ctx.kind, trigger: opts.ctx.trigger,
      model: opts.model, promptVersion: opts.promptVersion,
    });
    let actualCents = 0;
    try {
      const { data, attempts, usage } = await callWithRetry<T>(
        async () => {
          const resp = await this.client.messages.create({
            model: opts.model,
            max_tokens: 1024,
            system: SYSTEM_RULES,
            messages: opts.buildMessages(),
          });
          const raw = parseJsonFromContent(resp.content as ContentBlock[]);
          return { raw, usage: resp.usage as AnthropicUsage };
        },
        opts.schema,
        RETRY_OPTS,
      );
      if (opts.postValidate) opts.postValidate(data);
      actualCents = estimateCostCents(opts.model, usage);
      await finishAiCall(callId, {
        status: 'succeeded', attempt: attempts, usage,
        estimatedCostUsd: actualCents / 100,
        latencyMs: Math.round(performance.now() - t0),
      });
      const meta: AiMeta = {
        provider: this.providerName,
        durationMs: Math.round(performance.now() - t0),
        attempts,
        costCents: actualCents,
      };
      return { ...data, _meta: meta };
    } catch (e) {
      const err = e as { code?: string; message?: string; attempts?: number };
      const failedAttempts = (e instanceof AIError ? e.attempts : undefined) ?? err.attempts;
      await finishAiCall(callId, {
        status: 'failed', attempt: failedAttempts,
        errorCode: err.code ?? 'unknown', errorMessage: err.message,
        latencyMs: Math.round(performance.now() - t0),
      });
      throw e;
    } finally {
      await settleAiBudget(opts.ctx.userId, opts.ctx.kind, opts.ctx.usageDate, actualCents);
    }
  }

  private async runAdvice(opts: {
    ctx: CallContext;
    model: string;
    promptVersion: string;
    buildText: () => string;
  }): Promise<AdviceResult & WithMeta> {
    const t0 = performance.now();
    const callId = await startAiCall({
      userId: opts.ctx.userId, correlationId: opts.ctx.correlationId,
      provider: this.providerName, kind: opts.ctx.kind, trigger: opts.ctx.trigger,
      model: opts.model, promptVersion: opts.promptVersion,
    });
    let actualCents = 0;
    try {
      // Advice 是 free-form Markdown：走 callWithRetry 是为了让 transport / 429 / 5xx
      // 被分类为 AIError(FALLBACK_ELIGIBLE)，从而能被 withFallback 包装器接住。
      // maxSchemaRetries=0：z.string().min(1) 只验"非空"，重试没意义。
      const { data: text, attempts, usage } = await callWithRetry<string>(
        async () => {
          const resp = await this.client.messages.create({
            model: opts.model,
            max_tokens: 2048,
            system: SYSTEM_RULES,
            messages: [{ role: 'user', content: opts.buildText() }],
          });
          return { raw: textFromContent(resp.content as ContentBlock[]), usage: resp.usage as AnthropicUsage };
        },
        z.string().min(1),
        { maxTransportAttempts: 4, maxSchemaRetries: 0 },
      );
      const flagged = scanAdviceForDanger(text);
      actualCents = estimateCostCents(opts.model, usage);
      await finishAiCall(callId, {
        status: 'succeeded', attempt: attempts, usage,
        estimatedCostUsd: actualCents / 100,
        latencyMs: Math.round(performance.now() - t0),
      });
      const meta: AiMeta = {
        provider: this.providerName,
        durationMs: Math.round(performance.now() - t0),
        attempts,
        costCents: actualCents,
      };
      return {
        content_md: text,
        flagged,
        flagged_reason: flagged ? 'danger_word' : undefined,
        _meta: meta,
      };
    } catch (e) {
      const err = e as { code?: string; message?: string; attempts?: number };
      const failedAttempts = (e instanceof AIError ? e.attempts : undefined) ?? err.attempts;
      await finishAiCall(callId, {
        status: 'failed', attempt: failedAttempts,
        errorCode: err.code ?? 'unknown', errorMessage: err.message,
        latencyMs: Math.round(performance.now() - t0),
      });
      throw e;
    } finally {
      await settleAiBudget(opts.ctx.userId, opts.ctx.kind, opts.ctx.usageDate, actualCents);
    }
  }
}

function parseJsonFromContent(content: ContentBlock[]): unknown {
  const text = textFromContent(content);
  try { return JSON.parse(text); }
  catch { return text; }
}

function textFromContent(content: ContentBlock[]): string {
  return content.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('').trim();
}
