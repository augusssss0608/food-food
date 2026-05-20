const DANGER_PATTERNS: RegExp[] = [
  /24\s*(小时|h)\s*(禁食|断食)/i,
  /低于\s*1?000\s*[kK大]?卡/i,
  /绝食/,
  /节食[超过]?[一二三四五六七八九十]/,
  /替代\s*(医疗|治疗)/,
];

export function scanAdviceForDanger(content: string): boolean {
  return DANGER_PATTERNS.some((re) => re.test(content));
}
