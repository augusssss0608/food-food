export const BODY_METRICS_PROMPT_VERSION = 'body-extract-v1';

export function buildBodyMetricsPrompt(): string {
  return `从用户上传的 Omron Connect / 类似体重秤 App 截图提取身体数据，按 JSON schema 返回。

输出字段：
- weight_kg: 体重（kg，必填）
- body_fat_pct: 体脂率 %（可选）
- skeletal_muscle_pct: 骨骼肌率 %（可选）
- visceral_fat: 内脏脂肪等级（可选）
- bmi: BMI（可选）
- measured_at: 测量时间 ISO 字符串（如能从截图读出）
- confidence: 'low' | 'medium' | 'high'
- reasoning: 简要解释

约束：
- 看不清/没显示的字段不要瞎猜，留空
- 数值范围合理（体重 20-300kg, 体脂 3-70%, 等）
- 仅返回 JSON`;
}
