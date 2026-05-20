import { z } from 'zod';

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const NutritionEstimateSchema = z.object({
  dish_name: z.string(),
  kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  confidence: ConfidenceSchema,
  reasoning: z.string().optional(),
});

export const BodyMetricsExtractedSchema = z.object({
  weight_kg: z.number(),
  body_fat_pct: z.number().optional(),
  skeletal_muscle_pct: z.number().optional(),
  visceral_fat: z.number().optional(),
  bmi: z.number().optional(),
  measured_at: z.string().optional(),
  confidence: ConfidenceSchema,
  reasoning: z.string().optional(),
});

export const TargetSetSchema = z.object({
  kcal_workout_day: z.number(),
  kcal_rest_day: z.number(),
  protein_g: z.number(),
  carb_workout_day: z.number(),
  carb_rest_day: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
});

export const AdviceResultSchema = z.object({
  content_md: z.string(),
});
