/**
 * In-memory sliding window rate limiter implementation
 * Provides lightweight protection without external dependencies.
 */

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const max = options.max || 100; // 100 requests per window default
  const message = options.message || 'Too many requests, please try again later.';

  const ipStore = new Map();

  // Periodically clean up expired IP records to prevent memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipStore.entries()) {
      if (now > data.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    let record = ipStore.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      ipStore.set(ip, record);
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    next();
  };
};

// Auth rate limiter (login / register / password reset)
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});

// General API rate limiter
const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 400,
  message: 'API rate limit exceeded. Please slow down your requests.',
});

// Strict action rate limiter (messages, offers, reports)
const strictActionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Action rate limit exceeded. Please wait a few minutes before trying again.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  strictActionLimiter,
};
