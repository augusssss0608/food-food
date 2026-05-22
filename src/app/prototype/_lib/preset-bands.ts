import type { UserMealPreset } from '@/lib/home-snapshot';

export type MealBand = 'morning' | 'noon' | 'evening' | 'snack';

export const BAND_LABEL: Record<MealBand, string> = {
  morning: '早',
  noon: '午',
  evening: '晚',
  snack: '零',
};

export const BAND_LABEL_EN: Record<MealBand, string> = {
  morning: 'morning',
  noon: 'lunch',
  evening: 'dinner',
  snack: 'snack',
};

const BAND_KEYWORDS: Record<MealBand, RegExp> = {
  morning: /(蛋|咖啡|燕麥|燕麦|奶|麵包|面包|早餐|吐司|貝果|贝果|oat|egg|coffee|toast|bagel|cereal|milk)/i,
  noon: /(飯|饭|麵|面|漢堡|汉堡|三明治|便當|便当|沙拉|rice|noodle|burger|sandwich|bento|lunch|salad)/i,
  evening: /(肉|魚|鱼|湯|汤|火鍋|火锅|燉|炖|stew|dinner|steak|pork|beef|chicken|hotpot)/i,
  snack: /(果|茶|餅|饼|巧克力|薯片|甜|蛋糕|cake|fruit|tea|cookie|chips|candy|snack|dessert)/i,
};

export function categorizePreset(p: UserMealPreset): MealBand {
  const name = p.name;
  if (BAND_KEYWORDS.morning.test(name)) return 'morning';
  if (BAND_KEYWORDS.noon.test(name)) return 'noon';
  if (BAND_KEYWORDS.evening.test(name)) return 'evening';
  if (BAND_KEYWORDS.snack.test(name)) return 'snack';
  // fallback: 根据 kcal 大致猜
  if (p.kcal < 150) return 'snack';
  if (p.kcal < 350) return 'morning';
  return 'noon';
}

export function currentBand(): MealBand {
  const h = new Date().getHours();
  if (h < 10) return 'morning';
  if (h < 15) return 'noon';
  if (h < 21) return 'evening';
  return 'snack';
}

export function presetsByBand(presets: UserMealPreset[], band: MealBand): UserMealPreset[] {
  return presets.filter((p) => categorizePreset(p) === band);
}

/**
 * 按当前时段挑 top N。不足时退化到其他时段补齐。
 */
export function pickByBand(presets: UserMealPreset[], band: MealBand, n: number): UserMealPreset[] {
  const matched = presetsByBand(presets, band);
  if (matched.length >= n) return matched.slice(0, n);
  const others = presets.filter((p) => categorizePreset(p) !== band);
  return [...matched, ...others].slice(0, n);
}

/**
 * AI 推荐：当前时段 + top N。
 */
export function pickAIRecommended(presets: UserMealPreset[], n = 3): UserMealPreset[] {
  return pickByBand(presets, currentBand(), n);
}
