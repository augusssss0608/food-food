import { describe, it, expect } from 'vitest';
import { fallbackTdee, computeAge } from '@/lib/ai-provider/fallback-tdee';

describe('computeAge', () => {
  it('30 years old from 1996-05-19', () => {
    const age = computeAge('1996-05-19', new Date('2026-05-19'));
    expect(age).toBe(30);
  });
});

describe('fallbackTdee Mifflin-St Jeor', () => {
  it('30yo male 70kg 175cm training 3 days/wk', () => {
    const t = fallbackTdee({
      height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
      sex: 'male', training_days_per_week: 3,
    }, new Date('2026-05-19'));
    expect(t.kcal_rest_day).toBeGreaterThan(2200);
    expect(t.kcal_rest_day).toBeLessThan(2500);
    expect(t.kcal_workout_day).toBeGreaterThan(t.kcal_rest_day);
    expect(t.protein_g).toBe(140);
    expect(t.fiber_g).toBe(28);
  });

  it('female adjusts BMR formula by -161 instead of +5', () => {
    const t = fallbackTdee({
      height_cm: 165, current_weight_kg: 55, birth_date: '1996-05-19',
      sex: 'female', training_days_per_week: 2,
    }, new Date('2026-05-19'));
    expect(t.protein_g).toBe(110);
  });
});
