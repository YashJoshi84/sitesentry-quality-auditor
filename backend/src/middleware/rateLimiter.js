/**
 * Rate Limiter Middleware
 * Zero-dependency sliding window rate limiter with auto-cleanup.
 */

const clientWindows = new Map();

// Periodic cleanup of stale client records every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, records] of clientWindows.entries()) {
    const active = records.filter(timestamp => now - timestamp < 3600 * 1000);
    if (active.length === 0) {
      clientWindows.delete(key);
    } else {
      clientWindows.set(key, active);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Creates rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs Window duration in milliseconds (default 60s)
 * @param {number} options.max Maximum requests per window
 * @param {string} options.message Error message returned on 429
 * @param {string} options.keyPrefix Prefix to isolate limits across route categories
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 100,
  message = 'Too many requests. Please try again later.',
  keyPrefix = 'global',
} = {}) {
  return function rateLimiter(req, res, next) {
    // Skip rate limiting in test environment if explicitly flagged
    if (process.env.NODE_ENV === 'test' && process.env.SKIP_RATE_LIMIT === 'true') {
      return next();
    }

    const clientIp = getClientIdentifier(req);
    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const existingTimestamps = clientWindows.get(key) || [];
    const recentRequests = existingTimestamps.filter(t => t > windowStart);

    if (recentRequests.length >= max) {
      const oldestInWindow = recentRequests[0];
      const resetTimeMs = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      res.setHeader('Retry-After', resetTimeMs > 0 ? resetTimeMs : 1);
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', 0);
      res.setHeader('RateLimit-Reset', resetTimeMs > 0 ? resetTimeMs : 1);

      return res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds: resetTimeMs > 0 ? resetTimeMs : 1,
      });
    }

    recentRequests.push(now);
    clientWindows.set(key, recentRequests);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - recentRequests.length));

    next();
  };
}

// Preset limiters
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120, // 120 requests/min for general browsing/API read endpoints
  message: 'General API rate limit exceeded. Please wait a minute before making more requests.',
  keyPrefix: 'api-general',
});

export const auditTriggerLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15, // 15 scans per 5 minutes per IP to guard against resource exhaustion
  message: 'Audit scan limit exceeded (15 per 5 minutes). Please wait before launching another scan.',
  keyPrefix: 'api-audit-trigger',
});
