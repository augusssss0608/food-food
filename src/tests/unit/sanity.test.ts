import { describe, it, expect } from 'vitest';
import { assertInRange, SANITY_RANGES } from '@/lib/ai-provider/sanity';
import { AIError } from '@/lib/ai-provider/errors';

describe('assertInRange', () => {
  it('accepts value within range', () => {
    expect(() => assertInRange('kcal_per_meal', 500)).not.toThrow();
  });

  it('rejects below min', () => {
    expect(() => assertInRange('kcal_per_meal', -1)).toThrow(AIError);
  });

  it('rejects above max', () => {
    expect(() => assertInRange('kcal_per_meal', 99999)).toThrow(AIError);
  });

  it('throws AIError("schema_invalid")', () => {
    try { assertInRange('weight_kg', 999); }
    catch (e: unknown) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).category).toBe('schema_invalid');
    }
  });

  it('SANITY_RANGES contains expected keys', () => {
    expect(Object.keys(SANITY_RANGES)).toEqual(expect.arrayContaining([
      'kcal_per_meal', 'kcal_per_day_target', 'protein_g_per_day',
      'carb_g_per_day', 'fat_g_per_day', 'fiber_g_per_day',
      'weight_kg', 'body_fat_pct', 'skeletal_muscle_pct', 'visceral_fat',
    ]));
  });
});
