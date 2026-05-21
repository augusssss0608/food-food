import type { UserMealPreset, RecentPhotoMeal } from '@/lib/home-snapshot';

/**
 * 8 個 prototype variant 共用的 mock 數據。
 * 故意給比較多的菜單（13 筆）讓「grid 翻不動」「需要排序」這類問題在 demo 裡也成立。
 */
export const MOCK_PRESETS: UserMealPreset[] = [
  { id: 'p1', name: '雞胸糙米飯', kcal: 520, protein_g: 45, carb_g: 60, fat_g: 12, fiber_g: 6, created_at: '2026-05-22T01:00:00Z' },
  { id: 'p2', name: '蛋白奶昔', kcal: 180, protein_g: 30, carb_g: 8, fat_g: 2, fiber_g: 0, created_at: '2026-05-21T01:00:00Z' },
  { id: 'p3', name: '牛肉便當', kcal: 720, protein_g: 48, carb_g: 75, fat_g: 22, fiber_g: 5, created_at: '2026-05-20T01:00:00Z' },
  { id: 'p4', name: '雞肉沙拉', kcal: 380, protein_g: 38, carb_g: 18, fat_g: 18, fiber_g: 7, created_at: '2026-05-19T01:00:00Z' },
  { id: 'p5', name: '燕麥蛋白餅', kcal: 320, protein_g: 22, carb_g: 38, fat_g: 8, fiber_g: 6, created_at: '2026-05-18T01:00:00Z' },
  { id: 'p6', name: '鮭魚藜麥', kcal: 480, protein_g: 36, carb_g: 32, fat_g: 22, fiber_g: 5, created_at: '2026-05-17T01:00:00Z' },
  { id: 'p7', name: '希臘優格', kcal: 150, protein_g: 18, carb_g: 12, fat_g: 4, fiber_g: 0, created_at: '2026-05-16T01:00:00Z' },
  { id: 'p8', name: '日式咖哩飯', kcal: 680, protein_g: 28, carb_g: 92, fat_g: 18, fiber_g: 4, created_at: '2026-05-15T01:00:00Z' },
  { id: 'p9', name: '香蕉花生醬', kcal: 280, protein_g: 8, carb_g: 35, fat_g: 13, fiber_g: 4, created_at: '2026-05-14T01:00:00Z' },
  { id: 'p10', name: '蛋白棒', kcal: 200, protein_g: 20, carb_g: 22, fat_g: 6, fiber_g: 3, created_at: '2026-05-13T01:00:00Z' },
  { id: 'p11', name: '雞胸花椰菜', kcal: 350, protein_g: 42, carb_g: 12, fat_g: 10, fiber_g: 5, created_at: '2026-05-12T01:00:00Z' },
  { id: 'p12', name: '蝦仁炒蛋', kcal: 290, protein_g: 32, carb_g: 6, fat_g: 14, fiber_g: 1, created_at: '2026-05-11T01:00:00Z' },
  { id: 'p13', name: '豆腐藜麥碗', kcal: 420, protein_g: 24, carb_g: 48, fat_g: 14, fiber_g: 8, created_at: '2026-05-10T01:00:00Z' },
];

export const MOCK_RECENT_PHOTO: RecentPhotoMeal[] = [
  { meal_id: 'rp1', dish_name: '炒河粉', kcal: 580, protein_g: 18, carb_g: 75, fat_g: 18, fiber_g: 3, created_at: '2026-05-22T02:00:00Z' },
  { meal_id: 'rp2', dish_name: '麻婆豆腐飯', kcal: 620, protein_g: 22, carb_g: 78, fat_g: 22, fiber_g: 4, created_at: '2026-05-21T12:30:00Z' },
  { meal_id: 'rp3', dish_name: '抹茶拿鐵', kcal: 180, protein_g: 7, carb_g: 22, fat_g: 6, fiber_g: 0, created_at: '2026-05-20T09:00:00Z' },
];

export type TodayLogEntry = {
  id: string;
  ate_at: string;
  dish_name: string;
  kcal: number;
};

export const MOCK_TODAY_LOG: TodayLogEntry[] = [
  { id: 'l1', ate_at: '2026-05-22T08:12:00Z', dish_name: '蛋白奶昔', kcal: 180 },
  { id: 'l2', ate_at: '2026-05-22T12:44:00Z', dish_name: '雞胸糙米飯', kcal: 520 },
];
