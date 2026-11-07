type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  return { allowed: true, remaining: limit - current.count, retryAfterMs: 0 };
}
