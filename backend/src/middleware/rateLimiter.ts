import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { RedisManager } from '../config/redisManager';
import { AppError, ErrorCode } from '../types';

// Create Redis store for rate limiting
const createRedisStore = () => {
  const redis = RedisManager.getInstance();
  
  if (redis.isHealthy()) {
    return new RedisStore({
      client: redis.getClient() as any,
      prefix: 'rl:',
    } as any);
  }
  
  // Return undefined to use default memory store as fallback
  console.warn('Redis not available for rate limiting, using memory store');
  return undefined;
};

// General API rate limiter with Redis store
export const apiLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    throw new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'リクエスト数が制限を超えました。しばらく待ってから再度お試しください。',
      429
    );
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      '認証リクエスト数が制限を超えました。15分後に再度お試しください。',
      429
    );
  },
});

// Very strict rate limiter for token refresh
export const refreshTokenLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 refresh requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'トークンリフレッシュ数が制限を超えました。1時間後に再度お試しください。',
      429
    );
  },
});

// Rate limiter for Google OAuth initiation
export const oauthInitLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 OAuth init requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'OAuth認証の開始リクエスト数が制限を超えました。5分後に再度お試しください。',
      429
    );
  },
});

// Dynamic rate limiter based on user role
export const createDynamicLimiter = (multiplier: number = 1) => {
  return rateLimit({
    store: createRedisStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      // Admins get 5x the limit, managers get 2x
      const baseLimit = 100;
      const user = (req as any).user;
      if (user?.roles?.includes('ADMIN')) {
        return baseLimit * 5 * multiplier;
      } else if (user?.roles?.includes('MANAGER')) {
        return baseLimit * 2 * multiplier;
      }
      return baseLimit * multiplier;
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      const user = (req as any).user;
      if (user?.sub) {
        return `user:${user.sub}`;
      }
      return req.ip || 'unknown';
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};