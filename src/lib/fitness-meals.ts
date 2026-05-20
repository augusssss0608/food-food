export const FITNESS_MEAL_PRESETS = {
  beef_rice: { name: '牛肉糙米饭', kcal: 480, protein: 38, carb: 52, fat: 12, fiber: 6 },
  chicken_pasta: { name: '鸡胸意面', kcal: 510, protein: 42, carb: 58, fat: 10, fiber: 5 },
  salmon_salad: { name: '三文鱼沙拉', kcal: 420, protein: 32, carb: 18, fat: 22, fiber: 8 },
  egg_oats: { name: '鸡蛋燕麦', kcal: 380, protein: 24, carb: 48, fat: 10, fiber: 7 },
  tofu_quinoa: { name: '豆腐藜麦', kcal: 360, protein: 22, carb: 42, fat: 12, fiber: 9 },
} as const;

export type FitnessMealKey = keyof typeof FITNESS_MEAL_PRESETS;

export function getFitnessMealPreset(key: string): typeof FITNESS_MEAL_PRESETS[FitnessMealKey] | null {
  return (FITNESS_MEAL_PRESETS as Record<string, typeof FITNESS_MEAL_PRESETS[FitnessMealKey] | undefined>)[key] ?? null;
}
