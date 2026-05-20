import { describe, it, expect } from 'vitest';
import {
  NutritionEstimateSchema,
  BodyMetricsExtractedSchema,
  TargetSetSchema,
  AdviceResultSchema,
} from '@/lib/ai-provider/types';

describe('Zod schemas', () => {
  it('NutritionEstimate passes valid + rejects missing kcal', () => {
    expect(NutritionEstimateSchema.safeParse({
      dish_name: '牛肉饭', kcal: 500, protein_g: 30, carb_g: 60, fat_g: 15, fiber_g: 5, confidence: 'medium',
    }).success).toBe(true);
    expect(NutritionEstimateSchema.safeParse({ dish_name: '牛肉饭' }).success).toBe(false);
  });

  it('BodyMetricsExtracted weight_kg required', () => {
    expect(BodyMetricsExtractedSchema.safeParse({ weight_kg: 65, confidence: 'high' }).success).toBe(true);
    expect(BodyMetricsExtractedSchema.safeParse({ confidence: 'high' }).success).toBe(false);
  });

  it('TargetSet all fields required + numeric', () => {
    expect(TargetSetSchema.safeParse({
      kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
      carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
    }).success).toBe(true);
  });

  it('AdviceResult content_md required', () => {
    expect(AdviceResultSchema.safeParse({ content_md: '## 总评\n...' }).success).toBe(true);
    expect(AdviceResultSchema.safeParse({}).success).toBe(false);
  });
});
