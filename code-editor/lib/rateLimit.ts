interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function getRequestIdentity(
  forwardedForHeader: string | string[] | undefined,
): string {
  if (typeof forwardedForHeader === 'string' && forwardedForHeader.trim()) {
    return forwardedForHeader.split(',')[0].trim();
  }

  if (Array.isArray(forwardedForHeader) && forwardedForHeader.length > 0) {
    const first = forwardedForHeader[0];
    if (first && first.trim()) {
      return first.split(',')[0].trim();
    }
  }

  return 'anonymous';
}
