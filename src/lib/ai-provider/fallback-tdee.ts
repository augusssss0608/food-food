import type { ProfileInput, TargetSet } from '@/lib/types/ai';

export function computeAge(birthDate: string, now: Date = new Date()): number {
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function fallbackTdee(profile: ProfileInput, now: Date = new Date()): TargetSet {
  const age = computeAge(profile.birth_date, now);
  const bmr = profile.sex === 'male'
    ? 10 * profile.current_weight_kg + 6.25 * profile.height_cm - 5 * age + 5
    : 10 * profile.current_weight_kg + 6.25 * profile.height_cm - 5 * age - 161;
  const activityMult = 1.2 + 0.175 * Math.min(profile.training_days_per_week, 6);
  const tdee = bmr * activityMult;
  return {
    kcal_rest_day: Math.round(tdee * 0.85),
    kcal_workout_day: Math.round(tdee * 1.05),
    protein_g: Math.round(profile.current_weight_kg * 2.0),
    fat_g: Math.round(tdee * 0.25 / 9),
    carb_rest_day: Math.round((tdee * 0.85 - profile.current_weight_kg * 2.0 * 4 - tdee * 0.25) / 4),
    carb_workout_day: Math.round((tdee * 1.05 - profile.current_weight_kg * 2.0 * 4 - tdee * 0.25) / 4),
    fiber_g: 28,
  };
}
