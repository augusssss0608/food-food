export type NutritionEstimate = {
  dish_name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
};

export type BodyMetricsExtracted = {
  weight_kg: number;
  body_fat_pct?: number;
  skeletal_muscle_pct?: number;
  visceral_fat?: number;
  bmi?: number;
  measured_at?: string;
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
};

export type ProfileInput = {
  height_cm: number;
  current_weight_kg: number;
  birth_date: string;
  sex: 'male' | 'female';
  training_days_per_week: number;
};

export type TargetSet = {
  kcal_workout_day: number;
  kcal_rest_day: number;
  protein_g: number;
  carb_workout_day: number;
  carb_rest_day: number;
  fat_g: number;
  fiber_g: number;
};

export type DailyContext = {
  date: string;
  targets: TargetSet;
  is_workout: boolean;
  meals: unknown[];
  body_metrics: unknown[];
  prior_advice?: unknown[];
};
export type WeeklyContext = {
  period_start: string;
  period_end: string;
  meals: unknown[];
  body_metrics: unknown[];
  workout_days: unknown[];
  prior_advice?: unknown[];
  targets: TargetSet;
};
export type MonthlyContext = WeeklyContext;

export type AdviceResult = {
  content_md: string;
  flagged?: boolean;
  flagged_reason?: string;
};
