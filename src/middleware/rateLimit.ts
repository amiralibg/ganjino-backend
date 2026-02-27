import { NextFunction, Request, Response } from 'express';
import { MESSAGES } from '../constants/messages';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

const cleanupExpiredBuckets = (): void => {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const createRateLimiter = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    cleanupExpiredBuckets();

    const identity = req.ip || 'unknown';
    const key = `${options.keyPrefix}:${identity}`;
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        error: MESSAGES.auth.tooManyRequests,
      });
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);
    next();
  };
};
