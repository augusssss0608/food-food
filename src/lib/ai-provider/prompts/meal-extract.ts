export const NUTRITION_PROMPT_VERSION = 'nutrition-extract-v1';

export function buildNutritionPrompt(): string {
  return `从用户拍摄的食物照片估算营养信息，按 JSON schema 返回。

输出字段：
- dish_name: 中文菜名
- kcal: 估算总热量（kcal）
- protein_g: 蛋白质（g）
- carb_g: 碳水（g）
- fat_g: 脂肪（g）
- fiber_g: 膳食纤维（g）
- confidence: 'low' | 'medium' | 'high' — 估算置信度
- reasoning: 简要解释你的估算依据（这一字段不会被未来 advice 调用喂回，避免污染）

约束：
- 数值范围必须合理（kcal 0-2500, 蛋白 0-200, 等）
- 不确定就用 confidence=low + 中位数估值
- 仅返回 JSON，不要 markdown 包裹`;
}
