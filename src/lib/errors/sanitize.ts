const SECRET_KEY_RE = /(authoriz|authentic|cookie|set-cookie|api[-_]?key|apikey|token|jwt|secret|password|private|vapid|supabase|anthropic)/i;
const OMITTED_KEY_RE = /^(image|photo|base64)([-_]?[a-z0-9]+)?$/i;  // 命中 image / imageBase64 / image_url / photo / base64_data

export function sanitizeContext(input: unknown, depth = 0): unknown {
  if (depth > 5) return '[MaxDepth]';
  if (input == null) return input;
  if (typeof input === 'string') {
    // 先脱敏，再截断（避免长字符串里的 secret 被截断保留）
    const redacted = input
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]')
      .replace(/sk-ant-[A-Za-z0-9._\-]+/g, 'sk-ant-[REDACTED]')
      .replace(/eyJ[A-Za-z0-9._\-]+/g, '[JWT_REDACTED]');
    if (redacted.length > 500) return redacted.slice(0, 500) + '[truncated]';
    return redacted;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.slice(0, 20).map((v) => sanitizeContext(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(key)) out[key] = '[REDACTED]';
    else if (OMITTED_KEY_RE.test(key)) out[key] = '[OMITTED]';
    else out[key] = sanitizeContext(value, depth + 1);
  }
  return out;
}
