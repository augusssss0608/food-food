import type { ProfileInput } from '@/lib/types/ai';

export const INITIAL_TARGETS_PROMPT_VERSION = 'initial-targets-v1';

export function buildInitialTargetsPrompt(profile: ProfileInput): string {
  return `根据用户基本信息算 body recomposition（增肌减脂）的初始目标热量与三大营养素，按 JSON schema 返回。

用户信息：
- 身高: ${profile.height_cm} cm
- 体重: ${profile.current_weight_kg} kg
- 生日: ${profile.birth_date}
- 性别: ${profile.sex}
- 每周训练天数: ${profile.training_days_per_week}

输出字段：
- kcal_workout_day: 训练日总热量
- kcal_rest_day: 休息日总热量（calorie cycling：训练日略高于 TDEE，休息日略低于 TDEE）
- protein_g: 每日蛋白质（建议 1.6-2.2 g/kg 体重）
- carb_workout_day, carb_rest_day, fat_g, fiber_g

约束：
- 用 Mifflin-St Jeor BMR 公式 × 活动系数算 TDEE
- recomp 策略：workout day = TDEE × 1.05, rest day = TDEE × 0.85
- 不得低于 1200 kcal/天
- 仅返回 JSON`;
}
