import { AIError } from './errors';

export const SANITY_RANGES = {
  kcal_per_meal: [0, 2500],
  kcal_per_day_target: [1200, 4500],
  protein_g_per_day: [50, 400],
  carb_g_per_day: [50, 800],
  fat_g_per_day: [20, 250],
  fiber_g_per_day: [10, 100],
  weight_kg: [20, 300],
  body_fat_pct: [3, 70],
  skeletal_muscle_pct: [10, 70],
  visceral_fat: [1, 30],
} as const;

export type SanityField = keyof typeof SANITY_RANGES;

export function assertInRange(field: SanityField, value: number): void {
  const [min, max] = SANITY_RANGES[field];
  if (value < min || value > max) {
    throw new AIError(
      'schema_invalid',
      false,
      `AI returned out-of-range ${field}=${value} (expected ${min}-${max})`,
    );
  }
}
