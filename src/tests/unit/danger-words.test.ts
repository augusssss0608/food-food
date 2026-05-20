import { describe, it, expect } from 'vitest';
import { scanAdviceForDanger } from '@/lib/ai-provider/danger-words';

describe('scanAdviceForDanger', () => {
  it.each([
    ['本周建议 24 小时禁食一天', true],
    ['连续 24h 断食可加速减脂', true],
    ['建议每天热量低于 1000 卡', true],
    ['节食三天试试', true],
    ['绝食有助于代谢', true],
    ['本建议可替代医疗治疗', true],
    ['正常建议：多吃蛋白', false],
    ['每天多走 8000 步', false],
  ])('"%s" → %s', (content, expected) => {
    expect(scanAdviceForDanger(content as string)).toBe(expected);
  });
});
