import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
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
  SYSTEM_RULES_STRUCTURED, SYSTEM_RULES_ADVICE,
  buildNutritionPrompt, NUTRITION_PROMPT_VERSION,
  buildBodyMetricsPrompt, BODY_METRICS_PROMPT_VERSION,
  buildInitialTargetsPrompt, INITIAL_TARGETS_PROMPT_VERSION,
  buildDailyAdvicePrompt, DAILY_ADVICE_PROMPT_VERSION,
  buildWeeklyAdvicePrompt, WEEKLY_ADVICE_PROMPT_VERSION,
  buildMonthlyAdvicePrompt, MONTHLY_ADVICE_PROMPT_VERSION,
} from './prompts';
import { AIError } from './errors';

// 免费层 vision 模型；识餐 / 体测 OCR / 目标计算 / 建议统一用它
const MODEL = 'gemini-3.1-flash-lite';

const RETRY_OPTS = { maxTransportAttempts: 4, maxSchemaRetries: 1 };

const CONFIDENCE_SCHEMA: Schema = { type: Type.STRING, enum: ['low', 'medium', 'high'] };

const NUTRITION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    dish_name: { type: Type.STRING },
    kcal: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    carb_g: { type: Type.NUMBER },
    fat_g: { type: Type.NUMBER },
    fiber_g: { type: Type.NUMBER },
    confidence: CONFIDENCE_SCHEMA,
    reasoning: { type: Type.STRING },
  },
  required: ['dish_name', 'kcal', 'protein_g', 'carb_g', 'fat_g', 'fiber_g', 'confidence'],
};

const BODY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weight_kg: { type: Type.NUMBER },
    body_fat_pct: { type: Type.NUMBER },
    skeletal_muscle_pct: { type: Type.NUMBER },
    visceral_fat: { type: Type.NUMBER },
    bmi: { type: Type.NUMBER },
    measured_at: { type: Type.STRING },
    confidence: CONFIDENCE_SCHEMA,
    reasoning: { type: Type.STRING },
  },
  required: ['weight_kg', 'confidence'],
};

const TARGETS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    kcal_workout_day: { type: Type.NUMBER },
    kcal_rest_day: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    carb_workout_day: { type: Type.NUMBER },
    carb_rest_day: { type: Type.NUMBER },
    fat_g: { type: Type.NUMBER },
    fiber_g: { type: Type.NUMBER },
  },
  required: ['kcal_workout_day', 'kcal_rest_day', 'protein_g', 'carb_workout_day', 'carb_rest_day', 'fat_g', 'fiber_g'],
};

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider implements AiProvider {
  readonly providerName: ProviderName = 'gemini_api';
  private client: GoogleGenAI;

  constructor(opts: { apiKey: string }) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async estimateMealFromImage(input: { imageBase64: string }, ctx: CallContext) {
    return this.runStructured<NutritionEstimate>({
      ctx, promptVersion: NUTRITION_PROMPT_VERSION,
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: input.imageBase64 } },
        { text: buildNutritionPrompt() },
      ],
      responseSchema: NUTRITION_RESPONSE_SCHEMA,
      schema: NutritionEstimateSchema,
      postValidate: (r) => {
        assertInRange('kcal_per_meal', r.kcal);
      },
    });
  }

  async extractBodyMetrics(input: { imageBase64: string }, ctx: CallContext) {
    return this.runStructured<BodyMetricsExtracted>({
      ctx, promptVersion: BODY_METRICS_PROMPT_VERSION,
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: input.imageBase64 } },
        { text: buildBodyMetricsPrompt() },
      ],
      responseSchema: BODY_RESPONSE_SCHEMA,
      schema: BodyMetricsExtractedSchema,
      postValidate: (r) => {
        assertInRange('weight_kg', r.weight_kg);
        if (r.body_fat_pct != null) assertInRange('body_fat_pct', r.body_fat_pct);
      },
    });
  }

  async computeInitialTargets(input: ProfileInput, ctx: CallContext) {
    return this.runStructured<TargetSet>({
      ctx, promptVersion: INITIAL_TARGETS_PROMPT_VERSION,
      parts: [{ text: buildInitialTargetsPrompt(input) }],
      responseSchema: TARGETS_RESPONSE_SCHEMA,
      schema: TargetSetSchema,
      postValidate: (r) => {
        assertInRange('kcal_per_day_target', r.kcal_workout_day);
        assertInRange('kcal_per_day_target', r.kcal_rest_day);
      },
    });
  }

  async generateDailyAdvice(input: DailyContext, ctx: CallContext) {
    return this.runAdvice({ ctx, promptVersion: DAILY_ADVICE_PROMPT_VERSION, text: buildDailyAdvicePrompt(input) });
  }

  async generateWeeklyAdvice(input: WeeklyContext, ctx: CallContext) {
    return this.runAdvice({ ctx, promptVersion: WEEKLY_ADVICE_PROMPT_VERSION, text: buildWeeklyAdvicePrompt(input) });
  }

  async generateMonthlyAdvice(input: MonthlyContext, ctx: CallContext) {
    return this.runAdvice({ ctx, promptVersion: MONTHLY_ADVICE_PROMPT_VERSION, text: buildMonthlyAdvicePrompt(input) });
  }

  // ---------- internals ----------

  private async runStructured<T extends object>(opts: {
    ctx: CallContext;
    promptVersion: string;
    parts: GeminiPart[];
    responseSchema: Schema;
    schema: z.ZodType<T>;
    postValidate?: (r: T) => void;
  }): Promise<T & WithMeta> {
    const t0 = performance.now();
    let callId: string | null = null;
    let actualCents = 0;
    try {
      callId = await startAiCall({
        userId: opts.ctx.userId, correlationId: opts.ctx.correlationId,
        provider: this.providerName, kind: opts.ctx.kind, trigger: opts.ctx.trigger,
        model: MODEL, promptVersion: opts.promptVersion,
      });
      const { data, attempts, usage } = await callWithRetry<T>(
        async () => {
          const resp = await this.client.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: opts.parts }],
            config: {
              systemInstruction: SYSTEM_RULES_STRUCTURED,
              responseMimeType: 'application/json',
              responseSchema: opts.responseSchema,
            },
          });
          return { raw: parseJson(resp.text), usage: usageFromGemini(resp.usageMetadata) };
        },
        opts.schema,
        RETRY_OPTS,
      );
      if (opts.postValidate) opts.postValidate(data);
      actualCents = estimateCostCents(MODEL, usage);
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
      if (callId) {
        await finishAiCall(callId, {
          status: 'failed', attempt: failedAttempts,
          errorCode: err.code ?? 'unknown', errorMessage: err.message,
          latencyMs: Math.round(performance.now() - t0),
        });
      }
      throw e;
    } finally {
      await settleAiBudget(opts.ctx.userId, opts.ctx.kind, opts.ctx.usageDate, actualCents);
    }
  }

  private async runAdvice(opts: {
    ctx: CallContext;
    promptVersion: string;
    text: string;
  }): Promise<AdviceResult & WithMeta> {
    const t0 = performance.now();
    let callId: string | null = null;
    let actualCents = 0;
    try {
      callId = await startAiCall({
        userId: opts.ctx.userId, correlationId: opts.ctx.correlationId,
        provider: this.providerName, kind: opts.ctx.kind, trigger: opts.ctx.trigger,
        model: MODEL, promptVersion: opts.promptVersion,
      });
      const { data: text, attempts, usage } = await callWithRetry<string>(
        async () => {
          const resp = await this.client.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: opts.text }] }],
            config: { systemInstruction: SYSTEM_RULES_ADVICE },
          });
          return { raw: (resp.text ?? '').trim(), usage: usageFromGemini(resp.usageMetadata) };
        },
        z.string().min(1),
        { maxTransportAttempts: 4, maxSchemaRetries: 0 },
      );
      const flagged = scanAdviceForDanger(text);
      actualCents = estimateCostCents(MODEL, usage);
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
      if (callId) {
        await finishAiCall(callId, {
          status: 'failed', attempt: failedAttempts,
          errorCode: err.code ?? 'unknown', errorMessage: err.message,
          latencyMs: Math.round(performance.now() - t0),
        });
      }
      throw e;
    } finally {
      await settleAiBudget(opts.ctx.userId, opts.ctx.kind, opts.ctx.usageDate, actualCents);
    }
  }
}

function usageFromGemini(u?: { promptTokenCount?: number; candidatesTokenCount?: number }): AnthropicUsage {
  return { input_tokens: u?.promptTokenCount, output_tokens: u?.candidatesTokenCount };
}

function parseJson(text?: string): unknown {
  const t = (text ?? '').trim();
  try { return JSON.parse(t); }
  catch { return t; }
}
